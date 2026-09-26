from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ADMIN, require_roles
from app.core.security import hash_password
from app.models import Role, User
from app.repositories.base import Repository
from app.schemas.users import RoleOut, UserCreate, UserOut, UserUpdate
from app.services.audit_service import log_event

router = APIRouter(prefix="/users", tags=["Usuarios"])
admin_only = require_roles(ADMIN)


@router.get("/roles", response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db), _: User = Depends(admin_only)):
    return Repository(Role, db).list(order_by=Role.id)


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), user: User = Depends(admin_only)):
    return Repository(User, db).list(User.company_id == user.company_id, order_by=User.id)


@router.post("", response_model=UserOut, status_code=201)
def create_user(payload: UserCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    if db.scalar(select(User).where(func.lower(User.email) == payload.email.lower())):
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese correo.")
    Repository(Role, db).get(payload.role_id)
    new = Repository(User, db).create(
        email=payload.email.lower(), full_name=payload.full_name, hashed_password=hash_password(payload.password),
        role_id=payload.role_id, company_id=user.company_id, is_active=payload.is_active,
    )
    log_event(db, request=request, user=user, action="create", module="usuarios", entity_id=new.id,
              detail={"email": new.email}, commit=False)
    db.commit()
    db.refresh(new)
    return new


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, request: Request, db: Session = Depends(get_db),
                user: User = Depends(admin_only)):
    repo = Repository(User, db)
    target = repo.get(user_id, company_id=user.company_id)
    data = payload.model_dump(exclude_unset=True)
    if target.id == user.id and (data.get("is_active") is False or ("role_id" in data and data["role_id"] != user.role_id)):
        raise HTTPException(status_code=422, detail="No puede desactivarse ni cambiar su propio rol.")
    if "role_id" in data:
        Repository(Role, db).get(data["role_id"])
    if "password" in data:
        data["hashed_password"] = hash_password(data.pop("password"))
    repo.update(target, data)
    log_event(db, request=request, user=user, action="update", module="usuarios", entity_id=target.id,
              detail={k: v for k, v in data.items() if k != "hashed_password"}, commit=False)
    db.commit()
    db.refresh(target)
    return target


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    repo = Repository(User, db)
    target = repo.get(user_id, company_id=user.company_id)
    if target.id == user.id:
        raise HTTPException(status_code=422, detail="No puede eliminar su propio usuario.")
    # Se desactiva en lugar de borrar para conservar la trazabilidad
    target.is_active = False
    log_event(db, request=request, user=user, action="deactivate", module="usuarios", entity_id=target.id, commit=False)
    db.commit()
