import os
import json
from pathlib import Path
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, UploadFile, File
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

UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_MAP_BASE_URL = (os.getenv("PUBLIC_MAP_BASE_URL") or "http://localhost:3000").rstrip("/")

# Монтируем папку с загрузками для раздачи файлов (планы, панорамы)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Загружаем эталонный датасет (In-Memory Database для быстрого старта на хакатоне)
MOCK_FILE = Path("/app/shared/mock_venue.json")
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
        raise HTTPException(status_code=404, detail="Площадка не найдена")
    return venue

@app.post("/api/public/{slug}/route")
def build_route(slug: str, req: RouteRequestModel):
    venue = local_venues_db.get(slug)
    if not venue:
        raise HTTPException(status_code=404, detail="Площадка не найдена")
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

# --- API ОРГАНИЗАТОРА (ДЛЯ АДМИНКИ) ---
@app.get("/api/venues")
def list_venues():
    return list(local_venues_db.values())

@app.put("/api/venues/{slug}")
def save_venue(slug: str, updated_venue: Dict[str, Any]):
    if updated_venue.get("slug") != slug:
        raise HTTPException(status_code=400, detail="Slug в URL и JSON не совпадает")
    # Создаём публичный URL только при успешном сохранении опубликованной карты.
    public_url = f"{PUBLIC_MAP_BASE_URL}/m/{slug}"
    updated_venue["publicUrl"] = public_url
    local_venues_db[slug] = updated_venue
    return {"status": "saved", "slug": slug, "publicUrl": public_url}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    filename = file.filename or "upload.bin"
    safe_name = f"{filename}"
    file_path = UPLOAD_DIR / safe_name
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    return {"url": f"/uploads/{safe_name}", "size": len(content)}
