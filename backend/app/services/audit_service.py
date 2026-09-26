from fastapi import Request
from sqlalchemy.orm import Session

from app.models import AuditLog, User


def client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def log_event(
    db: Session,
    *,
    request: Request | None,
    user: User | None,
    action: str,
    module: str,
    entity_id: str | int | None = None,
    status: str = "success",
    detail: dict | None = None,
    user_email: str | None = None,
    commit: bool = True,
) -> None:
    db.add(
        AuditLog(
            user_id=user.id if user else None,
            user_email=user.email if user else user_email,
            action=action,
            module=module,
            entity_id=str(entity_id) if entity_id is not None else None,
            status=status,
            detail=detail,
            ip_address=client_ip(request),
        )
    )
    if commit:
        db.commit()
