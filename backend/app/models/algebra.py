from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Vector(Base):
    __tablename__ = "vectors"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)
    dimension: Mapped[int] = mapped_column(Integer)
    labels: Mapped[list | None] = mapped_column(JSON)
    source: Mapped[str] = mapped_column(String(40), default="manual")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    values: Mapped[list["VectorValue"]] = relationship(
        cascade="all, delete-orphan", order_by="VectorValue.position", lazy="selectin"
    )

    def as_list(self) -> list[float]:
        return [v.value for v in sorted(self.values, key=lambda x: x.position)]


class VectorValue(Base):
    __tablename__ = "vector_values"
    __table_args__ = (UniqueConstraint("vector_id", "position", name="uq_vector_position"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    vector_id: Mapped[int] = mapped_column(ForeignKey("vectors.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    value: Mapped[float] = mapped_column(Float)


class Matrix(Base):
    __tablename__ = "matrices"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)
    rows: Mapped[int] = mapped_column(Integer)
    cols: Mapped[int] = mapped_column(Integer)
    row_labels: Mapped[list | None] = mapped_column(JSON)
    col_labels: Mapped[list | None] = mapped_column(JSON)
    source: Mapped[str] = mapped_column(String(40), default="manual")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    values: Mapped[list["MatrixValue"]] = relationship(cascade="all, delete-orphan", lazy="selectin")

    def as_list(self) -> list[list[float]]:
        grid = [[0.0] * self.cols for _ in range(self.rows)]
        for v in self.values:
            grid[v.row_index][v.col_index] = v.value
        return grid


class MatrixValue(Base):
    __tablename__ = "matrix_values"
    __table_args__ = (UniqueConstraint("matrix_id", "row_index", "col_index", name="uq_matrix_cell"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    matrix_id: Mapped[int] = mapped_column(ForeignKey("matrices.id", ondelete="CASCADE"), index=True)
    row_index: Mapped[int] = mapped_column(Integer)
    col_index: Mapped[int] = mapped_column(Integer)
    value: Mapped[float] = mapped_column(Float)


class Operation(Base):
    __tablename__ = "operations"

    id: Mapped[int] = mapped_column(primary_key=True)
    operation_type: Mapped[str] = mapped_column(String(40), index=True)
    description: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="success")  # success | error
    scalar: Mapped[float | None] = mapped_column(Float)
    coefficients: Mapped[list | None] = mapped_column(JSON)
    duration_ms: Mapped[float | None] = mapped_column(Float)
    error_message: Mapped[str | None] = mapped_column(Text)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    inputs: Mapped[list["OperationInput"]] = relationship(
        cascade="all, delete-orphan", order_by="OperationInput.position", lazy="selectin"
    )
    result: Mapped["OperationResult | None"] = relationship(
        cascade="all, delete-orphan", uselist=False, lazy="selectin"
    )


class OperationInput(Base):
    __tablename__ = "operation_inputs"

    id: Mapped[int] = mapped_column(primary_key=True)
    operation_id: Mapped[int] = mapped_column(ForeignKey("operations.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    operand_kind: Mapped[str] = mapped_column(String(10))  # vector | matrix
    label: Mapped[str | None] = mapped_column(String(150))
    vector_id: Mapped[int | None] = mapped_column(ForeignKey("vectors.id", ondelete="SET NULL"))
    matrix_id: Mapped[int | None] = mapped_column(ForeignKey("matrices.id", ondelete="SET NULL"))
    values: Mapped[list] = mapped_column(JSON)
    shape: Mapped[list] = mapped_column(JSON)


class OperationResult(Base):
    __tablename__ = "operation_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    operation_id: Mapped[int] = mapped_column(ForeignKey("operations.id", ondelete="CASCADE"), unique=True)
    result_kind: Mapped[str] = mapped_column(String(10))  # scalar | vector | matrix
    values: Mapped[float | list] = mapped_column(JSON)
    shape: Mapped[list] = mapped_column(JSON)
    interpretation: Mapped[str | None] = mapped_column(Text)
    labels: Mapped[dict | None] = mapped_column(JSON)  # {"rows": [...], "cols": [...]}
    saved_vector_id: Mapped[int | None] = mapped_column(ForeignKey("vectors.id", ondelete="SET NULL"))
    saved_matrix_id: Mapped[int | None] = mapped_column(ForeignKey("matrices.id", ondelete="SET NULL"))
