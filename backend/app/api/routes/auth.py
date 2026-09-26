from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session, undefer

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import ROLE_PERMISSIONS, get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas.users import ChangePassword, FaceLoginRequest, FaceTokenOut, LoginRequest, TokenOut, UserOut
from app.services import face_service, session_service
from app.services.audit_service import log_event

router = APIRouter(prefix="/auth", tags=["Autenticación"])


def _issue(user: User) -> dict:
    return {
        "access_token": create_access_token(str(user.id), user.role.name),
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": UserOut.model_validate(user),
    }


def _loc(payload) -> dict | None:
    return payload.location.model_dump() if payload.location else None


@router.post("/login", response_model=TokenOut)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(func.lower(User.email) == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.hashed_password):
        session_service.record_login(db, request=request, user=user, identifier=payload.email, method="password",
                                     status="error", reason="credenciales inválidas", location=_loc(payload),
                                     resolve_location=False)
        log_event(db, request=request, user=None, user_email=payload.email, action="login", module="auth",
                  status="error", detail={"motivo": "credenciales inválidas", "metodo": "password"})
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos.")
    if not user.is_active:
        log_event(db, request=request, user=user, action="login", module="auth", status="error",
                  detail={"motivo": "usuario inactivo"})
        raise HTTPException(status_code=403, detail="El usuario está desactivado.")
    user.last_login = datetime.now(UTC)
    s = session_service.record_login(db, request=request, user=user, identifier=payload.email, method="password",
                                     status="success", location=_loc(payload))
    log_event(db, request=request, user=user, action="login", module="auth", commit=False,
              detail={"metodo": "password", "departamento": s.department, "distrito": s.district})
    db.commit()
    return TokenOut(**_issue(user))


@router.post("/face-login", response_model=FaceTokenOut)
def face_login(payload: FaceLoginRequest, request: Request, db: Session = Depends(get_db)):
    """DNI + escaneo facial. El navegador envía el descriptor (vector de 128 componentes) y el
    backend lo compara con los registrados usando la distancia euclidiana (NumPy)."""
    if not settings.FACE_LOGIN_ENABLED:
        raise HTTPException(status_code=403, detail="El acceso facial está deshabilitado.")
    generic = "No se pudo verificar su identidad. Verifique el DNI, mejore la iluminación e intente de nuevo."

    def fail(user: User | None, reason: str, distance: float | None = None, code: int = 401, msg: str = generic):
        session_service.record_login(db, request=request, user=user, identifier=payload.dni, method="face",
                                     status="error", reason=reason, face_distance=distance,
                                     brightness=payload.brightness, location=_loc(payload), resolve_location=False)
        log_event(db, request=request, user=None, user_email=user.email if user else f"DNI {payload.dni}",
                  action="face_login", module="auth", status="error", detail={"motivo": reason, "distancia": distance})
        raise HTTPException(status_code=code, detail=msg)

    if session_service.recent_face_failures(db, payload.dni) >= settings.FACE_MAX_FAILED_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"Demasiados intentos fallidos. Espere {settings.FACE_LOCK_MINUTES} minutos o ingrese con contraseña.",
        )
    face_service.validate_descriptor(payload.descriptor)
    if not payload.liveness:
        fail(None, "sin prueba de vida", code=422,
             msg="No se detectó parpadeo. Parpadee de forma natural mirando a la cámara.")

    user = db.scalar(select(User).options(undefer(User.face_descriptors)).where(User.dni == payload.dni))
    if user is None or not user.face_descriptors:
        fail(user, "DNI sin biometría registrada")
    if not user.is_active:
        fail(user, "usuario inactivo", code=403, msg="El usuario está desactivado.")

    distance = face_service.best_distance(user.face_descriptors, payload.descriptor)
    if distance > settings.FACE_MATCH_THRESHOLD:
        fail(user, "rostro no coincide", distance)

    user.last_login = datetime.now(UTC)
    s = session_service.record_login(db, request=request, user=user, identifier=payload.dni, method="face",
                                     status="success", face_distance=distance, brightness=payload.brightness,
                                     location=_loc(payload))
    log_event(db, request=request, user=user, action="face_login", module="auth", commit=False,
              detail={"metodo": "facial", "distancia": round(distance, 4), "departamento": s.department,
                      "distrito": s.district})
    db.commit()
    return FaceTokenOut(**_issue(user), match={
        "distance": round(distance, 4), "similarity": face_service.similarity(distance),
        "threshold": settings.FACE_MATCH_THRESHOLD,
    })


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    data = UserOut.model_validate(user).model_dump(mode="json")
    data["modules"] = ROLE_PERMISSIONS.get(user.role.name, [])
    return data


@router.get("/carnet")
def my_carnet(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Carnet del usuario con sus datos de auditoría (7 días, usuarios más activos, ubicación)."""
    db.refresh(user, attribute_names=["photo"])
    return session_service.carnet(db, user)


@router.post("/change-password", status_code=204)
def change_password(payload: ChangePassword, request: Request, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="La contraseña actual no es correcta.")
    user.hashed_password = hash_password(payload.new_password)
    log_event(db, request=request, user=user, action="change_password", module="auth", commit=False)
    db.commit()
