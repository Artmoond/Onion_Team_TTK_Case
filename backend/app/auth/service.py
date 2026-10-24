"""Бизнес-логика авторизации: регистрация, вход, refresh-ротация, выход."""
import hmac
import sqlite3

from fastapi import HTTPException, Request, status

from . import config, db
from .schemas import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserPublic,
)
from .security import (
    DUMMY_PASSWORD_HASH,
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    login_ip_limiter,
    parse_iso,
    password_problems,
    register_ip_limiter,
    utcnow,
    verify_password,
)
from .utils import client_ip


def _role_mismatch_message(actual_role: str) -> str:
    if actual_role == "admin":
        return "Это аккаунт организатора. Войдите в Студию организатора (порт 3001)."
    return "Это аккаунт посетителя. Войдите в мобильную карту (порт 3000)."


def _to_public(row: sqlite3.Row) -> UserPublic:
    return UserPublic(**db.row_to_user(row))


def _issue_tokens(row: sqlite3.Row, request: Request) -> TokenResponse:
    role = row["role"]
    version = int(row["token_version"])
    access_token, _ = create_access_token(row["id"], role, version)
    refresh_token, refresh_jti, refresh_expires = create_refresh_token(
        row["id"], role, version
    )
    db.store_refresh_token(
        refresh_jti, row["id"], refresh_expires.isoformat(timespec="seconds")
    )
    return TokenResponse(
        accessToken=access_token,
        refreshToken=refresh_token,
        expiresIn=config.ACCESS_TOKEN_TTL_SECONDS,
        user=_to_public(row),
    )


def register(payload: RegisterRequest, request: Request) -> TokenResponse:
    ip = client_ip(request)
    retry = register_ip_limiter.retry_after(ip)
    if retry:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много регистраций с этого адреса. Попробуйте позже.",
            headers={"Retry-After": str(retry)},
        )
    # Считаем каждую попытку регистрации, включая неудачные с неверным кодом.
    register_ip_limiter.hit(ip)

    email = str(payload.email).strip().lower()

    if db.get_user_by_email(email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким email уже зарегистрирован",
        )

    if payload.role.value == "admin":
        if not config.ADMIN_INVITE_CODE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Регистрация организаторов отключена",
            )
        submitted = (payload.adminInviteCode or "").strip()
        if not hmac.compare_digest(submitted, config.ADMIN_INVITE_CODE):
            db.log_auth_event(
                "register_admin_invite_failed", email=email, ip=ip
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Неверный код организатора",
            )

    problems = password_problems(payload.password)
    if problems:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Пароль должен содержать: " + ", ".join(problems),
        )

    try:
        row = db.create_user(
            email=email,
            full_name=payload.fullName,
            password=payload.password,
            role=payload.role.value,
        )
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким email уже зарегистрирован",
        ) from exc

    db.log_auth_event("register", user_id=row["id"], email=email, ip=ip)
    return _issue_tokens(row, request)


