import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import STAFF, company_id_of, require_roles
from app.models import Branch, Sale, User
from app.schemas.common import Page
from app.schemas.sales import SaleCreate, SaleOut
from app.services import sales_service
from app.services.audit_service import log_event

router = APIRouter(prefix="/sales", tags=["Ventas"])
staff = require_roles(*STAFF)


@router.get("", response_model=Page[SaleOut])
def list_sales(
    db: Session = Depends(get_db),
    user: User = Depends(staff),
    branch_id: int | None = None,
    date_from: dt.date | None = None,
    date_to: dt.date | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=200),
):
    filters = [Branch.company_id == company_id_of(user)]
    if branch_id:
        filters.append(Sale.branch_id == branch_id)
    if date_from:
        filters.append(Sale.sale_date >= date_from)
    if date_to:
        filters.append(Sale.sale_date <= date_to)
    if status:
        filters.append(Sale.status == status)
    base = select(Sale).join(Branch, Branch.id == Sale.branch_id).where(*filters)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    items = db.scalars(
        base.order_by(Sale.sale_date.desc(), Sale.id.desc()).offset((page - 1) * size).limit(size)
    ).unique().all()
    return Page(items=[SaleOut.model_validate(s) for s in items], total=total, page=page, size=size)


def _get_sale(db: Session, sale_id: int, cid: int) -> Sale:
    sale = db.get(Sale, sale_id)
    if sale is None or sale.branch.company_id != cid:
        raise HTTPException(status_code=404, detail="Venta no encontrada.")
    return sale


@router.get("/{sale_id}", response_model=SaleOut)
def get_sale(sale_id: int, db: Session = Depends(get_db), user: User = Depends(staff)):
    return _get_sale(db, sale_id, company_id_of(user))


@router.post("", response_model=SaleOut, status_code=201)
def create_sale(payload: SaleCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(staff)):
    sale = sales_service.create_sale(db, user, payload)
    log_event(db, request=request, user=user, action="create", module="ventas", entity_id=sale.id,
              detail={"total": float(sale.total), "items": len(sale.details)}, commit=False)
    db.commit()
    db.refresh(sale)
    return sale


@router.post("/{sale_id}/cancel", response_model=SaleOut)
def cancel_sale(sale_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(staff)):
    sale = sales_service.cancel_sale(db, user, _get_sale(db, sale_id, company_id_of(user)))
    log_event(db, request=request, user=user, action="cancel", module="ventas", entity_id=sale.id, commit=False)
    db.commit()
    db.refresh(sale)
    return sale
