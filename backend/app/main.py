import os
import json
import re
from pathlib import Path
from typing import Optional, Dict, Any, List
from urllib.parse import quote
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.core.pathfinder import calculate_indoor_route

app = FastAPI(
    title="ТТК Карта Пространства API",
    version="1.0.0",
    description="Backend API для indoor-навигации, 2D-планов и 360-панорам"
)

# Разрешаем CORS для всех локальных портов фронтенда (клиент на 3000, админка на 3001)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(os.getenv("TTK_UPLOAD_DIR", "/app/uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

PANORAMA_INDEX = UPLOAD_DIR / "panoramas" / "index.json"
FOLDER_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
MAX_UPLOAD_BYTES = int(os.getenv("TTK_MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))
ALLOWED_UPLOAD_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff",
    ".svg", ".json",
}

# Монтируем папку с загрузками для раздачи файлов (планы, панорамы)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Загружаем эталонный датасет (In-Memory Database для быстрого старта на хакатоне)
MOCK_FILE = Path(os.getenv("TTK_MOCK_FILE", "/app/shared/mock_venue.json"))
local_venues_db: Dict[str, Any] = {}

def load_initial_data():
    if MOCK_FILE.exists():
        try:
            with open(MOCK_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                local_venues_db[data["slug"]] = data
        except Exception as e:
            print(f"Error loading initial mock data: {e}")

load_initial_data()

# --- СХЕМЫ ЗАПРОСОВ ---
class RouteRequestModel(BaseModel):
    fromPoiId: Optional[str] = None
    toPoiId: Optional[str] = None
    fromCoords: Optional[Dict[str, float]] = None
    toCoords: Optional[Dict[str, float]] = None

@app.get("/api/health")
def healthcheck():
    return {"status": "ok", "service": "ttk-space-map-backend", "venues_count": len(local_venues_db)}

# --- ПУБЛИЧНЫЙ API (ДЛЯ ПОСЕТИТЕЛЕЙ) ---
@app.get("/api/public/{slug}")
def get_public_venue(slug: str):
    venue = local_venues_db.get(slug)
    if not venue:
        # Если не найден точный slug, вернем первый доступный для удобства демо
        if local_venues_db:
            return next(iter(local_venues_db.values()))
        raise HTTPException(status_code=404, detail="Площадка не найдена")
    return venue

@app.post("/api/public/{slug}/route")
def build_route(slug: str, req: RouteRequestModel):
    venue = local_venues_db.get(slug)
    if not venue:
        venue = next(iter(local_venues_db.values()), None)
    if not venue or not venue.get("floors"):
        raise HTTPException(status_code=404, detail="Данные этажа отсутствуют")

    floor = venue["floors"][0] # Для MVP берем 1-й этаж
    points = {p["id"]: p for p in floor.get("points", [])}

    # Определяем координаты старта
    from_x, from_y = 600.0, 740.0
    if req.fromPoiId and req.fromPoiId in points:
        from_x, from_y = float(points[req.fromPoiId]["x"]), float(points[req.fromPoiId]["y"])
    elif req.fromCoords:
        from_x, from_y = float(req.fromCoords.get("x", from_x)), float(req.fromCoords.get("y", from_y))

    # Определяем координаты цели
    to_x, to_y = 600.0, 400.0
    if req.toPoiId and req.toPoiId in points:
        to_x, to_y = float(points[req.toPoiId]["x"]), float(points[req.toPoiId]["y"])
    elif req.toCoords:
        to_x, to_y = float(req.toCoords.get("x", to_x)), float(req.toCoords.get("y", to_y))

    route = calculate_indoor_route(floor, from_x, from_y, to_x, to_y)
    
    # Добавляем связанные панорамы вдоль маршрута
    panos = [p["id"] for p in floor.get("panoramas", [])]
    route["panoramas"] = panos[:3]
    return route

# --- ПАНОРАМЫ, ПОДГОТОВЛЕННЫЕ CV-WORKER ---
@app.get("/api/panoramas")
def list_panoramas():
    """Отдаёт каталог панорам из /app/uploads/panoramas/index.json как есть."""
    if not PANORAMA_INDEX.exists():
        return {"generatedAt": None, "count": 0, "panoramas": []}

    try:
        with open(PANORAMA_INDEX, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=500, detail="index.json панорам повреждён") from exc

    if not isinstance(data, dict) or not isinstance(data.get("panoramas"), list):
        raise HTTPException(status_code=500, detail="index.json панорам имеет неверный формат")
    return data


# --- API ОРГАНИЗАТОРА (ДЛЯ АДМИНКИ) ---
@app.get("/api/venues")
def list_venues():
    return list(local_venues_db.values())

@app.put("/api/venues/{slug}")
def save_venue(slug: str, updated_venue: Dict[str, Any]):
    local_venues_db[slug] = updated_venue
    return {"status": "saved", "slug": slug}


def _safe_upload_name(filename: str) -> str:
    # Браузеры иногда присылают C:\fakepath\file.jpg — приводим оба разделителя.
    name = Path(filename.replace("\\", "/")).name.strip()
    if not name or name in {".", ".."} or name.startswith("."):
        raise HTTPException(status_code=400, detail="Недопустимое имя файла")
    if Path(name).suffix.lower() not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Недопустимый тип файла. Разрешены: {', '.join(sorted(ALLOWED_UPLOAD_EXTENSIONS))}",
        )
    return name


@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    folder: Optional[str] = Form(None),
):
    """Загружает файл в /app/uploads или в /app/uploads/<folder>.

    Папка нужна, чтобы положить 2+ кадра одной панорамы: cv-worker сшивает
    такие папки автоматически. Имя папки ограничено [A-Za-z0-9_-].
    """
    safe_name = _safe_upload_name(file.filename or "")

    if folder is not None and folder != "":
        if not FOLDER_RE.fullmatch(folder):
            raise HTTPException(
                status_code=400,
                detail="folder должен соответствовать [A-Za-z0-9_-]{1,64}",
            )
        target_dir = UPLOAD_DIR / folder
    else:
        target_dir = UPLOAD_DIR
        folder = None

    target_dir.mkdir(parents=True, exist_ok=True)
    file_path = (target_dir / safe_name).resolve()
    if UPLOAD_DIR.resolve() not in file_path.parents:
        raise HTTPException(status_code=400, detail="Недопустимый путь загрузки")

    size = 0
    try:
        with open(file_path, "wb") as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Файл больше {MAX_UPLOAD_BYTES} байт",
                    )
                out.write(chunk)
    except HTTPException:
        file_path.unlink(missing_ok=True)
        raise
    except OSError as exc:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Не удалось сохранить файл") from exc

    if size == 0:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Пустой файл")

    encoded_name = quote(safe_name)
    url = f"/uploads/{folder}/{encoded_name}" if folder else f"/uploads/{encoded_name}"
    return {"url": url, "size": size, "folder": folder, "filename": safe_name}
