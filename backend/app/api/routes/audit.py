from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ADMIN, company_id_of, require_roles
from app.models import AuditLog, User
from app.schemas.audit import AuditLogOut
from app.schemas.common import Page

router = APIRouter(prefix="/audit", tags=["Auditoría"])


@router.get("", response_model=Page[AuditLogOut])
def list_audit(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(ADMIN)),
    module: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(30, ge=1, le=200),
):
    company_users = select(User.id).where(User.company_id == company_id_of(user))
    filters = [(AuditLog.user_id.in_(company_users)) | (AuditLog.user_id.is_(None))]
    if module:
        filters.append(AuditLog.module == module)
    if status:
        filters.append(AuditLog.status == status)
    total = db.scalar(select(func.count()).select_from(AuditLog).where(*filters)) or 0
    items = db.scalars(select(AuditLog).where(*filters).order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
                       .offset((page - 1) * size).limit(size)).all()
    return Page(items=[AuditLogOut.model_validate(i) for i in items], total=total, page=page, size=size)
