import datetime as dt

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORMModel


class SaleDetailIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, le=100000)
    unit_price: float | None = Field(default=None, gt=0, description="Si se omite se usa el precio de lista.")


class SaleCreate(BaseModel):
    branch_id: int
    sale_date: dt.date = Field(default_factory=dt.date.today)
    customer: str | None = None
    details: list[SaleDetailIn] = Field(min_length=1)


class ProductMini(ORMModel):
    id: int
    sku: str
    name: str


class BranchMini(ORMModel):
    id: int
    code: str
    name: str
    city: str


class SaleDetailOut(ORMModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float
    subtotal: float
    product: ProductMini


class SaleOut(ORMModel):
    id: int
    branch_id: int
    sale_date: dt.date
    customer: str | None
    total: float
    status: str
    branch: BranchMini
    details: list[SaleDetailOut]


class TargetBase(BaseModel):
    branch_id: int
    product_id: int
    period: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    target_quantity: int = Field(ge=0)
    target_amount: float = Field(ge=0)


class TargetUpdate(BaseModel):
    target_quantity: int | None = Field(default=None, ge=0)
    target_amount: float | None = Field(default=None, ge=0)


class TargetOut(TargetBase, ORMModel):
    id: int
    branch: BranchMini
    product: ProductMini


class InventoryOut(ORMModel):
    id: int
    branch_id: int
    product_id: int
    stock: int
    min_stock: int
    branch: BranchMini
    product: ProductMini


class InventoryUpdate(BaseModel):
    min_stock: int = Field(ge=0)


class MovementCreate(BaseModel):
    branch_id: int
    product_id: int
    movement_type: str = Field(pattern="^(entrada|salida|ajuste)$")
    quantity: int = Field(description="Entrada/salida: > 0. Ajuste: stock final deseado (≥ 0).")
    reason: str | None = None

    @field_validator("quantity")
    @classmethod
    def non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("La cantidad no puede ser negativa.")
        return v


class MovementOut(ORMModel):
    id: int
    branch_id: int
    product_id: int
    movement_type: str
    quantity: int
    reason: str | None
    created_at: dt.datetime
    branch: BranchMini
    product: ProductMini
