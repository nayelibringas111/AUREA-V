import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import ORMModel

OperationType = Literal[
    "vector_add",
    "vector_subtract",
    "vector_scalar",
    "dot_product",
    "matrix_add",
    "matrix_subtract",
    "matrix_scalar",
    "matrix_multiply",
    "matrix_transpose",
    "linear_combination",
]


# ---------------- Vectores ----------------
class VectorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    values: list[float] = Field(min_length=1, max_length=200)
    labels: list[str] | None = None

    @model_validator(mode="after")
    def labels_match(self):
        if self.labels is not None and len(self.labels) != len(self.values):
            raise ValueError("La cantidad de etiquetas debe coincidir con la dimensión del vector.")
        return self


class VectorUpdate(VectorCreate):
    pass


class VectorOut(ORMModel):
    id: int
    name: str
    description: str | None
    dimension: int
    labels: list[str] | None
    source: str
    created_at: dt.datetime | None
    values: list[float]


# ---------------- Matrices ----------------
class MatrixCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    values: list[list[float]] = Field(min_length=1, max_length=200)
    row_labels: list[str] | None = None
    col_labels: list[str] | None = None

    @model_validator(mode="after")
    def rectangular(self):
        widths = {len(r) for r in self.values}
        if len(widths) != 1 or 0 in widths:
            raise ValueError("Todas las filas deben tener la misma cantidad de columnas (> 0).")
        cols = widths.pop()
        if cols > 200:
            raise ValueError("Máximo 200 columnas.")
        if self.row_labels is not None and len(self.row_labels) != len(self.values):
            raise ValueError("Las etiquetas de fila no coinciden con el número de filas.")
        if self.col_labels is not None and len(self.col_labels) != cols:
            raise ValueError("Las etiquetas de columna no coinciden con el número de columnas.")
        return self


class MatrixUpdate(MatrixCreate):
    pass


class MatrixOut(ORMModel):
    id: int
    name: str
    description: str | None
    rows: int
    cols: int
    row_labels: list[str] | None
    col_labels: list[str] | None
    source: str
    created_at: dt.datetime | None
    values: list[list[float]]


class MatrixFromSales(BaseModel):
    """Genera una matriz sucursal × producto a partir de las ventas persistidas."""

    name: str | None = None
    metric: Literal["quantity", "amount", "target_quantity", "target_amount", "stock"] = "quantity"
    date_from: dt.date | None = None
    date_to: dt.date | None = None
    period: str | None = Field(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$", description="Para metas")


class VectorFromProducts(BaseModel):
    name: str | None = None
    field: Literal["unit_price", "unit_cost", "margin"] = "unit_price"


# ---------------- Operaciones ----------------
class OperandIn(BaseModel):
    kind: Literal["vector", "matrix"]
    id: int | None = Field(default=None, description="ID de un vector/matriz guardado")
    values: list[float] | list[list[float]] | None = Field(default=None, description="Valores en línea")
    label: str | None = None
    row_labels: list[str] | None = Field(default=None, description="Etiquetas para valores en línea")
    col_labels: list[str] | None = None

    @model_validator(mode="after")
    def id_or_values(self):
        if self.id is None and self.values is None:
            raise ValueError("Cada operando requiere 'id' o 'values'.")
        return self


class OperationCreate(BaseModel):
    operation_type: OperationType
    operands: list[OperandIn] = Field(min_length=1, max_length=10)
    scalar: float | None = None
    coefficients: list[float] | None = None
    description: str | None = Field(default=None, max_length=255)
    save_result_as: str | None = Field(default=None, max_length=150, description="Guardar resultado con este nombre")


class OperationInputOut(ORMModel):
    position: int
    operand_kind: str
    label: str | None
    vector_id: int | None
    matrix_id: int | None
    values: list
    shape: list[int]


class OperationResultOut(ORMModel):
    result_kind: str
    values: float | list
    shape: list[int]
    interpretation: str | None
    labels: dict | None = None
    saved_vector_id: int | None
    saved_matrix_id: int | None


class OperationOut(ORMModel):
    id: int
    operation_type: str
    description: str | None
    status: str
    scalar: float | None
    coefficients: list[float] | None
    duration_ms: float | None
    error_message: str | None
    user_id: int | None
    created_at: dt.datetime | None
    inputs: list[OperationInputOut]
    result: OperationResultOut | None


class OperationSummary(ORMModel):
    id: int
    operation_type: str
    description: str | None
    status: str
    duration_ms: float | None
    error_message: str | None
    user_id: int | None
    created_at: dt.datetime | None