def login(payload: LoginRequest, request: Request) -> TokenResponse:
    ip = client_ip(request)
    retry = login_ip_limiter.retry_after(ip)
    if retry:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много попыток входа. Попробуйте позже.",
            headers={"Retry-After": str(retry)},
        )

    email = str(payload.email).strip().lower()
    row = db.get_user_by_email(email)

    # Для несуществующего email всё равно проверяем «пустышку», чтобы время
    # ответа не позволяло узнать, зарегистрирован аккаунт или нет.
    if row is None:
        verify_password(payload.password, DUMMY_PASSWORD_HASH)
        login_ip_limiter.hit(ip)
        db.log_auth_event("login_unknown_email", email=email, ip=ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not row["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт заблокирован",
        )

    locked_until = parse_iso(row["locked_until"])
    if locked_until and locked_until > utcnow():
        retry_seconds = max(1, int((locked_until - utcnow()).total_seconds()) + 1)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Аккаунт временно заблокирован. Повторите через {retry_seconds // 60 + 1} мин.",
            headers={"Retry-After": str(retry_seconds)},
        )

    if not verify_password(payload.password, row["password_hash"]):
        login_ip_limiter.hit(ip)
        db.register_failed_attempt(
            row["id"], config.LOGIN_MAX_ATTEMPTS, config.LOGIN_LOCK_SECONDS
        )
        db.log_auth_event("login_failed", user_id=row["id"], email=email, ip=ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.role is not None and payload.role.value != row["role"]:
        db.log_auth_event("login_wrong_portal", user_id=row["id"], email=email, ip=ip)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_role_mismatch_message(row["role"]),
        )

    db.update_login_success(row["id"])
    db.log_auth_event("login", user_id=row["id"], email=email, ip=ip)
    fresh_row = db.get_user_by_id(row["id"])
    assert fresh_row is not None
    return _issue_tokens(fresh_row, request)


def refresh_tokens(refresh_token: str, request: Request) -> TokenResponse:
    ip = client_ip(request)
    try:
        payload = decode_token(refresh_token, "refresh")
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id = str(payload["sub"])
    jti = str(payload["jti"])
    token_version = int(payload.get("ver", 0))

    row = db.get_user_by_id(user_id)
    if row is None or not row["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Сессия недействительна",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if token_version != int(row["token_version"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Сессия отозвана. Войдите заново.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    stored = db.get_refresh_token(jti)
    if stored is None or stored["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Сессия недействительна",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if stored["revoked_at"]:
        revoked_at = parse_iso(stored["revoked_at"])
        if (
            revoked_at is not None
            and config.REFRESH_REUSE_GRACE_SECONDS > 0
            and (utcnow() - revoked_at).total_seconds()
            <= config.REFRESH_REUSE_GRACE_SECONDS
        ):
            # Параллельное обновление из двух вкладок: не наказываем пользователя.
            db.log_auth_event("refresh_concurrent", user_id=user_id, ip=ip)
            return _issue_tokens(row, request)

        # Повторное использование уже отозванного refresh-токена — вероятная
        # кража. Отзываем все сессии пользователя.
        db.bump_token_version(user_id)
        db.revoke_all_refresh_tokens(user_id)
        db.log_auth_event("refresh_reuse_detected", user_id=user_id, ip=ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Обнаружено повторное использование токена. Войдите заново.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    expires_at = parse_iso(stored["expires_at"])
    if expires_at is None or expires_at <= utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Срок действия сессии истёк. Войдите заново.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not db.revoke_refresh_token(jti):
        db.bump_token_version(user_id)
        db.revoke_all_refresh_tokens(user_id)
        db.log_auth_event("refresh_race_detected", user_id=user_id, ip=ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Сессия недействительна. Войдите заново.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    db.log_auth_event("refresh", user_id=user_id, ip=ip)
    return _issue_tokens(row, request)


def logout(user: sqlite3.Row, request: Request) -> None:
    db.bump_token_version(user["id"])
    db.revoke_all_refresh_tokens(user["id"])
    db.log_auth_event("logout", user_id=user["id"], email=user["email"], ip=client_ip(request))


def change_password(
    user: sqlite3.Row, payload: ChangePasswordRequest, request: Request
) -> TokenResponse:
    if not verify_password(payload.currentPassword, user["password_hash"]):
        db.log_auth_event(
            "change_password_failed", user_id=user["id"], ip=client_ip(request)
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Текущий пароль указан неверно",
        )

    problems = password_problems(payload.newPassword)
    if problems:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Пароль должен содержать: " + ", ".join(problems),
        )
    if payload.currentPassword == payload.newPassword:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Новый пароль должен отличаться от текущего",
        )

    db.set_password(user["id"], payload.newPassword)
    db.bump_token_version(user["id"])
    db.revoke_all_refresh_tokens(user["id"])
    fresh_row = db.get_user_by_id(user["id"])
    assert fresh_row is not None
    db.log_auth_event("change_password", user_id=user["id"], ip=client_ip(request))
    return _issue_tokens(fresh_row, request)
