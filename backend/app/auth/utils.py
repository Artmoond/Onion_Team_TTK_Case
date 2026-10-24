"""Вспомогательные функции авторизации."""
from fastapi import Request

from . import config


def client_ip(request: Request) -> str:
    """IP клиента для rate limiting.

    X-Forwarded-For учитывается только при TTK_TRUST_PROXY=true: иначе клиент
    может подделать заголовок и обойти лимиты.
    """
    if config.TRUST_PROXY:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()[:64]
    return (request.client.host if request.client else "unknown")[:64]
