from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Branch, Inventory, InventoryMovement, Product, Sale, SaleDetail, User
from app.schemas.sales import MovementCreate, SaleCreate


def _branch(db: Session, branch_id: int, company_id: int) -> Branch:
    b = db.get(Branch, branch_id)
    if b is None or b.company_id != company_id:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada.")
    if not b.is_active:
        raise HTTPException(status_code=422, detail="La sucursal está inactiva.")
    return b


def _product(db: Session, product_id: int, company_id: int) -> Product:
    p = db.get(Product, product_id)
    if p is None or p.company_id != company_id:
        raise HTTPException(status_code=404, detail=f"Producto {product_id} no encontrado.")
    return p


def _inventory_row(db: Session, branch_id: int, product_id: int) -> Inventory:
    inv = db.scalar(select(Inventory).where(Inventory.branch_id == branch_id, Inventory.product_id == product_id))
    if inv is None:
        inv = Inventory(branch_id=branch_id, product_id=product_id, stock=0, min_stock=5)
        db.add(inv)
        db.flush()
    return inv


def create_sale(db: Session, user: User, payload: SaleCreate, check_stock: bool = True) -> Sale:
    branch = _branch(db, payload.branch_id, user.company_id)
    sale = Sale(branch_id=branch.id, user_id=user.id, sale_date=payload.sale_date, customer=payload.customer)
    total = Decimal("0")
    merged: dict[int, tuple[int, Decimal | None]] = {}
    for d in payload.details:
        qty, price = merged.get(d.product_id, (0, None))
        merged[d.product_id] = (qty + d.quantity, Decimal(str(d.unit_price)) if d.unit_price else price)

    for product_id, (qty, price) in merged.items():
        product = _product(db, product_id, user.company_id)
        if not product.is_active:
            raise HTTPException(status_code=422, detail=f"El producto {product.name} está inactivo.")
        inv = _inventory_row(db, branch.id, product.id)
        if check_stock and inv.stock < qty:
            raise HTTPException(
                status_code=422,
                detail=f"Stock insuficiente de {product.name} en {branch.name}: disponible {inv.stock}, solicitado {qty}.",
            )
        unit_price = price or product.unit_price
        subtotal = (unit_price * qty).quantize(Decimal("0.01"))
        total += subtotal
        sale.details.append(SaleDetail(product_id=product.id, quantity=qty, unit_price=unit_price, subtotal=subtotal))
        inv.stock -= qty
        db.add(InventoryMovement(
            branch_id=branch.id, product_id=product.id, movement_type="salida", quantity=qty,
            reason="Venta", user_id=user.id,
        ))
    sale.total = total
    db.add(sale)
    db.flush()
    return sale


def register_movement(db: Session, user: User, payload: MovementCreate) -> InventoryMovement:
    branch = _branch(db, payload.branch_id, user.company_id)
    product = _product(db, payload.product_id, user.company_id)
    inv = _inventory_row(db, branch.id, product.id)
    if payload.movement_type == "entrada":
        if payload.quantity <= 0:
            raise HTTPException(status_code=422, detail="La cantidad de entrada debe ser mayor que cero.")
        inv.stock += payload.quantity
        qty = payload.quantity
    elif payload.movement_type == "salida":
        if payload.quantity <= 0:
            raise HTTPException(status_code=422, detail="La cantidad de salida debe ser mayor que cero.")
        if inv.stock < payload.quantity:
            raise HTTPException(status_code=422, detail=f"Stock insuficiente: disponible {inv.stock}.")
        inv.stock -= payload.quantity
        qty = payload.quantity
    else:  # ajuste: la cantidad es el stock final
        qty = payload.quantity - inv.stock
        inv.stock = payload.quantity
    mov = InventoryMovement(
        branch_id=branch.id, product_id=product.id, movement_type=payload.movement_type, quantity=qty,
        reason=payload.reason, user_id=user.id,
    )
    db.add(mov)
    db.flush()
    return mov


def cancel_sale(db: Session, user: User, sale: Sale) -> Sale:
    if sale.status == "anulada":
        raise HTTPException(status_code=422, detail="La venta ya está anulada.")
    for d in sale.details:
        inv = _inventory_row(db, sale.branch_id, d.product_id)
        inv.stock += d.quantity
        db.add(InventoryMovement(
            branch_id=sale.branch_id, product_id=d.product_id, movement_type="entrada", quantity=d.quantity,
            reason=f"Anulación de venta #{sale.id}", user_id=user.id,
        ))
    sale.status = "anulada"
    db.flush()
    return sale
