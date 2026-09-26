"""Configuración central leída desde variables de entorno (.env en local, panel de Render en producción)."""
from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "MatrixFlow Enterprise API"
    ENVIRONMENT: str = "development"
    API_PREFIX: str = "/api/v1"

    # Base de datos. En Supabase usar la cadena "Session pooler" (IPv4, puerto 5432).
    DATABASE_URL: str = "postgresql+psycopg://matrixflow:matrixflow@localhost:5432/matrixflow"

    # Seguridad
    SECRET_KEY: str = "cambie-esta-clave-en-produccion"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    JWT_ALGORITHM: str = "HS256"

    # CORS: lista separada por comas y expresión regular opcional (para previews de Vercel)
    CORS_ORIGINS: str = "http://localhost:5173"
    CORS_ORIGIN_REGEX: str | None = None

    # Datos iniciales de la empresa
    SEED_ON_START: bool = True
    ADMIN_EMAIL: str = "admin@tecnoandes.pe"
    ADMIN_PASSWORD: str = "Admin2026!"
    DEMO_USERS_PASSWORD: str = "Demo2026!"

    @field_validator("DATABASE_URL")
    @classmethod
    def normalize_db_url(cls, v: str) -> str:
        # Supabase/Render entregan postgres:// o postgresql://; SQLAlchemy necesita el driver psycopg (v3).
        if v.startswith("postgres://"):
            v = "postgresql+psycopg://" + v[len("postgres://"):]
        elif v.startswith("postgresql://"):
            v = "postgresql+psycopg://" + v[len("postgresql://"):]
        return v

    @model_validator(mode="after")
    def secure_in_production(self):
        if self.ENVIRONMENT == "production" and (self.SECRET_KEY.startswith("cambie") or len(self.SECRET_KEY) < 32):
            raise ValueError("SECRET_KEY insegura en producción: defina una clave aleatoria de al menos 32 caracteres.")
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
