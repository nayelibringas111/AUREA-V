from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class RoleOut(ORMModel):
    id: int
    name: str
    description: str | None = None
    permissions: list[str] = []


DNI = Field(pattern=r"^\d{8}$", description="DNI peruano de 8 dígitos")


class UserOut(ORMModel):
    id: int
    email: EmailStr
    full_name: str
    dni: str | None = None
    face_enrolled: bool = False
    face_enrolled_at: datetime | None = None
    is_active: bool
    company_id: int | None = None
    last_login: datetime | None = None
    created_at: datetime | None = None
    role: RoleOut


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=3, max_length=150)
    dni: str | None = Field(default=None, pattern=r"^\d{8}$")
    password: str = Field(min_length=8, max_length=128)
    role_id: int
    is_active: bool = True


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=3, max_length=150)
    dni: str | None = Field(default=None, pattern=r"^\d{8}$")
    password: str | None = Field(default=None, min_length=8, max_length=128)
    role_id: int | None = None
    is_active: bool | None = None


class GeoIn(BaseModel):
    """Coordenadas que el navegador comparte con permiso del usuario."""

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    location: GeoIn | None = None


class FaceLoginRequest(BaseModel):
    dni: str = DNI
    descriptor: list[float] = Field(min_length=128, max_length=128)
    liveness: bool = Field(description="El navegador detectó parpadeo durante el escaneo")
    brightness: float | None = Field(default=None, ge=0, le=255)
    location: GeoIn | None = None


class FaceEnrollRequest(BaseModel):
    descriptors: list[list[float]] = Field(min_length=3, max_length=5, description="3 a 5 capturas del rostro")
    photo: str | None = Field(default=None, max_length=120_000, description="Miniatura JPEG en data URL")
    consent: bool = Field(description="Consentimiento para tratar datos biométricos (Ley 29733)")
    brightness: float | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class FaceMatch(BaseModel):
    distance: float
    similarity: float
    threshold: float


class FaceTokenOut(TokenOut):
    match: FaceMatch


class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
