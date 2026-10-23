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

## Запуск локально без Docker (по желанию):
```bash
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Swagger UI доступен по адресу: http://localhost:8000/docs
