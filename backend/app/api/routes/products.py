from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ADMIN, company_id_of, get_current_user, require_roles
from app.models import Category, Product, User
from app.repositories.base import Repository
from app.schemas.company import (
    CategoryBase,
    CategoryOut,
    ProductBase,
    ProductOut,
    ProductUpdate,
)
from app.services.audit_service import log_event

router = APIRouter(tags=["Productos"])
admin_only = require_roles(ADMIN)


def _commit(db: Session, what: str):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"Ya existe {what} con ese código o nombre.") from None


# ------------------------------ Categorías ------------------------------
@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return Repository(Category, db).list(Category.company_id == company_id_of(user), order_by=Category.name)


@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(payload: CategoryBase, request: Request, db: Session = Depends(get_db),
                    user: User = Depends(admin_only)):
    c = Repository(Category, db).create(company_id=company_id_of(user), **payload.model_dump())
    log_event(db, request=request, user=user, action="create", module="productos", entity_id=c.id,
              detail={"categoria": c.name}, commit=False)
    _commit(db, "una categoría")
    return c


# ------------------------------ Productos ------------------------------
@router.get("/products", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return Repository(Product, db).list(Product.company_id == company_id_of(user), order_by=Product.sku)


def _check_category(db: Session, category_id: int | None, cid: int):
    if category_id is not None:
        Repository(Category, db).get(category_id, cid)


@router.post("/products", response_model=ProductOut, status_code=201)
def create_product(payload: ProductBase, request: Request, db: Session = Depends(get_db),
                   user: User = Depends(admin_only)):
    cid = company_id_of(user)
    _check_category(db, payload.category_id, cid)
    p = Repository(Product, db).create(company_id=cid, **payload.model_dump())
    log_event(db, request=request, user=user, action="create", module="productos", entity_id=p.id,
              detail={"sku": p.sku, "name": p.name}, commit=False)
    _commit(db, "un producto")
    db.refresh(p)
    return p


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: ProductUpdate, request: Request, db: Session = Depends(get_db),
                   user: User = Depends(admin_only)):
    cid = company_id_of(user)
    repo = Repository(Product, db)
    p = repo.get(product_id, cid)
    data = payload.model_dump(exclude_unset=True)
    _check_category(db, data.get("category_id"), cid)
    repo.update(p, data)
    log_event(db, request=request, user=user, action="update", module="productos", entity_id=p.id, detail=data,
              commit=False)
    _commit(db, "un producto")
    db.refresh(p)
    return p


@router.delete("/products/{product_id}", status_code=204)
def delete_product(product_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    p = Repository(Product, db).get(product_id, company_id_of(user))
    p.is_active = False
    log_event(db, request=request, user=user, action="deactivate", module="productos", entity_id=p.id, commit=False)
    db.commit()
