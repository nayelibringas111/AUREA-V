"""Persistencia de vectores y matrices y su construcción a partir de datos empresariales."""
import datetime as dt

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Branch, Inventory, Matrix, MatrixValue, Product, Sale, SaleDetail, Target, Vector, VectorValue
from app.schemas.algebra import MatrixOut, VectorOut


# ---------- serialización ----------
def vector_out(v: Vector) -> VectorOut:
    return VectorOut(
        id=v.id, name=v.name, description=v.description, dimension=v.dimension, labels=v.labels,
        source=v.source, created_at=v.created_at, values=v.as_list(),
    )


def matrix_out(m: Matrix) -> MatrixOut:
    return MatrixOut(
        id=m.id, name=m.name, description=m.description, rows=m.rows, cols=m.cols, row_labels=m.row_labels,
        col_labels=m.col_labels, source=m.source, created_at=m.created_at, values=m.as_list(),
    )


# ---------- escritura ----------
def save_vector(
    db: Session, *, company_id: int, user_id: int | None, name: str, values: list[float],
    labels: list[str] | None = None, description: str | None = None, source: str = "manual",
    vector: Vector | None = None,
) -> Vector:
    if vector is None:
        vector = Vector(company_id=company_id, created_by=user_id)
        db.add(vector)
    vector.name, vector.description, vector.labels, vector.source = name, description, labels, source
    vector.dimension = len(values)
    if vector.id is not None and vector.values:
        vector.values.clear()
        db.flush()  # elimina valores anteriores antes de insertar (evita choque con la restricción única)
    vector.values = [VectorValue(position=i, value=float(x)) for i, x in enumerate(values)]
    db.flush()
    return vector


def save_matrix(
    db: Session, *, company_id: int, user_id: int | None, name: str, values: list[list[float]],
    row_labels: list[str] | None = None, col_labels: list[str] | None = None, description: str | None = None,
    source: str = "manual", matrix: Matrix | None = None,
) -> Matrix:
    if matrix is None:
        matrix = Matrix(company_id=company_id, created_by=user_id)
        db.add(matrix)
    matrix.name, matrix.description, matrix.source = name, description, source
    matrix.row_labels, matrix.col_labels = row_labels, col_labels
    matrix.rows, matrix.cols = len(values), len(values[0])
    if matrix.id is not None and matrix.values:
        matrix.values.clear()
        db.flush()
    matrix.values = [
        MatrixValue(row_index=i, col_index=j, value=float(x))
        for i, row in enumerate(values)
        for j, x in enumerate(row)
    ]
    db.flush()
    return matrix


def get_vector(db: Session, vector_id: int, company_id: int) -> Vector:
    v = db.get(Vector, vector_id)
    if v is None or v.company_id != company_id:
        raise HTTPException(status_code=404, detail=f"Vector {vector_id} no encontrado.")
    return v


def get_matrix(db: Session, matrix_id: int, company_id: int) -> Matrix:
    m = db.get(Matrix, matrix_id)
    if m is None or m.company_id != company_id:
        raise HTTPException(status_code=404, detail=f"Matriz {matrix_id} no encontrada.")
    return m


# ---------- construcción desde datos del negocio ----------
def active_branches(db: Session, company_id: int) -> list[Branch]:
    return list(db.scalars(
        select(Branch).where(Branch.company_id == company_id, Branch.is_active.is_(True)).order_by(Branch.code)
    ))


def active_products(db: Session, company_id: int) -> list[Product]:
    return list(db.scalars(
        select(Product).where(Product.company_id == company_id, Product.is_active.is_(True)).order_by(Product.sku)
    ).unique())


def business_matrix(
    db: Session, company_id: int, metric: str, date_from: dt.date | None = None,
    date_to: dt.date | None = None, period: str | None = None,
) -> tuple[list[list[float]], list[str], list[str], str]:
    """Devuelve (valores, etiquetas_filas=sucursales, etiquetas_columnas=productos, descripción)."""
    branches, products = active_branches(db, company_id), active_products(db, company_id)
    if not branches or not products:
        raise HTTPException(status_code=400, detail="Se requieren sucursales y productos activos.")
    b_index = {b.id: i for i, b in enumerate(branches)}
    p_index = {p.id: j for j, p in enumerate(products)}
    grid = [[0.0] * len(products) for _ in branches]

    if metric in ("quantity", "amount"):
        col = SaleDetail.quantity if metric == "quantity" else SaleDetail.subtotal
        stmt = (
            select(Sale.branch_id, SaleDetail.product_id, func.sum(col))
            .join(SaleDetail, SaleDetail.sale_id == Sale.id)
            .where(Sale.branch_id.in_(b_index), SaleDetail.product_id.in_(p_index), Sale.status != "anulada")
            .group_by(Sale.branch_id, SaleDetail.product_id)
        )
        if date_from:
            stmt = stmt.where(Sale.sale_date >= date_from)
        if date_to:
            stmt = stmt.where(Sale.sale_date <= date_to)
        rows = db.execute(stmt).all()
        rango = f"{date_from or 'inicio'} a {date_to or 'hoy'}"
        desc = f"{'Unidades vendidas' if metric == 'quantity' else 'Ventas en importe'} por sucursal × producto ({rango})."
    elif metric in ("target_quantity", "target_amount"):
        if not period:
            raise HTTPException(status_code=422, detail="Indique el periodo (YYYY-MM) para construir la matriz de metas.")
        col = Target.target_quantity if metric == "target_quantity" else Target.target_amount
        rows = db.execute(
            select(Target.branch_id, Target.product_id, col)
            .where(Target.period == period, Target.branch_id.in_(b_index), Target.product_id.in_(p_index))
        ).all()
        desc = f"Metas ({'unidades' if metric == 'target_quantity' else 'importe'}) del periodo {period}."
    else:  # stock
        rows = db.execute(
            select(Inventory.branch_id, Inventory.product_id, Inventory.stock)
            .where(Inventory.branch_id.in_(b_index), Inventory.product_id.in_(p_index))
        ).all()
        desc = "Existencias actuales por sucursal × producto."

    for branch_id, product_id, value in rows:
        grid[b_index[branch_id]][p_index[product_id]] = round(float(value or 0), 2)
    return grid, [b.name for b in branches], [p.name for p in products], desc


def product_vector(db: Session, company_id: int, field: str) -> tuple[list[float], list[str], str]:
    products = active_products(db, company_id)
    if not products:
        raise HTTPException(status_code=400, detail="No hay productos activos.")
    if field == "unit_price":
        values, desc = [float(p.unit_price) for p in products], "Vector de precios unitarios por producto."
    elif field == "unit_cost":
        values, desc = [float(p.unit_cost) for p in products], "Vector de costos unitarios por producto."
    else:
        values = [float(p.unit_price) - float(p.unit_cost) for p in products]
        desc = "Vector de margen unitario (precio − costo) por producto."
    return values, [p.name for p in products], desc
