from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ADMIN, company_id_of, get_current_user, require_roles
from app.models import Branch, User
from app.repositories.base import Repository
from app.schemas.company import (
    BranchBase,
    BranchOut,
    BranchUpdate,
)
from app.services.audit_service import log_event

router = APIRouter(tags=["Sucursales"])
admin_only = require_roles(ADMIN)


def _commit(db: Session, what: str):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"Ya existe {what} con ese código o nombre.") from None


# ------------------------------ Sucursales ------------------------------
@router.get("/branches", response_model=list[BranchOut])
def list_branches(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return Repository(Branch, db).list(Branch.company_id == company_id_of(user), order_by=Branch.code)


@router.post("/branches", response_model=BranchOut, status_code=201)
def create_branch(payload: BranchBase, request: Request, db: Session = Depends(get_db),
                  user: User = Depends(admin_only)):
    b = Repository(Branch, db).create(company_id=company_id_of(user), **payload.model_dump())
    log_event(db, request=request, user=user, action="create", module="sucursales", entity_id=b.id,
              detail={"code": b.code, "name": b.name}, commit=False)
    _commit(db, "una sucursal")
    return b


@router.patch("/branches/{branch_id}", response_model=BranchOut)
def update_branch(branch_id: int, payload: BranchUpdate, request: Request, db: Session = Depends(get_db),
                  user: User = Depends(admin_only)):
    repo = Repository(Branch, db)
    b = repo.get(branch_id, company_id_of(user))
    data = payload.model_dump(exclude_unset=True)
    repo.update(b, data)
    log_event(db, request=request, user=user, action="update", module="sucursales", entity_id=b.id, detail=data,
              commit=False)
    _commit(db, "una sucursal")
    return b


@router.delete("/branches/{branch_id}", status_code=204)
def delete_branch(branch_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    b = Repository(Branch, db).get(branch_id, company_id_of(user))
    b.is_active = False  # baja lógica: conserva ventas e historial
    log_event(db, request=request, user=user, action="deactivate", module="sucursales", entity_id=b.id, commit=False)
    db.commit()
