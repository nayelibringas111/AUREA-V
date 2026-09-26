from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import STAFF, company_id_of, require_roles
from app.models import Branch, Inventory, InventoryMovement, User
from app.schemas.sales import InventoryOut, InventoryUpdate, MovementCreate, MovementOut
from app.services import sales_service
from app.services.audit_service import log_event

router = APIRouter(prefix="/inventory", tags=["Inventario"])
staff = require_roles(*STAFF)


@router.get("", response_model=list[InventoryOut])
def list_inventory(db: Session = Depends(get_db), user: User = Depends(staff), branch_id: int | None = None,
                   low_stock: bool = False):
    stmt = select(Inventory).join(Branch, Branch.id == Inventory.branch_id).where(
        Branch.company_id == company_id_of(user))
    if branch_id:
        stmt = stmt.where(Inventory.branch_id == branch_id)
    if low_stock:
        stmt = stmt.where(Inventory.stock <= Inventory.min_stock)
    return db.scalars(stmt.order_by(Branch.code, Inventory.product_id)).all()


@router.patch("/{inventory_id}", response_model=InventoryOut)
def update_min_stock(inventory_id: int, payload: InventoryUpdate, request: Request, db: Session = Depends(get_db),
                     user: User = Depends(staff)):
    inv = db.get(Inventory, inventory_id)
    if inv is None or inv.branch.company_id != company_id_of(user):
        raise HTTPException(status_code=404, detail="Registro de inventario no encontrado.")
    inv.min_stock = payload.min_stock
    log_event(db, request=request, user=user, action="update", module="inventario", entity_id=inv.id,
              detail={"min_stock": payload.min_stock}, commit=False)
    db.commit()
    return inv


@router.get("/movements", response_model=list[MovementOut])
def list_movements(db: Session = Depends(get_db), user: User = Depends(staff), branch_id: int | None = None,
                   product_id: int | None = None, limit: int = Query(100, ge=1, le=500)):
    stmt = select(InventoryMovement).join(Branch, Branch.id == InventoryMovement.branch_id).where(
        Branch.company_id == company_id_of(user))
    if branch_id:
        stmt = stmt.where(InventoryMovement.branch_id == branch_id)
    if product_id:
        stmt = stmt.where(InventoryMovement.product_id == product_id)
    return db.scalars(stmt.order_by(InventoryMovement.created_at.desc(), InventoryMovement.id.desc()).limit(limit)).all()


@router.post("/movements", response_model=MovementOut, status_code=201)
def create_movement(payload: MovementCreate, request: Request, db: Session = Depends(get_db),
                    user: User = Depends(staff)):
    mov = sales_service.register_movement(db, user, payload)
    log_event(db, request=request, user=user, action=payload.movement_type, module="inventario", entity_id=mov.id,
              detail=payload.model_dump(), commit=False)
    db.commit()
    db.refresh(mov)
    return mov
