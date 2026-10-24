"""FastAPI-зависимости для проверки access-токена и ролей."""
import sqlite3
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import config, db
from .security import SlidingWindowLimiter, TokenError, decode_token
from .utils import client_ip

bearer_scheme = HTTPBearer(auto_error=False)

# Общий лимит на все auth-эндпоинты (по IP), чтобы нельзя было флудить сервер
# даже корректными запросами.
auth_endpoint_limiter = SlidingWindowLimiter(
    config.AUTH_ENDPOINT_LIMIT, config.AUTH_ENDPOINT_WINDOW_SECONDS
)


def limit_auth_requests(request: Request) -> None:
    ip = client_ip(request)
    retry = auth_endpoint_limiter.retry_after(ip)
    if retry:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много запросов авторизации. Попробуйте через минуту.",
            headers={"Retry-After": str(retry)},
        )
    auth_endpoint_limiter.hit(ip)


def _unauthorized(detail: str = "Требуется авторизация") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def user_from_token(token: str) -> sqlite3.Row:
    try:
        payload = decode_token(token, "access")
    except TokenError as exc:
        raise _unauthorized(str(exc)) from exc

    user_id = str(payload.get("sub") or "")
    row = db.get_user_by_id(user_id)
    if row is None or not row["is_active"]:
        raise _unauthorized("Аккаунт не найден или заблокирован")

    if int(payload.get("ver", 0)) != int(row["token_version"]):
        raise _unauthorized("Сессия отозвана. Войдите заново.")

    if str(payload.get("role") or "") != row["role"]:
        raise _unauthorized("Права доступа изменились. Войдите заново.")

    return row


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> sqlite3.Row:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()
    return user_from_token(credentials.credentials)


def require_admin(user: sqlite3.Row = Depends(get_current_user)) -> sqlite3.Row:
    if user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав: требуется роль администратора",
        )
    return user


def optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[sqlite3.Row]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    try:
        return user_from_token(credentials.credentials)
    except HTTPException:
        return None
