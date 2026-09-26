from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class RoleOut(ORMModel):
    id: int
    name: str
    description: str | None = None
    permissions: list[str] = []


class UserOut(ORMModel):
    id: int
    email: EmailStr
    full_name: str
    is_active: bool
    company_id: int | None = None
    last_login: datetime | None = None
    created_at: datetime | None = None
    role: RoleOut


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=3, max_length=150)
    password: str = Field(min_length=8, max_length=128)
    role_id: int
    is_active: bool = True


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=3, max_length=150)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    role_id: int | None = None
    is_active: bool | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
