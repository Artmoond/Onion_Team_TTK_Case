"""Пароли, JWT-токены и простой in-memory rate limiting."""
import threading
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

import bcrypt
import jwt

from . import config


class TokenError(Exception):
    """Токен отсутствует, просрочен, подделан или отозван."""


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def utcnow_iso() -> str:
    return utcnow().isoformat(timespec="seconds")


def parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


# --- ПАРОЛИ ---------------------------------------------------------------

def _password_bytes(password: str) -> bytes:
    return password.encode("utf-8")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        _password_bytes(password), bcrypt.gensalt(rounds=config.BCRYPT_ROUNDS)
    ).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(_password_bytes(password), password_hash.encode("ascii"))
    except (ValueError, TypeError):
        return False


# Хеш-пустышка: проверяется для несуществующих email, чтобы время ответа не
# выдавало, зарегистрирован ли аккаунт (защита от user enumeration).
DUMMY_PASSWORD_HASH = hash_password("dummy-password-for-timing-protection")


def password_problems(password: str) -> list[str]:
    """Возвращает список нарушений парольной политики (пустой — пароль ок)."""
    problems: list[str] = []
    if len(password) < 8:
        problems.append("минимум 8 символов")
    if len(_password_bytes(password)) > 72:
        problems.append("не больше 72 байт (ограничение bcrypt)")
    if not any(ch.isalpha() for ch in password):
        problems.append("хотя бы одна буква")
    if not any(ch.isdigit() for ch in password):
        problems.append("хотя бы одна цифра")
    if password.lower() in _COMMON_PASSWORDS:
        problems.append("пароль слишком распространён")
    return problems


_COMMON_PASSWORDS = {
    "password",
    "password1",
    "password123",
    "12345678",
    "123456789",
    "1234567890",
    "qwerty123",
    "qwerty12",
    "admin123",
    "administrator",
    "letmein1",
    "welcome1",
    "iloveyou",
    "ttk12345",
}


# --- JWT ------------------------------------------------------------------

def _create_token(
    *,
    user_id: str,
    role: str,
    token_version: int,
    token_type: str,
    ttl_seconds: int,
) -> Tuple[str, str, datetime]:
    now = utcnow()
    expires_at = now + timedelta(seconds=ttl_seconds)
    jti = f"{token_type}-{uuid.uuid4()}"
    payload: Dict[str, Any] = {
        "sub": user_id,
        "role": role,
        "ver": token_version,
        "type": token_type,
        "jti": jti,
        "iss": config.JWT_ISSUER,
        "aud": config.JWT_AUDIENCE,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)
    return token, jti, expires_at


def create_access_token(user_id: str, role: str, token_version: int) -> Tuple[str, datetime]:
    token, _jti, expires_at = _create_token(
        user_id=user_id,
        role=role,
        token_version=token_version,
        token_type="access",
        ttl_seconds=config.ACCESS_TOKEN_TTL_SECONDS,
    )
    return token, expires_at


def create_refresh_token(
    user_id: str, role: str, token_version: int
) -> Tuple[str, str, datetime]:
    return _create_token(
        user_id=user_id,
        role=role,
        token_version=token_version,
        token_type="refresh",
        ttl_seconds=config.REFRESH_TOKEN_TTL_SECONDS,
    )


def decode_token(token: str, expected_type: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            config.JWT_SECRET,
            algorithms=[config.JWT_ALGORITHM],
            audience=config.JWT_AUDIENCE,
            issuer=config.JWT_ISSUER,
            options={"require": ["exp", "iat", "sub", "jti", "type", "ver"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("Срок действия токена истёк") from exc
    except jwt.PyJWTError as exc:
        raise TokenError("Некорректный токен") from exc

    if payload.get("type") != expected_type:
        raise TokenError("Неверный тип токена")
    return payload


# --- RATE LIMITING --------------------------------------------------------

class SlidingWindowLimiter:
    """Простой потокобезопасный лимитер: N событий за окно для каждого ключа."""

    def __init__(self, limit: int, window_seconds: int):
        self.limit = max(1, limit)
        self.window_seconds = max(1, window_seconds)
        self._events: Dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> None:
        events = self._events[key]
        threshold = now - self.window_seconds
        while events and events[0] <= threshold:
            events.popleft()
        if not events:
            self._events.pop(key, None)

    def retry_after(self, key: str) -> int:
        """Сколько секунд осталось до освобождения лимита (0 — можно)."""
        now = time.monotonic()
        with self._lock:
            self._prune(key, now)
            events = self._events.get(key)
            if not events or len(events) < self.limit:
                return 0
            return max(1, int(events[0] + self.window_seconds - now) + 1)

    def hit(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            self._prune(key, now)
            self._events[key].append(now)

    def reset(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)


login_ip_limiter = SlidingWindowLimiter(
    config.LOGIN_IP_LIMIT, config.LOGIN_IP_WINDOW_SECONDS
)
register_ip_limiter = SlidingWindowLimiter(
    config.REGISTER_IP_LIMIT, config.REGISTER_IP_WINDOW_SECONDS
)
