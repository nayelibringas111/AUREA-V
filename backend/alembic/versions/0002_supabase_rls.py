"""Activa Row Level Security en todas las tablas (protección para Supabase).

Supabase expone el esquema `public` mediante su API REST (PostgREST) con la clave `anon`.
Al activar RLS sin políticas, esa API no puede leer ni escribir nada; el backend FastAPI
se conecta como propietario de las tablas (rol postgres), por lo que no se ve afectado.

Revision ID: 0002
Revises: 0001
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = [
    "roles", "companies", "users", "branches", "categories", "products", "sales", "sale_details", "inventory",
    "inventory_movements", "targets", "vectors", "vector_values", "matrices", "matrix_values", "operations",
    "operation_inputs", "operation_results", "audit_logs",
]


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for t in TABLES:
        op.execute(f'ALTER TABLE "{t}" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for t in TABLES:
        op.execute(f'ALTER TABLE "{t}" DISABLE ROW LEVEL SECURITY')
