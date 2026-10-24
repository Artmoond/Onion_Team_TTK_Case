"""HTTP-эндпоинты авторизации."""
import sqlite3

from fastapi import APIRouter, Depends, Request, status

from . import db, service
from .deps import get_current_user, limit_auth_requests
from .schemas import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    StatusResponse,
    TokenResponse,
    UserPublic,
)

router = APIRouter(
    prefix="/api/auth",
    tags=["auth"],
    dependencies=[Depends(limit_auth_requests)],
)


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Регистрация посетителя или организатора",
)
def register(payload: RegisterRequest, request: Request) -> TokenResponse:
    return service.register(payload, request)


@router.post("/login", response_model=TokenResponse, summary="Вход по email и паролю")
def login(payload: LoginRequest, request: Request) -> TokenResponse:
    return service.login(payload, request)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Обновление пары токенов (с ротацией refresh-токена)",
)
def refresh(payload: RefreshRequest, request: Request) -> TokenResponse:
    return service.refresh_tokens(payload.refreshToken, request)


@router.post("/logout", response_model=StatusResponse, summary="Выход из всех сессий")
def logout(
    request: Request,
    user: sqlite3.Row = Depends(get_current_user),
) -> StatusResponse:
    service.logout(user, request)
    return StatusResponse(status="logged_out")


@router.get("/me", response_model=UserPublic, summary="Текущий пользователь")
def me(user: sqlite3.Row = Depends(get_current_user)) -> UserPublic:
    return UserPublic(**db.row_to_user(user))


@router.post(
    "/change-password",
    response_model=TokenResponse,
    summary="Смена пароля с перевыпуском токенов",
)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    user: sqlite3.Row = Depends(get_current_user),
) -> TokenResponse:
    return service.change_password(user, payload, request)
