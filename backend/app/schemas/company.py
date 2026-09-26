from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class CompanyBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    legal_name: str | None = None
    ruc: str | None = Field(default=None, max_length=20)
    sector: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    currency: str = Field(default="PEN", min_length=3, max_length=3)


class CompanyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    legal_name: str | None = None
    ruc: str | None = None
    sector: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)


class CompanyOut(CompanyBase, ORMModel):
    id: int


class BranchBase(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=2, max_length=120)
    city: str = Field(min_length=2, max_length=80)
    address: str | None = None
    manager: str | None = None
    is_active: bool = True


class BranchUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    city: str | None = None
    address: str | None = None
    manager: str | None = None
    is_active: bool | None = None


class BranchOut(BranchBase, ORMModel):
    id: int
    company_id: int


class CategoryBase(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = None


class CategoryOut(CategoryBase, ORMModel):
    id: int


class ProductBase(BaseModel):
    sku: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=2, max_length=150)
    category_id: int | None = None
    unit_price: float = Field(gt=0)
    unit_cost: float = Field(ge=0)
    is_active: bool = True


class ProductUpdate(BaseModel):
    sku: str | None = None
    name: str | None = None
    category_id: int | None = None
    unit_price: float | None = Field(default=None, gt=0)
    unit_cost: float | None = Field(default=None, ge=0)
    is_active: bool | None = None


class ProductOut(ProductBase, ORMModel):
    id: int
    category: CategoryOut | None = None
