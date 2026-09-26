from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import STAFF, company_id_of, require_roles
from app.models import User, Vector
from app.schemas.algebra import VectorCreate, VectorFromProducts, VectorOut, VectorUpdate
from app.services import algebra_service as svc
from app.services.audit_service import log_event

router = APIRouter(prefix="/vectors", tags=["Vectores"])
staff = require_roles(*STAFF)


@router.get("", response_model=list[VectorOut])
def list_vectors(db: Session = Depends(get_db), user: User = Depends(staff)):
    vs = db.scalars(select(Vector).where(Vector.company_id == company_id_of(user)).order_by(Vector.id.desc()))
    return [svc.vector_out(v) for v in vs]


@router.get("/{vector_id}", response_model=VectorOut)
def get_vector(vector_id: int, db: Session = Depends(get_db), user: User = Depends(staff)):
    return svc.vector_out(svc.get_vector(db, vector_id, company_id_of(user)))


@router.post("", response_model=VectorOut, status_code=201)
def create_vector(payload: VectorCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(staff)):
    v = svc.save_vector(db, company_id=company_id_of(user), user_id=user.id, **payload.model_dump())
    log_event(db, request=request, user=user, action="create", module="vectores", entity_id=v.id,
              detail={"name": v.name, "dimension": v.dimension}, commit=False)
    db.commit()
    return svc.vector_out(v)


@router.post("/from-products", response_model=VectorOut, status_code=201)
def vector_from_products(payload: VectorFromProducts, request: Request, db: Session = Depends(get_db),
                         user: User = Depends(staff)):
    cid = company_id_of(user)
    values, labels, desc = svc.product_vector(db, cid, payload.field)
    names = {"unit_price": "Precios unitarios", "unit_cost": "Costos unitarios", "margin": "Margen unitario"}
    v = svc.save_vector(db, company_id=cid, user_id=user.id, name=payload.name or names[payload.field],
                        values=values, labels=labels, description=desc, source="productos")
    log_event(db, request=request, user=user, action="generate", module="vectores", entity_id=v.id,
              detail={"field": payload.field}, commit=False)
    db.commit()
    return svc.vector_out(v)


@router.put("/{vector_id}", response_model=VectorOut)
def update_vector(vector_id: int, payload: VectorUpdate, request: Request, db: Session = Depends(get_db),
                  user: User = Depends(staff)):
    cid = company_id_of(user)
    v = svc.get_vector(db, vector_id, cid)
    svc.save_vector(db, company_id=cid, user_id=user.id, vector=v, source=v.source, **payload.model_dump())
    log_event(db, request=request, user=user, action="update", module="vectores", entity_id=v.id, commit=False)
    db.commit()
    return svc.vector_out(v)


@router.delete("/{vector_id}", status_code=204)
def delete_vector(vector_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(staff)):
    v = svc.get_vector(db, vector_id, company_id_of(user))
    db.delete(v)
    log_event(db, request=request, user=user, action="delete", module="vectores", entity_id=vector_id,
              detail={"name": v.name}, commit=False)
    db.commit()
