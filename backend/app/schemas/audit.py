import datetime as dt

from app.schemas.common import ORMModel


class AuditLogOut(ORMModel):
    id: int
    user_id: int | None
    user_email: str | None
    action: str
    module: str
    entity_id: str | None
    status: str
    detail: dict | None
    ip_address: str | None
    created_at: dt.datetime | None
