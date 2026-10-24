# Директория загрузок: что здесь есть и как это работает

Эта папка (`data/uploads`) монтируется в контейнеры как `/app/uploads`:

- `cv-worker` следит за ней и складывает результаты в `panoramas/`;
- `backend` раздаёт файлы по `http://localhost:8000/uploads/...`;
- каталог готовых панорам доступен по `GET /api/panoramas` и лежит в
  `panoramas/index.json`;
- клиент и админка берут оттуда `url`, `previewUrl`, `hotspots` и метаданные.

## Правила обработки

- одиночное изображение в корне папки сжимается в full + preview;
- папка с 2 и более изображениями считается набором кадров и сшивается в
  панораму с именем этой папки;
- результат всегда попадает в `panoramas/` как `<name>.webp`,
  `<name>_preview.webp` и `<name>.json`;
- после прохода перезаписывается `panoramas/index.json`;
- файлы, изменённые менее 2 секунд назад, откладываются до следующего прохода;
- одинаковые имена разводятся (`a.jpg`/`a.png` → `a__jpg`/`a__png`), а не
  перезаписывают друг друга;
- `--prune` удаляет результаты, исходники которых исчезли.

## Что уже есть

```
data/uploads/
├── demo-lobby.png                 36 976 B    готовое 2:1 изображение
├── lobby360/
│   ├── f1.jpg                    651 643 B   кадр 1
│   ├── f2.jpg                    651 754 B   кадр 2
│   └── f3.jpg                    651 715 B   кадр 3
└── panoramas/
    ├── .cv-worker-state.json                  состояние обработки
    ├── .cv-worker.lock                        lock-файл воркера
    ├── .cv-worker-heartbeat                   heartbeat для HEALTHCHECK
    ├── demo-lobby.webp           104 146 B    4096x2048
    ├── demo-lobby_preview.webp    28 006 B    превью 1024x512
    ├── demo-lobby.json                        манифест
    ├── lobby360.webp                          сшито из 3 кадров
    ├── lobby360_preview.webp                  превью
    ├── lobby360.json                          манифест
    └── index.json                             каталог панорам
```

Манифесты и `index.json` пересобраны актуальной версией воркера: в них есть
`previewWidth`/`previewHeight`, `createdAt`, `sourceFramesCount`, `floorId`,
`x`, `y`, `yawOffset`, `hotspots`. Внутренние пути контейнера не публикуются.

## Как пересобрать и проверить

Поднять сервисы:

```bash
docker compose up -d backend cv-worker
```

Один проход без ожидания «успокоения» файлов:

```bash
docker compose exec cv-worker python worker.py watch \
  -i /app/uploads \
  -o /app/uploads/panoramas \
  --once --settle-seconds 0 --public-prefix /uploads/panoramas
```

Посмотреть логи и состояние:

```bash
docker compose logs -f cv-worker
ls -la data/uploads/panoramas
cat data/uploads/panoramas/index.json
```

Проверить API:

```bash
curl http://localhost:8000/api/panoramas
curl -I http://localhost:8000/uploads/panoramas/lobby360.webp
curl -I http://localhost:8000/uploads/panoramas/lobby360_preview.webp
```

## Как задать метаданные панорамы

`floorId`, `x`, `y`, `yawOffset` и `hotspots` можно задать при явной сшивке:

```bash
docker compose exec cv-worker python worker.py stitch /app/uploads/lobby360/*.jpg \
  -n lobby360 \
  -o /app/uploads/panoramas \
  --public-prefix /uploads/panoramas \
  --floor-id floor-1 \
  --x 600 --y 400 \
  --hotspots-file /app/uploads/lobby360/hotspots.json
```

Или для одиночного изображения `demo-lobby.png` — файл
`demo-lobby.hotspots.json` рядом с исходником. Метаданные и содержимое
хотспотов входят в fingerprint, поэтому повторный запуск без изменения
исходников обновит манифест.

## Загрузка через API

Один файл:

```bash
curl -F "file=@pano.jpg" http://localhost:8000/api/upload
```

Набор кадров для сшивки — в папку `lobby`:

```bash
curl -F "file=@frame_01.jpg" -F "folder=lobby" http://localhost:8000/api/upload
curl -F "file=@frame_02.jpg" -F "folder=lobby" http://localhost:8000/api/upload
```

Имя папки ограничено `[A-Za-z0-9_-]`, имя файла санитизируется, размер
ограничен `TTK_MAX_UPLOAD_BYTES` (по умолчанию 25 МБ).

## Правила именования

- Имя панорамы = имя папки с кадрами (для сшивки) или имя файла без
  расширения (для сжатия).
- При коллизии имён воркер добавит суффикс (`__jpg`, `__png`, `__stitch`).
- Для новой панорамы создайте новую папку с 2+ кадрами и положите туда
  `hotspots.json`, если нужны хотспоты.
- Этот `README.md` воркер не обрабатывает: он реагирует только на изображения.
