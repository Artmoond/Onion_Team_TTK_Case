# 🗺️ Карта Пространства — ТТК

Сервис интерактивной навигации внутри зданий и на мероприятиях: организатор собирает многоэтажную карту в визуальной студии, а посетитель открывает её на смартфоне, строит маршрут и смотрит 360°-панорамы.

В репозитории — два независимых веб-интерфейса, REST API и фоновый воркер обработки панорам. Всё запускается через Docker Compose.

> **Статус:** демонстрационный MVP для хакатона. Основной сценарий «редактор → публикация → маршрут → 360°-тур» работает. Актуальные ограничения перечислены в разделе «Известные ограничения» ниже.

---

## ✨ Что умеет

### 📱 Клиент посетителя (`frontend-client`)

- интерактивный 2D-план этажей: масштабирование, панорамирование, pinch-to-zoom;
- поиск по точкам интереса, фильтры по категориям, переход между этажами;
- карточка POI с описанием, фото и привязанной панорамой;
- маршрут от входа до выбранной точки: расчёт на backend, при недоступности API — локальный A*;
- пошаговая навигация и режим «виртуальная прогулка» по панорамам;
- 360°-тур на Pannellum: хотспоты, переходы между сценами, автовращение;
- гироскоп через `DeviceOrientation` (на мобильных браузерах требует HTTPS);
- PWA: manifest, service worker и кэширование статики для офлайн-старта;
- вход и регистрация с ролью `user`.

### 🛠 Студия организатора (`frontend-admin`)

- создание проекта с нуля, демо-карта и загрузка опубликованной карты с backend;
- несколько этажей: добавление, удаление, переименование, порядок;
- загрузка плана этажа (JPEG/PNG/WebP/SVG) drag-and-drop;
- инструменты разметки: стены, помещения, лестницы, калибровка масштаба;
- расстановка POI, расширенные типы точек и их настройки;
- привязка 360°-панорам к точкам, превью и замена файла;
- undo/redo, горячие клавиши, локальный черновик в `localStorage`;
- локальные файлы в IndexedDB — можно работать без backend;
- публикация: загрузка ассетов через `POST /api/upload` и сохранение карты через `PUT /api/venues/{slug}`;
- QR-код и ссылка на публичную карту, экспорт QR в PNG;
- вход только с ролью `admin` (регистрация по инвайт-коду).

### 🚀 Backend (`backend`)

- FastAPI + Pydantic v2, Swagger UI на `/docs`;
- A* по графу коридоров с расчётом расстояния и времени;
- публичное API карты и маршрута, админское API площадок и загрузок;
- JWT-авторизация: access/refresh, роли `user`/`admin`, отзыв сессий;
- защита от перебора, лимиты по IP, bcrypt, security-заголовки, CORS-whitelist;
- сохранение опубликованных площадок в JSON и загруженных файлов на диск;
- раздача `/uploads/*` и каталога панорам `/api/panoramas`.

### 📷 CV Worker (`cv-worker`)

- сшивка перекрывающихся кадров через OpenCV Stitcher;
- кроп под equirectangular 2:1 и сжатие в WebP;
- два размера: полный (до 4096 px) и быстрый preview 1024×512;
- манифест `<name>.json` и общий каталог `index.json` для backend и клиента;
- режим `watch`: автоматическая обработка файлов в `data/uploads`;
- атомарная запись, защита от параллельных запусков, `HEALTHCHECK`, `--prune`.

---

## ⚡ Быстрый старт (Docker)

Нужен только Docker с Docker Compose v2. Ставить Python, Node.js и базы данных вручную не требуется.

```bash
git clone <url-репозитория>
cd Onion_Team_TTK_Case
```

| ОС | Запуск |
| :--- | :--- |
| **Windows** | дважды кликнуть `start.bat` или выполнить `.\start.ps1` |
| **macOS / Linux** | `./start.sh` |

Скрипт сам проверит Docker, соберёт образы, поднимет четыре сервиса и дождётся ответа backend.

### Адреса в режиме разработки

