"""Dependencias de FastAPI: usuario autenticado y control de acceso por rol (RBAC)."""
from collections.abc import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models import User

ADMIN, ANALYST, VIEWER = "administrador", "analista", "consulta"
ALL_ROLES = (ADMIN, ANALYST, VIEWER)
STAFF = (ADMIN, ANALYST)

# Módulos visibles por rol (lo consume el frontend para construir la navegación)
ROLE_PERMISSIONS: dict[str, list[str]] = {
    ADMIN: [
        "dashboard", "empresa", "sucursales", "productos", "ventas", "inventario", "metas", "vectores",
        "matrices", "operaciones", "combinaciones", "historial", "reportes", "usuarios", "auditoria",
        "configuracion", "carnet",
    ],
    ANALYST: [
        "dashboard", "ventas", "inventario", "metas", "vectores", "matrices", "operaciones", "combinaciones",
        "historial", "reportes", "configuracion", "carnet",
    ],
    VIEWER: ["dashboard", "reportes", "configuracion", "carnet"],
}

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sesión no válida o expirada.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise unauthorized
    try:
        payload = decode_access_token(creds.credentials)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise unauthorized from None
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized
    return user


def require_roles(*roles: str) -> Callable[..., User]:
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role.name not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Su rol no tiene permisos para esta acción.",
            )
        return user

    return checker


def company_id_of(user: User) -> int:
    if user.company_id is None:
        raise HTTPException(status_code=400, detail="El usuario no está asociado a una empresa.")
    return user.company_id
