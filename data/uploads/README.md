# Директория загрузок: что здесь есть и что будет

Эта папка (`data/uploads`) монтируется в контейнеры как `/app/uploads`:

- `cv-worker` следит за ней и складывает результаты в `panoramas/`;
- `backend` раздаёт файлы по `http://localhost:8000/uploads/...`;
- клиент и админка могут забирать готовые панорамы из `panoramas/index.json`.

Правила обработки:

- одиночное изображение в корне или в любой папке верхнего уровня сжимается в full + preview;
- папка с 2 и более изображениями считается набором кадров и сшивается в панораму с именем этой папки;
- результат всегда попадает в `panoramas/` как `<name>.webp`, `<name>_preview.webp` и `<name>.json`;
- после прохода дополнительно пишется `panoramas/index.json`.

---

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
    ├── demo-lobby.webp           104 146 B   4096x2048
    ├── demo-lobby_preview.webp    28 006 B   превью
    ├── demo-lobby.json             407 B     старый манифест
    ├── lobby360.webp             999 494 B   1796x898 (сшито из 3 кадров)
    ├── lobby360_preview.webp     206 456 B   превью
    └── lobby360.json               559 B     старый манифест
```

### Важно про текущие манифесты

`demo-lobby.json` и `lobby360.json` созданы старой версией воркера. В них пока нет:

- `previewWidth` / `previewHeight`;
- `floorId`, `x`, `y`, `yawOffset`;
- `hotspots`.

Файла `panoramas/index.json` пока тоже нет.

При следующем запуске `cv-worker` эти панорамы пересоберутся автоматически: изменился формат fingerprint состояния, поэтому старые записи не совпадут. После пересборки появятся новые поля и `index.json`.

---

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
  --once --settle-seconds 0
```

Посмотреть логи:

```bash
docker compose logs -f cv-worker
```

Проверить результат:

```bash
ls -la data/uploads/panoramas
cat data/uploads/panoramas/index.json
```

Бэкенд раздаёт файлы так:

```text
http://localhost:8000/uploads/panoramas/lobby360.webp
http://localhost:8000/uploads/panoramas/lobby360_preview.webp
```

---

## Что будет после пересборки

### 1. Полноценные манифесты

`demo-lobby.json` и `lobby360.json` получат поля, совместимые с `Panorama` из `shared/types.ts`:

```json
{
  "id": "lobby360",
  "type": "panorama",
  "url": "/uploads/panoramas/lobby360.webp",
  "previewUrl": "/uploads/panoramas/lobby360_preview.webp",
  "width": 1796,
  "height": 898,
  "previewWidth": 1024,
  "previewHeight": 512,
  "floorId": "",
  "x": 0,
  "y": 0,
  "yawOffset": 0,
  "hotspots": [],
  "sourceFrames": ["..."],
  "createdAt": "..."
}
```

`floorId`, `x`, `y` и `hotspots` можно задать явно:

```bash
docker compose exec cv-worker python worker.py stitch /app/uploads/lobby360/*.jpg \
  -n lobby360 \
  -o /app/uploads/panoramas \
  --public-prefix /uploads/panoramas \
  --floor-id floor-1 \
  --x 600 --y 400 \
  --confidence-thresh 0.8
```

### 2. Хотспоты

Можно положить рядом с кадрами:

```
data/uploads/lobby360/hotspots.json
```

Формат — JSON-массив объектов. Для одиночного изображения работает `<name>.hotspots.json`, также есть флаг `--hotspots-file`.

### 3. Каталог панорам

Появится `panoramas/index.json`:

```json
{
  "generatedAt": "...",
  "count": 2,
  "panoramas": [
    { "id": "demo-lobby", "url": "/uploads/panoramas/demo-lobby.webp", "...": "..." },
    { "id": "lobby360", "url": "/uploads/panoramas/lobby360.webp", "...": "..." }
  ]
}
```

Его должны читать бэкенд и клиент, чтобы не сканировать папку вручную.

---

## Что планируется дальше

Ближайшие задачи по `cv-worker`:

1. `--once` должен возвращать ненулевой код, если были ошибки обработки.
2. Lock-файл, чтобы два воркера не писали в одну папку одновременно.
3. Запуск контейнера не от root и `HEALTHCHECK`.
4. Обработка коллизий имён: `a.jpg` и `a.png` сейчас перезаписывают друг друга.
5. Очистка устаревших результатов, если исходники удалили.
6. Очередь задач при большой нагрузке (сейчас сшивка последовательная).

Задачи по интеграции, которые касаются соседних папок:

1. Backend: `GET /api/panoramas` из `index.json` или перенос панорам в `Venue.floors[].panoramas`.
2. Backend: поле `folder` в `POST /api/upload`, чтобы загружать 2+ кадра в подпапку и запускать сшивку.
3. Клиент: брать `url`, `previewUrl` и `hotspots` из манифестов, а не хардкодить.
4. Админка: после загрузки кадров обновлять список панорам из `index.json` и сохранять `floorId/x/y`.

---

## Правила именования

- Имя панорамы = имя папки с кадрами (для сшивки) или имя файла без расширения (для сжатия).
- Не используйте одинаковые имена для разных панорам: результат перезапишется.
- Для новой панорамы создайте новую папку с 2+ кадрами и положите туда `hotspots.json`, если нужны хотспоты.
- Этот `README.md` воркер не обрабатывает: он реагирует только на изображения.