| Сервис | Адрес |
| :--- | :--- |
| Клиент посетителя | [https://localhost:3000](https://localhost:3000) |
| Студия организатора | [http://localhost:3001](http://localhost:3001) |
| Backend API | [http://localhost:8000](http://localhost:8000) |
| Swagger UI | [http://localhost:8000/docs](http://localhost:8000/docs) |
| Health-check | [http://localhost:8000/api/health](http://localhost:8000/api/health) |

> В dev-режиме клиент запускается по **HTTPS с самоподписанным сертификатом** (Vite `@vitejs/plugin-basic-ssl`). Это нужно, чтобы на телефоне работали датчики и PWA. При первом открытии браузер покажет предупреждение — его нужно принять. Студия и API остаются на HTTP.

Полезные команды:

```bash
docker compose ps                 # состояние контейнеров
docker compose logs -f            # логи всех сервисов
docker compose logs -f backend    # логи одного сервиса
docker compose up -d --build      # пересобрать и поднять
./stop.sh                         # остановить (Windows: stop.bat / .\stop.ps1)
```

После запуска `start.sh` / `start.ps1` автоматически показывает live-логи. Выход из логов — `Ctrl+C`, контейнеры продолжат работать.

---

## 🔐 Демо-доступы

Демо-аккаунты создаются при первом старте backend, если не отключить `TTK_SEED_DEMO_USERS`.

| Роль | Портал | Email | Пароль |
| :--- | :--- | :--- | :--- |
| Организатор | `http://localhost:3001` | `admin@ttk.example.com` | `Admin12345!` |
| Посетитель | `https://localhost:3000` | `user@ttk.example.com` | `User12345!` |

Код регистрации организатора по умолчанию: **`TTK-ADMIN-2026`**. Посетитель регистрируется без кода.

> ⚠️ Для боевого запуска обязательно задайте свои `TTK_JWT_SECRET`, `TTK_ADMIN_PASSWORD`, `TTK_USER_PASSWORD` и `TTK_ADMIN_INVITE_CODE` в `.env`. Не используйте демо-пароли в интернете.

Подробнее про токены, лимиты и переменные авторизации — в [`backend/README.md`](backend/README.md).

---

## 🧭 Проверка за 5 минут

1. Запустите `start.sh` / `start.ps1`.
2. Откройте студию `http://localhost:3001` и войдите как организатор.
3. Нажмите **«Открыть демо-карту»** — загрузится «Инновационный Экспоцентр ТТК».
4. Перетащите POI, измените его свойства или добавьте новую точку.
5. Нажмите **«Опубликовать»** — редактор загрузит файлы и сохранит карту на backend.
6. Скопируйте публичную ссылку или откройте QR-код.
7. Перейдите по ссылке вида `https://localhost:3000/m/ttk-expo`, войдите как посетитель.
8. Выберите точку и постройте маршрут, откройте 360°-панораму и включите виртуальную прогулку.

Опубликованная карта сохраняется в `data/uploads/venues/<slug>.json` и переживает перезапуск контейнеров.

> В dev-режиме backend по умолчанию формирует ссылку `http://localhost:3000`, а клиент работает по HTTPS. Если QR ведёт на HTTP, задайте `PUBLIC_MAP_BASE_URL=https://localhost:3000` в окружении сервиса `backend` (`docker-compose.yml`). В production эта переменная задаётся в `.env`.

> Ссылка `/m/{slug}` сейчас всё равно приводит на экран входа: карта доступна после входа с ролью `user`. Режим гостя без аккаунта пока не реализован.

---

## 🏗 Архитектура

### Режим разработки

```text
┌─────────────────────────┐
│ frontend-client :3000   │  мобильный клиент (Vite + HTTPS)
└───────────┬─────────────┘
            │ /api/public, /api/auth
┌───────────▼─────────────┐        ┌──────────────────────────┐
│ backend :8000           │───────▶│ data/uploads/            │
│ FastAPI + A* + Auth     │        │  ├─ venues/<slug>.json   │
└───────────┬─────────────┘        │  ├─ panoramas/           │
            │                      │  └─ загруженные файлы    │
┌───────────▼─────────────┐        └────────────▲─────────────┘
│ frontend-admin :3001    │                     │
│ React + Konva           │        ┌────────────┴─────────────┐
└─────────────────────────┘        │ cv-worker (watch)        │
                                   │ OpenCV + Pillow          │
                                   └──────────────────────────┘
```

- **Клиент** читает карту через `GET /api/public/{slug}` и строит маршрут через `POST /api/public/{slug}/route`.
- **Админка** авторизуется, загружает файлы в `/api/upload` и публикует карту через `PUT /api/venues/{slug}`.
- **Backend** держит площадки в памяти и сохраняет их в JSON, чтобы данные не терялись при рестарте.
- **cv-worker** не общается с API: он наблюдает за `data/uploads` и складывает готовые панорамы в `data/uploads/panoramas`.

### Продакшен-режим

```text
Браузер ── :80/:443 ──▶ Nginx Gateway
                         ├── /            → frontend-client (Nginx + статика)
                         ├── /admin/      → frontend-admin  (Nginx + статика)
                         ├── /api/, /docs → backend
                         └── /uploads/    → backend → data/uploads
```

Единая точка входа, скомпилированные SPA вместо dev-серверов, non-root пользователи и `restart: always`. Подробности — в [`DEPLOYMENT.md`](DEPLOYMENT.md).

### Где хранятся данные

| Путь | Что там |
| :--- | :--- |
| `data/uploads/` | загруженные планы, исходные кадры, панорамы |
| `data/uploads/venues/<slug>.json` | опубликованные карты площадок |
| `data/uploads/panoramas/index.json` | каталог панорам, который формирует `cv-worker` |
| `backend/data/auth.db` | SQLite с пользователями и сессиями в dev-режиме |
| `data/auth.db` | SQLite в продакшен-режиме (`docker-compose.prod.yml`) |

Каталоги `data/uploads/`, `backend/data/` и файлы `*.db` исключены из Git.

---

## 📁 Структура репозитория

```text
.
├── backend/                    FastAPI, A*, авторизация, загрузки
│   ├── app/main.py             API и раздача /uploads
│   ├── app/auth/               JWT, bcrypt, роли, rate limiting, SQLite
│   ├── app/core/pathfinder.py  алгоритм A*
│   └── data/                   локальная SQLite (не коммитится)
├── frontend-client/            мобильный клиент посетителя, PWA
│   ├── src/components/         карта, POI, маршрут, 360°, авторизация
│   └── public/                 manifest, service worker, демо-панорамы
├── frontend-admin/             студия организатора
│   ├── src/components/editor/  холст Konva: стены, комнаты, лестницы
│   ├── src/services/           API, IndexedDB, публикация
│   └── docs/INTEGRATION.md     контракты и совместимость
├── cv-worker/                  сшивка и сжатие панорам
│   ├── stitcher.py             OpenCV + Pillow, манифесты
│   ├── worker.py               CLI и режим watch
│   └── tests/                  pytest
├── shared/                     общие контракты
│   ├── types.ts                TypeScript-модели Venue/Floor/POI/Panorama
│   └── mock_venue.json         эталонная демо-площадка ttk-expo
├── nginx/nginx.conf            конфигурация production-шлюза
├── tools/                      LAN-мост для WSL2 и cloudflared
├── data/uploads/               пользовательские данные (не коммитится)
├── docker-compose.yml          dev-стек
├── docker-compose.prod.yml     production-стек
├── start.* / stop.*            запуск и остановка dev-стека
├── deploy.* / undeploy.*       production-деплой
├── .env.example                шаблон production-настроек
├── DEPLOYMENT.md               инструкция по развёртыванию
└── README.md
```

---

## 🔌 API

Полная интерактивная документация — [http://localhost:8000/docs](http://localhost:8000/docs).

### Публичные и служебные ручки

| Метод | Путь | Назначение |
| :--- | :--- | :--- |
| `GET` | `/api/health` | статус backend и количество площадок |
| `GET` | `/api/public/{slug}` | опубликованная карта площадки |
| `POST` | `/api/public/{slug}/route` | построение маршрута |
| `GET` | `/api/panoramas` | каталог панорам из `index.json` |
| `GET` | `/uploads/*` | загруженные планы и панорамы |

### Авторизация

| Метод | Путь | Доступ |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | публично; для `admin` нужен `adminInviteCode` |
| `POST` | `/api/auth/login` | публично; `role` проверяет нужный портал |
| `POST` | `/api/auth/refresh` | по refresh-токену, с ротацией |
| `POST` | `/api/auth/logout` | авторизованный; отзывает все сессии |
| `GET` | `/api/auth/me` | авторизованный |
| `POST` | `/api/auth/change-password` | авторизованный |

Защищённые запросы передают `Authorization: Bearer <accessToken>`.

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@ttk.example.com","password":"Admin12345!","role":"admin"}'
```

Токены: access — 30 минут, refresh — 7 дней с ротацией. Повторное использование старого refresh-токена отзывает все сессии пользователя. Выход инкрементирует версию токенов и мгновенно закрывает доступ.

### Ручки организатора

Требуют роль `admin`.

| Метод | Путь | Назначение |
| :--- | :--- | :--- |
| `GET` | `/api/venues` | список опубликованных площадок |
| `GET` | `/api/venues/{slug}` | площадка по slug |
| `PUT` | `/api/venues/{slug}` | сохранить/опубликовать площадку |
| `POST` | `/api/upload` | загрузить файл; необязательное поле `folder` |

`POST /api/upload` принимает `file` и `folder` (`[A-Za-z0-9_-]{1,64}`), проверяет расширение и размер (25 МБ по умолчанию), санитизирует имя и защищает от path traversal. Если в одну папку загрузить 2+ кадра, `cv-worker` воспримет её как набор для сшивки.

### Пример маршрута

```bash
curl -X POST http://localhost:8000/api/public/ttk-expo/route \
  -H 'Content-Type: application/json' \
  -d '{"fromPoiId":"poi-entrance","toPoiId":"poi-food"}'
```

Ответ содержит `totalDistanceMeters`, `estimatedDurationSeconds`, `legs[].points`, `steps` и `panoramas` — список панорам для виртуальной прогулки.

### Контракт панорам от cv-worker

`cv-worker` складывает результаты в `data/uploads/panoramas` и пишет общий `index.json`. Backend отдаёт его через `GET /api/panoramas` без преобразований:

```json
{
  "generatedAt": "2026-10-24T08:00:00+00:00",
  "count": 1,
  "panoramas": [
    {
      "id": "lobby",
      "type": "panorama",
      "url": "/uploads/panoramas/lobby.webp",
      "previewUrl": "/uploads/panoramas/lobby_preview.webp",
      "width": 4096,
      "height": 2048,
      "previewWidth": 1024,
      "previewHeight": 512,
      "floorId": "floor-1",
      "x": 600,
      "y": 400,
      "yawOffset": 0,
      "hotspots": []
    }
  ]
}
```

Поля совпадают с `Panorama` из [`shared/types.ts`](shared/types.ts), поэтому маппинг минимальный.

> Сейчас клиент берёт панорамы из самой карты (`venue.floors[].panoramas`). Автоматического переноса записей из `index.json` в опубликованную площадку нет: результат сшивки нужно указать в карте или добавить синхронизацию на backend.

---

## ⚙️ Конфигурация

### Dev-режим

`docker-compose.yml` уже содержит рабочие значения по умолчанию. Для изменения секретов и паролей можно создать `.env` в корне — Compose подхватит переменные.

### Production-режим

```bash
cp .env.example .env
```

| Переменная | По умолчанию | Назначение |
| :--- | :--- | :--- |
| `TTK_JWT_SECRET` | dev/prod-заглушка | секрет подписи JWT; обязательно сменить |
| `TTK_ADMIN_EMAIL` / `TTK_ADMIN_PASSWORD` | `admin@ttk.example.com` / `Admin12345!` | демо-организатор |
| `TTK_USER_EMAIL` / `TTK_USER_PASSWORD` | `user@ttk.example.com` / `User12345!` | демо-посетитель |
| `TTK_ADMIN_INVITE_CODE` | `TTK-ADMIN-2026` | код регистрации организатора |
| `PUBLIC_MAP_BASE_URL` | `http://localhost:3000` (dev) / `http://localhost` (prod) | база публичных ссылок и QR |
| `TTK_CORS_ORIGINS` | localhost:3000/3001 | разрешённые origin через запятую |
| `TTK_TRUST_PROXY` | `false` (dev) / `true` (prod) | доверять `X-Forwarded-For` только за реальным прокси |
| `TTK_AUTH_DB` | `/app/data/auth.db` | путь к SQLite |
| `TTK_UPLOAD_DIR` | `/app/uploads` | каталог загрузок |
| `TTK_MAX_UPLOAD_BYTES` | `26214400` | лимит файла (25 МБ) |
| `PORT_HTTP`, `PORT_BACKEND`, `PORT_CLIENT`, `PORT_ADMIN` | `80`, `8000`, `3000`, `3001` | внешние порты production-стека |

> Для QR-кодов и ссылок в проде обязательно указывайте реальный адрес в `PUBLIC_MAP_BASE_URL`, иначе они будут вести на `localhost`.

### Frontend-переменные

| Переменная | Где | Назначение |
| :--- | :--- | :--- |
| `VITE_API_URL` | оба фронтенда | адрес backend API |
| `VITE_ADMIN_URL` | клиент | ссылка переключения на студию |
| `VITE_CLIENT_URL` | админка | ссылка переключения на клиент |
| `VITE_PUBLIC_MAP_BASE_URL` | админка | резервная база ссылки `/m/<slug>` |

Если `VITE_API_URL` не задан, фронтенды обращаются к API на текущем хосте, порт `8000` (кроме `localhost`/`127.0.0.1`, где используется `http://localhost:8000`).

Настройки `cv-worker` (`CV_INPUT_DIR`, `CV_OUTPUT_DIR`, `CV_WATCH_INTERVAL`, `CV_PUBLIC_PREFIX` и тюнинг Stitcher) описаны в [`cv-worker/README.md`](cv-worker/README.md).

---

## 🛠 Разработка без Docker

Понадобятся Python 3.11+, Node.js 18+ (рекомендуется 20/22) и npm.

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt

mkdir -p ../data/uploads
export TTK_MOCK_FILE=../shared/mock_venue.json
export TTK_UPLOAD_DIR=../data/uploads
export TTK_AUTH_DB=../data/auth.db

uvicorn app.main:app --reload --port 8000
```

Swagger: [http://localhost:8000/docs](http://localhost:8000/docs).

### Клиент посетителя

```bash
cd frontend-client
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

Откроется `https://localhost:3000` (самоподписанный сертификат).

### Студия организатора

```bash
cd frontend-admin
npm install
npm run dev
```

Откроется [http://localhost:3001](http://localhost:3001). Доступны `npm run typecheck`, `npm run test`, `npm run build`.

### CV Worker

```bash
cd cv-worker
pip install -r requirements.txt -r requirements-dev.txt
python worker.py watch -i ../data/uploads -o ../data/uploads/panoramas --interval 5
```

Подробные команды `compress`, `stitch`, `watch --once`, `--prune` — в [`cv-worker/README.md`](cv-worker/README.md).

### Тесты и проверки

| Что | Команда |
| :--- | :--- |
| Типы админки | `cd frontend-admin && npm run typecheck` |
| Тесты админки | `cd frontend-admin && npm run test` |
| Сборка админки | `cd frontend-admin && npm run build` |
| Тесты cv-worker | `cd cv-worker && python -m pytest -q` |
| Сборка клиента | `cd frontend-client && npm run build` |

Автотестов для backend и клиента посетителя пока нет — проверяйте их через smoke-сценарий ниже.

---

## 🌐 Доступ с телефона и внешний туннель

### Телефон в той же Wi-Fi сети

1. Узнайте IP компьютера в локальной сети.
2. Запустите production-стек (`./deploy.sh` или `.\deploy.ps1`) — шлюз слушает порт 80.
3. Если Docker работает в WSL2 и порты не видны из LAN, запустите мост:

   ```bash
   python3 tools/lan_bridge.py
   ```

   Скрипт выведет адреса вида `http://192.168.x.x/`, `:3000`, `:3001`, `:8000`.

4. Откройте на телефоне `http://<IP>/` (клиент) и `http://<IP>/admin/` (студия).

Для гироскопа и PWA нужен HTTPS: либо настройте домен и сертификат по [`DEPLOYMENT.md`](DEPLOYMENT.md), либо используйте туннель.

### Cloudflare Quick Tunnel (Windows)

После запуска production-стека:

```powershell
.\tunnel.ps1
```

Скрипт скачает `cloudflared` в `tools/` (если его нет) и выведет временный адрес `https://<random>.trycloudflare.com`. Он проксирует Nginx-шлюз на `127.0.0.1:80`.

> Quick Tunnel не требует аккаунта Cloudflare и подходит только для демо: адрес меняется при каждом запуске, без SLA и гарантий. Для постоянной работы используйте домен и именованный туннель либо VPS с SSL.

Не забудьте указать публичный адрес в `PUBLIC_MAP_BASE_URL`, иначе QR-коды будут вести на `localhost`.

---

## 🚢 Production-деплой

```bash
./deploy.sh          # Linux / macOS
.\deploy.ps1         # Windows
```

Скрипт создаст `.env` с уникальным `TTK_JWT_SECRET`, подготовит `data/uploads`, соберёт production-образы и поднимет шлюз.

| URL | Сервис |
| :--- | :--- |
| `/` | клиент посетителя |
| `/admin/` | студия организатора |
| `/api/` | REST API |
| `/docs` | Swagger UI |
| `/uploads/` | планы и панорамы |

Прямые порты `3000`, `3001`, `8000` тоже проброшены для отладки. Остановка — `./undeploy.sh` или `.\undeploy.ps1`.

> ⚠️ Перед HTTPS-деплоем проверьте две build-переменные фронтендов. `VITE_API_URL` должен указывать на публичный origin шлюза (`https://map.example.com`), иначе клиент попытается обратиться к `<host>:8000`. Для студии за `/admin/` нужен `VITE_BASE_URL=/admin/`; в текущем `docker-compose.prod.yml` передаётся `/`, поэтому при проблемах с ассетами откройте студию напрямую на `:3001` или пересоберите её с корректным base path.

В [`DEPLOYMENT.md`](DEPLOYMENT.md) описаны:

- архитектура production-окружения и отличия от dev;
- настройка `.env`, домена и Let's Encrypt;
- резервное копирование `data/` и `.env`;
- hardening: non-root, security-заголовки, лимиты, rate limiting.

Минимальный бэкап:

```bash
tar -czvf ttk-backup-$(date +%F).tar.gz data/ .env
```

---

## 🧪 Smoke-проверка перед демонстрацией

1. `docker compose ps` — все четыре контейнера в состоянии `Up`.
2. `curl http://localhost:8000/api/health` — возвращает `{"status":"ok", ...}`.
3. Вход организатора в студию и открытие демо-карты.
4. Изменение POI → «Опубликовать» → перезагрузка страницы: изменения на месте.
5. `curl http://localhost:8000/api/public/ttk-expo` — содержит изменённые данные.
6. `docker compose restart backend` — опубликованная карта не пропала.
7. Клиент по `/m/ttk-expo` показывает план, точки, маршрут и 360°-панораму.
8. Загрузка 2–3 кадров в `data/uploads/<name>/` → в `data/uploads/panoramas/` появились `<name>.webp`, `<name>_preview.webp` и `index.json`.
9. QR-код открывает ту же карту на телефоне.
10. На телефоне включается гироскоп (нужен HTTPS) и работает PWA-режим.

---

## 🩺 Troubleshooting

### Docker не запускается

- Windows/macOS: проверьте, что запущен Docker Desktop.
- Linux: `sudo systemctl start docker`, при необходимости добавьте пользователя в группу `docker`.
- Проверьте, что доступен Docker Compose v2: `docker compose version`.

### `Permission denied` на Fedora / SELinux

Bind mount из домашней папки не имеет метки `container_file_t`. В `docker-compose.yml` тома уже помечены `:z`, поэтому пересоздайте контейнеры:

```bash
sudo docker compose down --remove-orphans
sudo ./start.sh
```

Если пересоздавать не хочется, переразметьте папки:

```bash
sudo chcon -R -t container_file_t backend shared data frontend-client frontend-admin cv-worker
ls -Zd backend data frontend-client frontend-admin
```

### Порт занят

Освободите `3000`, `3001`, `8000` (dev) или `80` (prod). В production-режиме порты меняются через `.env`: `PORT_HTTP`, `PORT_BACKEND`, `PORT_CLIENT`, `PORT_ADMIN`.

### Браузер ругается на сертификат

Это ожидаемо для dev-клиента на `https://localhost:3000`: используется самоподписанный сертификат. Примите предупреждение. Для телефона по LAN-IP сертификат тоже будет недоверенным — для демо это допустимо, для продакшена настройте домен и Let's Encrypt.

### Гироскоп не работает

Мобильные браузеры разрешают `DeviceOrientation` только в защищённом контексте. Откройте клиент по `https://` (production-домен или туннель) и разрешите доступ к датчикам. На iOS Safari разрешение запрашивается после нажатия кнопки «Гироскоп».

### Фронтенд не видит API с телефона

- Убедитесь, что backend доступен по адресу из `VITE_API_URL`.
- В Docker dev-режиме значения `VITE_API_URL` фиксированы на `localhost`; для телефона удобнее production-шлюз и `tools/lan_bridge.py`.
- Проверьте `TTK_CORS_ORIGINS`: origin телефона должен быть разрешён.

### 401 / 403

- Истёк access-token — клиент обновит его через refresh; если refresh отозван, потребуется повторный вход.
- Для админских ручек нужна роль `admin`, для клиента — `user`.
- После смены пароля или выхода старые токены перестают работать.

### Сбросить демо-данные

```bash
docker compose down
rm -rf data/uploads/*
rm -f backend/data/auth.db data/auth.db
docker compose up -d --build
```

Команда удалит опубликованные карты, загруженные панорамы и пользователей. Демо-аккаунты создадутся заново.

### `cv-worker` не обрабатывает файлы

- Проверьте логи: `docker compose logs -f cv-worker`.
- На Linux UID/GID контейнера должен совпадать с владельцем `data/uploads`:

  ```bash
  CV_UID=$(id -u) CV_GID=$(id -g) docker compose up -d --build cv-worker
  ```

- Новые файлы обрабатываются после `--settle-seconds` (по умолчанию 2 секунды), чтобы не читать недописанный upload.
- Для диагностики запустите один проход: `python worker.py watch -i data/uploads -o data/uploads/panoramas --once`.

---

## ⚠️ Известные ограничения

Это честный список для следующего разработчика. Часть пунктов — сознательные компромиссы MVP.

- **Публичная ссылка требует входа.** `/m/{slug}` открывает экран авторизации; гостевой режим не реализован.
- **Маршруты только по первому этажу.** Лестницы и связи этажей хранятся в карте, но backend строит путь по `venue.floors[0]`.
- **Fallback вместо 404.** Неизвестный `slug` в `/api/public/{slug}` отдаёт первую площадку, а неизвестный POI в маршруте — координаты по умолчанию. Для продакшена лучше возвращать `404`.
- **Панорамы вдоль маршрута не выбираются.** Backend отдаёт первые три панорамы этажа (`panos[:3]`), а не ближайшие к пути.
- **Нет полной валидации `PUT /api/venues/{slug}`.** Данные принимаются как `Dict[str, Any]`; основная проверка выполняется в админке.
- **Результаты `cv-worker` не попадают в карту автоматически.** `GET /api/panoramas` отдаёт `index.json`, но опубликованная площадка не обновляется сама — URL панорамы указывается в редакторе.
- **Масштаб эвристики A\*.** Эвристика считается в пикселях, а веса рёбер — в метрах. На сложных графах путь может быть неоптимальным; корректная формула — `h = расстояние_в_пикселях * metersPerPixel`.
- **Хранилище — MVP.** Площадки живут в памяти и JSON-файлах, авторизация — в SQLite. Нет миграций, ревизий и конкурентного редактирования.
- **Нет автотестов backend и клиента.** Есть тесты админки (Vitest) и `cv-worker` (pytest), а также ручной smoke-сценарий.
- **Quick Tunnel — только для демо.** Временный URL, без SLA и постоянного домена.

### Куда развивать

- гостевой доступ по ссылке и QR без регистрации;
- многоэтапная маршрутизация с лестницами и лифтами;
- строгая Pydantic-схема для публикации площадок и `404` вместо fallback;
- выбор панорам, ближайших к маршруту;
- автоматическая синхронизация `index.json` с `Venue.floors[].panoramas`;
- тесты API, клиента и e2e-сценарий публикации;
- очередь задач для `cv-worker` при росте нагрузки.

---

## 📚 Документация

| Документ | О чём |
| :--- | :--- |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | production-деплой, Nginx, SSL, бэкапы, hardening |
| [`backend/README.md`](backend/README.md) | API, авторизация, переменные окружения, безопасность |
| [`frontend-client/README.md`](frontend-client/README.md) | мобильный клиент, вход, запуск |
| [`frontend-admin/README.md`](frontend-admin/README.md) | студия, горячие клавиши, публикация |
| [`frontend-admin/REPORT.md`](frontend-admin/REPORT.md) | отчёт о разработке студии и проверках |
| [`frontend-admin/docs/INTEGRATION.md`](frontend-admin/docs/INTEGRATION.md) | расширения схемы и совместимость с backend/client |
| [`cv-worker/README.md`](cv-worker/README.md) | сшивка, WebP, CLI, манифесты, тесты |
| [`shared/types.ts`](shared/types.ts) | общие TypeScript-контракты |
| [`shared/mock_venue.json`](shared/mock_venue.json) | эталонный датасет демо-площадки |
