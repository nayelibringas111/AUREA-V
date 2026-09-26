from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ADMIN, company_id_of, get_current_user, require_roles
from app.models import Company, User
from app.repositories.base import Repository
from app.schemas.company import (
    CompanyOut,
    CompanyUpdate,
)
from app.services.audit_service import log_event

router = APIRouter(tags=["Empresa"])
admin_only = require_roles(ADMIN)


def _commit(db: Session, what: str):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"Ya existe {what} con ese código o nombre.") from None


# ------------------------------ Empresa ------------------------------
@router.get("/companies", response_model=list[CompanyOut])
def list_companies(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [Repository(Company, db).get(company_id_of(user))]


@router.get("/companies/current", response_model=CompanyOut)
def current_company(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return Repository(Company, db).get(company_id_of(user))


@router.patch("/companies/current", response_model=CompanyOut)
def update_company(payload: CompanyUpdate, request: Request, db: Session = Depends(get_db),
                   user: User = Depends(admin_only)):
    company = Repository(Company, db).get(company_id_of(user))
    data = payload.model_dump(exclude_unset=True)
    Repository(Company, db).update(company, data)
    log_event(db, request=request, user=user, action="update", module="empresa", entity_id=company.id,
              detail=data, commit=False)
    _commit(db, "una empresa")
    return company
