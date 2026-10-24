# 👤 Бэкенд и Архитектура (Участник №3)

## Ответственность
- REST API для мобильного клиента и админки.
- Алгоритм indoor-навигации $A^*$ (расчет расстояний, шагов и панорам вдоль пути).
- Авторизация и разграничение доступа по ролям.
- Развертывание в Docker и поддержка стабильности сервера.

## Структура папки
- `app/main.py` — Главный файл FastAPI (CORS, security-заголовки, эндпоинты, раздача файлов).
- `app/auth/` — регистрация/вход, bcrypt-хеши, JWT access/refresh, роли, rate limiting, SQLite.
- `app/core/pathfinder.py` — Реализация алгоритма $A^*$ по графу с евклидовой эвристикой.
- `requirements.txt` — Зависимости (FastAPI, Uvicorn, Pydantic, bcrypt, PyJWT, Pillow).
- `Dockerfile` — Образ бэкенда для Docker Compose.

## Авторизация

Два портала — две роли:

- посетитель (`user`) — мобильная карта на `:3000`;
- организатор (`admin`) — студия на `:3001`, плюс доступ к админским API.

Регистрация посетителя открыта. Для регистрации организатора нужен код из `TTK_ADMIN_INVITE_CODE` (по умолчанию `TTK-ADMIN-2026`).

| Метод | Путь | Доступ |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | публично (для `admin` — код организатора) |
| `POST` | `/api/auth/login` | публично |
| `POST` | `/api/auth/refresh` | публично по refresh-токену |
| `GET` | `/api/auth/me` | авторизованный |
| `POST` | `/api/auth/logout` | авторизованный |
| `POST` | `/api/auth/change-password` | авторизованный |
| `GET` | `/api/venues` | только `admin` |
| `PUT` | `/api/venues/{slug}` | только `admin` |
| `POST` | `/api/upload` | только `admin` |

Токены: access — 30 минут, refresh — 7 дней с ротацией. Повторное использование отозванного refresh-токена отзывает все сессии пользователя. Выход инкрементирует `token_version`, поэтому ранее выданные access-токены тоже перестают работать.

### Переменные окружения

| Переменная | По умолчанию | Назначение |
| :--- | :--- | :--- |
| `TTK_JWT_SECRET` | dev-значение | секрет подписи JWT (сменить в проде) |
| `TTK_AUTH_DB` | `/app/data/auth.db` | путь к SQLite |
| `TTK_ADMIN_INVITE_CODE` | `TTK-ADMIN-2026` | код регистрации организатора |
| `TTK_ADMIN_EMAIL` / `TTK_ADMIN_PASSWORD` | `admin@ttk.local` / `Admin12345!` | демо-админ |
| `TTK_USER_EMAIL` / `TTK_USER_PASSWORD` | `user@ttk.local` / `User12345!` | демо-посетитель |
| `TTK_ACCESS_TOKEN_TTL` | `1800` | срок access-токена, секунды |
| `TTK_REFRESH_TOKEN_TTL` | `604800` | срок refresh-токена, секунды |
| `TTK_LOGIN_MAX_ATTEMPTS` | `5` | попыток до блокировки аккаунта |
| `TTK_LOGIN_LOCK_SECONDS` | `900` | длительность блокировки аккаунта |
| `TTK_LOGIN_IP_LIMIT` | `30` | неудачных входов с IP за окно |
| `TTK_REGISTER_IP_LIMIT` | `10` | регистраций с IP в час |
| `TTK_AUTH_ENDPOINT_LIMIT` | `120` | запросов ко всем `/api/auth/*` в минуту с IP |
| `TTK_REFRESH_REUSE_GRACE_SECONDS` | `10` | окно для параллельного refresh из двух вкладок |
| `TTK_TRUST_PROXY` | `false` | доверять `X-Forwarded-For` (только за реальным прокси) |
| `TTK_MAX_JSON_BODY_BYTES` | `1048576` | максимум JSON-тела запроса |
| `TTK_CORS_ORIGINS` | localhost:3000/3001 | разрешённые origin через запятую |
| `TTK_SEED_DEMO_USERS` | `true` | создавать демо-аккаунты при первом старте |

### Защита

- bcrypt cost 12, пароли не хранятся в открытом виде;
- блокировка аккаунта после 5 ошибок и лимиты по IP;
- единый ответ на неверный email/пароль + хеш-пустышка против user enumeration;
- refresh-ротация и обнаружение повторного использования токена;
- параметризованный SQL, санитизация имён файлов и папок;
- CSP `sandbox` для `/uploads/*`, security-заголовки, ограничение размера тела;
- CORS только для известных фронтендов.

## Панорамы и загрузки
- `GET /api/panoramas` — отдаёт `/app/uploads/panoramas/index.json`, который
  формирует `cv-worker` (если файла ещё нет — пустой каталог).
- `POST /api/upload` — только для администратора. Принимает `file` и необязательный `folder`
  (`[A-Za-z0-9_-]{1,64}`). Имя файла санитизируется, расширение проверяется,
  размер ограничен `TTK_MAX_UPLOAD_BYTES` (по умолчанию 25 МБ).
  Загрузка 2+ кадров в одну папку запускает сшивку в `cv-worker`.

## Запуск локально без Docker (по желанию):
```bash
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Swagger UI доступен по адресу: http://localhost:8000/docs
