# 👤 Бэкенд и Архитектура (Участник №3)

## Ответственность
- REST API для мобильного клиента и админки.
- Алгоритм indoor-навигации $A^*$ (расчет расстояний, шагов и панорам вдоль пути).
- Развертывание в Docker и поддержка стабильности сервера.

## Структура папки
- `app/main.py` — Главный файл FastAPI (CORS, эндпоинты, раздача файлов).
- `app/core/pathfinder.py` — Реализация алгоритма $A^*$ по графу с евклидовой эвристикой.
- `requirements.txt` — Зависимости (FastAPI, Uvicorn, Pydantic, Pillow).
- `Dockerfile` — Образ бэкенда для Docker Compose.

## Панорамы и загрузки
- `GET /api/panoramas` — отдаёт `/app/uploads/panoramas/index.json`, который
  формирует `cv-worker` (если файла ещё нет — пустой каталог).
- `POST /api/upload` — принимает `file` и необязательный `folder`
  (`[A-Za-z0-9_-]{1,64}`). Имя файла санитизируется, расширение проверяется,
  размер ограничен `TTK_MAX_UPLOAD_BYTES` (по умолчанию 25 МБ).
  Загрузка 2+ кадров в одну папку запускает сшивку в `cv-worker`.

## Запуск локально без Docker (по желанию):
```bash
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Swagger UI доступен по адресу: http://localhost:8000/docs
