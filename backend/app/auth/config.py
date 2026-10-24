"""Настройки модуля авторизации.

Все значения можно переопределить переменными окружения — это удобно и для
локального запуска, и для Docker Compose, и для боевого сервера.
"""
import os
from pathlib import Path

# backend/app/auth/config.py -> backend/
BASE_DIR = Path(__file__).resolve().parents[2]

AUTH_DB_PATH = Path(
    os.getenv("TTK_AUTH_DB", str(BASE_DIR / "data" / "auth.db"))
).expanduser()

# Секрет подписи JWT. В продакшене обязательно задайте свой через TTK_JWT_SECRET.
DEV_JWT_SECRET = "ttk-dev-secret-change-me-7f4c2a91b8e35d6c0a4f9e2d1b7c8a63"
JWT_SECRET = os.getenv("TTK_JWT_SECRET", DEV_JWT_SECRET)
JWT_ALGORITHM = "HS256"
JWT_ISSUER = "ttk-space-map-api"
JWT_AUDIENCE = "ttk-space-map"

ACCESS_TOKEN_TTL_SECONDS = int(os.getenv("TTK_ACCESS_TOKEN_TTL", str(30 * 60)))
REFRESH_TOKEN_TTL_SECONDS = int(
    os.getenv("TTK_REFRESH_TOKEN_TTL", str(7 * 24 * 60 * 60))
)
# Небольшое окно для параллельного refresh из двух вкладок: второй запрос не
# считается кражей токена. 0 — строгий режим.
REFRESH_REUSE_GRACE_SECONDS = int(
    os.getenv("TTK_REFRESH_REUSE_GRACE_SECONDS", "10")
)

# Доверять ли X-Forwarded-For. Включайте только если бэкенд действительно
# стоит за обратным прокси (Caddy/Nginx), иначе лимиты по IP можно обойти.
TRUST_PROXY = os.getenv("TTK_TRUST_PROXY", "false").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}

BCRYPT_ROUNDS = int(os.getenv("TTK_BCRYPT_ROUNDS", "12"))

# Защита от перебора: 5 неверных паролей на аккаунт -> блокировка на 15 минут.
LOGIN_MAX_ATTEMPTS = int(os.getenv("TTK_LOGIN_MAX_ATTEMPTS", "5"))
LOGIN_LOCK_SECONDS = int(os.getenv("TTK_LOGIN_LOCK_SECONDS", str(15 * 60)))
LOGIN_IP_LIMIT = int(os.getenv("TTK_LOGIN_IP_LIMIT", "30"))
LOGIN_IP_WINDOW_SECONDS = int(os.getenv("TTK_LOGIN_IP_WINDOW_SECONDS", str(15 * 60)))
REGISTER_IP_LIMIT = int(os.getenv("TTK_REGISTER_IP_LIMIT", "10"))
REGISTER_IP_WINDOW_SECONDS = int(
    os.getenv("TTK_REGISTER_IP_WINDOW_SECONDS", str(60 * 60))
)

# Общий лимит на все /api/auth/* — защита от флуда и простого DoS.
AUTH_ENDPOINT_LIMIT = int(os.getenv("TTK_AUTH_ENDPOINT_LIMIT", "120"))
AUTH_ENDPOINT_WINDOW_SECONDS = int(
    os.getenv("TTK_AUTH_ENDPOINT_WINDOW_SECONDS", "60")
)

# Максимальный размер JSON-запроса для обычных API (загрузка файлов — отдельно).
MAX_JSON_BODY_BYTES = int(os.getenv("TTK_MAX_JSON_BODY_BYTES", str(1024 * 1024)))

# Код-приглашение для самостоятельной регистрации организатора.
ADMIN_INVITE_CODE = os.getenv("TTK_ADMIN_INVITE_CODE", "TTK-ADMIN-2026")

# Демо-аккаунты создаются только при первом запуске (если таких email ещё нет).
SEED_DEMO_USERS = os.getenv("TTK_SEED_DEMO_USERS", "true").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}
SEED_ADMIN_EMAIL = os.getenv("TTK_ADMIN_EMAIL", "admin@ttk.example.com")
SEED_ADMIN_PASSWORD = os.getenv("TTK_ADMIN_PASSWORD", "Admin12345!")
SEED_USER_EMAIL = os.getenv("TTK_USER_EMAIL", "user@ttk.example.com")
SEED_USER_PASSWORD = os.getenv("TTK_USER_PASSWORD", "User12345!")
