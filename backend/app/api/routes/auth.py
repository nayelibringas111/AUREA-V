from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import ROLE_PERMISSIONS, get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas.users import ChangePassword, LoginRequest, TokenOut, UserOut
from app.services.audit_service import log_event

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/login", response_model=TokenOut)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(func.lower(User.email) == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.hashed_password):
        log_event(db, request=request, user=None, user_email=payload.email, action="login", module="auth",
                  status="error", detail={"motivo": "credenciales inválidas"})
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos.")
    if not user.is_active:
        log_event(db, request=request, user=user, action="login", module="auth", status="error",
                  detail={"motivo": "usuario inactivo"})
        raise HTTPException(status_code=403, detail="El usuario está desactivado.")
    user.last_login = datetime.now(UTC)
    log_event(db, request=request, user=user, action="login", module="auth", commit=False)
    db.commit()
    token = create_access_token(str(user.id), user.role.name)
    return TokenOut(access_token=token, expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                    user=UserOut.model_validate(user))


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    data = UserOut.model_validate(user).model_dump(mode="json")
    data["modules"] = ROLE_PERMISSIONS.get(user.role.name, [])
    return data


@router.post("/change-password", status_code=204)
def change_password(payload: ChangePassword, request: Request, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="La contraseña actual no es correcta.")
    user.hashed_password = hash_password(payload.new_password)
    log_event(db, request=request, user=user, action="change_password", module="auth", commit=False)
    db.commit()
