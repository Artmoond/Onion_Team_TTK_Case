# CV Worker — сшивка панорам и WebP (Участник №4)

Сервис обрабатывает кадры панорам: сшивает их через OpenCV Stitcher и готовит
два WebP-файла — полный (до 4096 px) и лёгкий preview (1024×512) для быстрого
старта 360°-тура на мобильном.

## Что внутри

| Файл | Назначение |
| :--- | :--- |
| `stitcher.py` | Ядро: кроп 2:1, сшивка, сжатие WebP, манифест. Без побочных эффектов при импорте. |
| `worker.py` | CLI (`compress`, `stitch`, `watch`) и фоновый цикл обработки папки загрузок. |
| `tests/` | Тесты ядра на pytest (кроп, размеры, манифест). |
| `Dockerfile` | Образ на `python:3.11-slim` + `opencv-python-headless`. |

## Технологии

- **OpenCV** (`cv2.Stitcher`) — поиск ключевых точек, гомография и бесшовная
  сшивка перекрывающихся кадров в панораму.
- **Pillow** — EXIF-ориентация, кроп под equirectangular 2:1, LANCZOS-ресайз,
  кодирование в WebP с `method=6`.
- **NumPy** — внутренний формат кадров OpenCV.
- **argparse + logging** — CLI и логи с таймстемпами.
- **Docker / Compose** — сервис уже поднят в общем `docker-compose.yml` с томом
  `./data/uploads:/app/uploads`.

## Запуск в проекте

`docker compose up --build -d` — контейнер `ttk-cv-worker` стартует в режиме
`watch` и каждые 5 секунд проверяет `/app/uploads`.

Результаты складываются в `/app/uploads/panoramas`, а бэкенд раздаёт их по
`http://localhost:8000/uploads/panoramas/<name>.webp`.

## Как это работает

1. Одиночные изображения в `/app/uploads` сжимаются в full + preview.
2. Подпапка с 2+ изображениями считается набором кадров и сшивается в панораму
   с именем этой подпапки.
3. Для каждой панорамы пишется `<name>.json` — манифест с `url`,
   `previewUrl`, размерами и списком исходных кадров. Он совместим с типом
   `Panorama` из `shared/types.ts`.
4. Обработанные файлы запоминаются в `.cv-worker-state.json` по размеру и
   mtime, поэтому повторно они не обрабатываются.

Пример структуры загрузок:

```
data/uploads/
├── incoming/                 # необязательно, можно и в корень
│   ├── lobby/                # 2+ кадра -> сшивка
│   │   ├── frame_01.jpg
│   │   ├── frame_02.jpg
│   │   └── frame_03.jpg
│   └── ready_pano.jpg        # готовое 2:1 фото -> только сжатие
└── panoramas/                # создаёт воркер
    ├── lobby.webp
    ├── lobby_preview.webp
    └── lobby.json
```

## CLI

```bash
# Сжать готовые панорамы
python worker.py compress path/to/pano.jpg -o uploads/panoramas

# Сшить кадры и сразу сделать WebP
python worker.py stitch shots/*.jpg -n lobby -o uploads/panoramas

# Один проход по папке (удобно в cron / CI)
python worker.py watch -i data/uploads -o data/uploads/panoramas --once

# Постоянное наблюдение
python worker.py watch -i data/uploads -o data/uploads/panoramas --interval 5
```

Полезные флаги: `--preview-width`, `--max-width`, `--quality-full`,
`--quality-preview`, `--no-crop`, `--public-prefix`.

Переменные окружения: `CV_INPUT_DIR`, `CV_OUTPUT_DIR`, `CV_WATCH_INTERVAL`,
`CV_PUBLIC_PREFIX`, `CV_LOG_LEVEL`.

## Тесты

```bash
pip install -r requirements.txt -r requirements-dev.txt
python -m pytest -q
```

## Ограничения

- OpenCV Stitcher требует перекрытия ~30% между соседними кадрами.
- Для настоящей equirectangular-панорамы нужен полный оборот 360°; если кадров
  меньше, скрипт честно вернёт ошибку сшивки, а не битую картинку.
- Сшивка выполняется последовательно: для хакатона этого достаточно, при
  нагрузке стоит вынести задачи в очередь (Redis/RQ или Celery).
