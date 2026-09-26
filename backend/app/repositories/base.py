"""Repositorio genérico: encapsula el acceso a datos con SQLAlchemy para entidades simples."""
from typing import Any, Generic, TypeVar

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import Base

M = TypeVar("M", bound=Base)


class Repository(Generic[M]):
    def __init__(self, model: type[M], db: Session):
        self.model = model
        self.db = db

    def get(self, obj_id: int, company_id: int | None = None) -> M:
        obj = self.db.get(self.model, obj_id)
        if obj is None or (company_id is not None and getattr(obj, "company_id", company_id) != company_id):
            raise HTTPException(status_code=404, detail=f"{self.model.__name__} {obj_id} no encontrado.")
        return obj

    def list(self, *filters: Any, order_by: Any = None, offset: int = 0, limit: int | None = None) -> list[M]:
        stmt = select(self.model).where(*filters)
        if order_by is not None:
            stmt = stmt.order_by(order_by)
        if offset:
            stmt = stmt.offset(offset)
        if limit:
            stmt = stmt.limit(limit)
        return list(self.db.scalars(stmt).unique().all())

    def count(self, *filters: Any) -> int:
        return self.db.scalar(select(func.count()).select_from(self.model).where(*filters)) or 0

    def create(self, **data: Any) -> M:
        obj = self.model(**data)
        self.db.add(obj)
        self.db.flush()
        return obj

    def update(self, obj: M, data: dict[str, Any]) -> M:
        for key, value in data.items():
            setattr(obj, key, value)
        self.db.flush()
        return obj

    def delete(self, obj: M) -> None:
        self.db.delete(obj)
        self.db.flush()
