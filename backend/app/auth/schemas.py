"""Pydantic-схемы авторизации."""
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserRole(str, Enum):
    admin = "admin"
    user = "user"


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    fullName: str = Field(min_length=2, max_length=80)
    role: UserRole = UserRole.user
    adminInviteCode: Optional[str] = Field(default=None, max_length=128)

    @field_validator("fullName")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("Укажите имя (минимум 2 символа)")
        return cleaned


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)
    role: Optional[UserRole] = None


class RefreshRequest(BaseModel):
    refreshToken: str = Field(min_length=1, max_length=4096)


class ChangePasswordRequest(BaseModel):
    currentPassword: str = Field(min_length=1, max_length=72)
    newPassword: str = Field(min_length=8, max_length=72)


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    fullName: str
    role: UserRole
    isActive: bool = True
    createdAt: Optional[str] = None
    lastLoginAt: Optional[str] = None


class TokenResponse(BaseModel):
    accessToken: str
    refreshToken: str
    tokenType: str = "Bearer"
    expiresIn: int
    user: UserPublic


class StatusResponse(BaseModel):
    status: str
