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
`http://localhost:8000/uploads/panoramas/<name>.webp` и отдаёт каталог через
`GET /api/panoramas`.

Контейнер запускается не от root (UID/GID по умолчанию `1000:1000`) и имеет
`HEALTHCHECK` по heartbeat-файлу. Если на Linux ваш UID отличается, пересоберите
образ с нужными значениями:

```bash
CV_UID=$(id -u) CV_GID=$(id -g) docker compose up --build -d cv-worker
```

## Как это работает

1. Одиночные изображения в `/app/uploads` сжимаются в full + preview.
2. Подпапка с 2+ изображениями считается набором кадров и сшивается в панораму
   с именем этой подпапки.
3. Для каждой панорамы пишется `<name>.json` — публичный манифест с `url`,
   `previewUrl`, размерами (включая `previewWidth`/`previewHeight`),
   `createdAt`, количеством исходных кадров (`sourceFramesCount`) и полями
   `Panorama`: `floorId`, `x`, `y`, `yawOffset`, `hotspots`. Внутренние пути
   контейнера (`full`, `preview`, `source`, `sourceFrames`) в манифест не
   попадают. Если `--public-prefix` не задан, URL будут относительными
   (`lobby.webp`), иначе — `/uploads/panoramas/lobby.webp`; имена
   URL-кодируются.
4. Хотспоты можно положить рядом с кадрами в `hotspots.json` (для сшивки) или
   в `<name>.hotspots.json` (для одиночного изображения); также работает
   `--hotspots-file`.
5. После прохода пишется `index.json` — каталог всех манифестов с `count` и
   `panoramas`, чтобы не сканировать папку снаружи.
6. Обработанные файлы запоминаются в `.cv-worker-state.json` по размеру,
   mtime, параметрам сжатия, опциям сшивки, `--public-prefix`, метаданным
   `floorId/x/y/yawOffset`, содержимому хотспотов и версии схемы манифеста.
   Изменение любого из этих параметров пересобирает результат.
7. Файлы, изменённые менее `--settle-seconds` назад, пропускаются — это
   защищает от обработки недописанного upload. Если хотя бы один из
   `*.webp`/`*_preview.webp`/`*.json` пропал или манифест повреждён,
   панорама пересобирается.
8. Запись WebP, манифестов, state и `index.json` атомарная: сначала во
   временный файл, затем `os.replace`, поэтому оборванная обработка не
   оставляет битых результатов.
9. Одинаковые имена разводятся: `a.jpg` и `a.png` дадут `a__jpg`/`a__png`,
   папка `lobby` и файл `lobby.jpg` — `lobby__stitch`/`lobby__jpg`.
   Это защищает от молчаливой перезаписи.
10. Параллельные проходы защищены lock-файлом `.cv-worker.lock`; в начале и в
    конце каждого прохода обновляется `.cv-worker-heartbeat` для Docker
    `HEALTHCHECK`.
11. `--prune` удаляет `<name>.webp`, `<name>_preview.webp` и `<name>.json`,
    если исходники задачи исчезли. Без флага старые результаты остаются.

Пример структуры загрузок:

```
data/uploads/
├── incoming/                 # необязательно, можно и в корень
│   ├── lobby/                # 2+ кадра -> сшивка
│   │   ├── frame_01.jpg
│   │   ├── frame_02.jpg
│   │   ├── frame_03.jpg
│   │   └── hotspots.json     # необязательно
│   └── ready_pano.jpg        # готовое 2:1 фото -> только сжатие
└── panoramas/                # создаёт воркер
    ├── lobby.webp
    ├── lobby_preview.webp
    ├── lobby.json
    └── index.json
```

## CLI

```bash
# Сжать готовые панорамы
python worker.py compress path/to/pano.jpg -o uploads/panoramas

# Сшить кадры и сразу сделать WebP
python worker.py stitch shots/*.jpg -n lobby -o uploads/panoramas

# Один проход по папке (удобно в cron / CI).
# При ошибках хотя бы одной задачи код возврата будет 1.
python worker.py watch -i data/uploads -o data/uploads/panoramas --once

# Постоянное наблюдение (ошибки логируются, цикл продолжается, код 0 при SIGTERM)
python worker.py watch -i data/uploads -o data/uploads/panoramas --interval 5

# Один проход без ожидания «успокоения» файлов (например, в CI)
python worker.py watch -i data/uploads -o data/uploads/panoramas --once --settle-seconds 0

# Удалить результаты, чьи исходники больше не лежат в input-dir
python worker.py watch -i data/uploads -o data/uploads/panoramas --once --prune

# Сшивка с явными хотспотами и метаданными для Panorama
python worker.py stitch shots/*.jpg -n lobby -o uploads/panoramas \
  --floor-id floor-1 --x 600 --y 400 --hotspots-file shots/hotspots.json
```

Полезные флаги сжатия: `--preview-width`, `--max-width`, `--quality-full`,
`--quality-preview`, `--no-crop`, `--public-prefix`.

Особенности CLI:

- `compress` и `stitch` возвращают `1`, если хотя бы один файл не обработан
  или не удалось взять lock.
- `watch --once` возвращает `1`, если в проходе были ошибки. Это позволяет
  использовать его в CI и health-проверках.
- Постоянный `watch` не завершается из-за битого файла: ошибка логируется,
  остальные задачи в проходе продолжают обрабатываться.
- Имена задач санитизируются: `-n ../escape` и имена с разделителями пути
  отклоняются.

Метаданные манифеста: `--floor-id`, `--x`, `--y`, `--yaw-offset`,
`--hotspots-file`.

Тюнинг OpenCV Stitcher: `--confidence-thresh`, `--registration-resol`,
`--seam-resol`, `--compositing-resol`, `--no-wave-correction`.

Переменные окружения: `CV_INPUT_DIR`, `CV_OUTPUT_DIR`, `CV_WATCH_INTERVAL`,
`CV_SETTLE_SECONDS`, `CV_PUBLIC_PREFIX`, `CV_FLOOR_ID`, `CV_X`, `CV_Y`,
`CV_YAW_OFFSET`, `CV_CONFIDENCE_THRESH`, `CV_REGISTRATION_RESOL`,
`CV_SEAM_RESOL`, `CV_COMPOSITING_RESOL`, `CV_LOG_LEVEL`.

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
