from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import STAFF, company_id_of, require_roles
from app.models import Matrix, User
from app.schemas.algebra import MatrixCreate, MatrixFromSales, MatrixOut, MatrixUpdate
from app.services import algebra_service as svc
from app.services.audit_service import log_event

router = APIRouter(prefix="/matrices", tags=["Matrices"])
staff = require_roles(*STAFF)

METRIC_NAMES = {
    "quantity": "Unidades vendidas",
    "amount": "Ventas (importe)",
    "target_quantity": "Metas (unidades)",
    "target_amount": "Metas (importe)",
    "stock": "Existencias",
}


@router.get("", response_model=list[MatrixOut])
def list_matrices(db: Session = Depends(get_db), user: User = Depends(staff)):
    ms = db.scalars(select(Matrix).where(Matrix.company_id == company_id_of(user)).order_by(Matrix.id.desc()))
    return [svc.matrix_out(m) for m in ms]


@router.get("/{matrix_id}", response_model=MatrixOut)
def get_matrix(matrix_id: int, db: Session = Depends(get_db), user: User = Depends(staff)):
    return svc.matrix_out(svc.get_matrix(db, matrix_id, company_id_of(user)))


@router.post("", response_model=MatrixOut, status_code=201)
def create_matrix(payload: MatrixCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(staff)):
    m = svc.save_matrix(db, company_id=company_id_of(user), user_id=user.id, **payload.model_dump())
    log_event(db, request=request, user=user, action="create", module="matrices", entity_id=m.id,
              detail={"name": m.name, "shape": [m.rows, m.cols]}, commit=False)
    db.commit()
    return svc.matrix_out(m)


@router.post("/preview-from-sales", response_model=MatrixOut)
def preview_from_sales(payload: MatrixFromSales, db: Session = Depends(get_db), user: User = Depends(staff)):
    """Construye la matriz sin guardarla (para previsualizar en el frontend)."""
    values, rows, cols, desc = svc.business_matrix(
        db, company_id_of(user), payload.metric, payload.date_from, payload.date_to, payload.period)
    return MatrixOut(id=0, name=payload.name or METRIC_NAMES[payload.metric], description=desc, rows=len(rows),
                     cols=len(cols), row_labels=rows, col_labels=cols, source="ventas", created_at=None,
                     values=values)


@router.post("/from-sales", response_model=MatrixOut, status_code=201)
def matrix_from_sales(payload: MatrixFromSales, request: Request, db: Session = Depends(get_db),
                      user: User = Depends(staff)):
    cid = company_id_of(user)
    values, rows, cols, desc = svc.business_matrix(db, cid, payload.metric, payload.date_from, payload.date_to,
                                                   payload.period)
    suffix = payload.period or (f"{payload.date_from or ''}…{payload.date_to or ''}" if (payload.date_from or payload.date_to) else "")
    name = payload.name or f"{METRIC_NAMES[payload.metric]} {suffix}".strip()
    source = "metas" if payload.metric.startswith("target") else ("inventario" if payload.metric == "stock" else "ventas")
    m = svc.save_matrix(db, company_id=cid, user_id=user.id, name=name, values=values, row_labels=rows,
                        col_labels=cols, description=desc, source=source)
    log_event(db, request=request, user=user, action="generate", module="matrices", entity_id=m.id,
              detail=payload.model_dump(mode="json"), commit=False)
    db.commit()
    return svc.matrix_out(m)


@router.put("/{matrix_id}", response_model=MatrixOut)
def update_matrix(matrix_id: int, payload: MatrixUpdate, request: Request, db: Session = Depends(get_db),
                  user: User = Depends(staff)):
    cid = company_id_of(user)
    m = svc.get_matrix(db, matrix_id, cid)
    svc.save_matrix(db, company_id=cid, user_id=user.id, matrix=m, source=m.source, **payload.model_dump())
    log_event(db, request=request, user=user, action="update", module="matrices", entity_id=m.id, commit=False)
    db.commit()
    return svc.matrix_out(m)


@router.delete("/{matrix_id}", status_code=204)
def delete_matrix(matrix_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(staff)):
    m = svc.get_matrix(db, matrix_id, company_id_of(user))
    db.delete(m)
    log_event(db, request=request, user=user, action="delete", module="matrices", entity_id=matrix_id,
              detail={"name": m.name}, commit=False)
    db.commit()
