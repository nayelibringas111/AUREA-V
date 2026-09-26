from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import STAFF, company_id_of, require_roles
from app.models import Branch, Product, Target, User
from app.schemas.sales import TargetBase, TargetOut, TargetUpdate
from app.services.audit_service import log_event

router = APIRouter(prefix="/targets", tags=["Metas"])
staff = require_roles(*STAFF)


@router.get("", response_model=list[TargetOut])
def list_targets(db: Session = Depends(get_db), user: User = Depends(staff), period: str | None = None,
                 branch_id: int | None = None):
    stmt = select(Target).join(Branch, Branch.id == Target.branch_id).where(Branch.company_id == company_id_of(user))
    if period:
        stmt = stmt.where(Target.period == period)
    if branch_id:
        stmt = stmt.where(Target.branch_id == branch_id)
    return db.scalars(stmt.order_by(Target.period.desc(), Branch.code, Target.product_id)).all()


@router.get("/periods", response_model=list[str])
def list_periods(db: Session = Depends(get_db), user: User = Depends(staff)):
    stmt = (select(Target.period).join(Branch, Branch.id == Target.branch_id)
            .where(Branch.company_id == company_id_of(user)).distinct().order_by(Target.period.desc()))
    return list(db.scalars(stmt))


@router.put("", response_model=TargetOut)
def upsert_target(payload: TargetBase, request: Request, db: Session = Depends(get_db), user: User = Depends(staff)):
    cid = company_id_of(user)
    b, p = db.get(Branch, payload.branch_id), db.get(Product, payload.product_id)
    if not b or b.company_id != cid or not p or p.company_id != cid:
        raise HTTPException(status_code=404, detail="Sucursal o producto no encontrado.")
    t = db.scalar(select(Target).where(Target.branch_id == b.id, Target.product_id == p.id,
                                       Target.period == payload.period))
    if t is None:
        t = Target(**payload.model_dump())
        db.add(t)
    else:
        t.target_quantity, t.target_amount = payload.target_quantity, payload.target_amount
    db.flush()
    log_event(db, request=request, user=user, action="upsert", module="metas", entity_id=t.id,
              detail=payload.model_dump(), commit=False)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflicto al guardar la meta.") from None
    db.refresh(t)
    return t


@router.patch("/{target_id}", response_model=TargetOut)
def update_target(target_id: int, payload: TargetUpdate, request: Request, db: Session = Depends(get_db),
                  user: User = Depends(staff)):
    t = db.get(Target, target_id)
    if t is None or t.branch.company_id != company_id_of(user):
        raise HTTPException(status_code=404, detail="Meta no encontrada.")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(t, k, v)
    log_event(db, request=request, user=user, action="update", module="metas", entity_id=t.id, detail=data,
              commit=False)
    db.commit()
    db.refresh(t)
    return t
