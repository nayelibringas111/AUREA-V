import datetime as dt

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ADMIN, company_id_of, require_roles
from app.models import AuditLog, LoginSession, User
from app.schemas.audit import AuditLogOut
from app.schemas.common import Page
from app.services import session_service

router = APIRouter(prefix="/audit", tags=["Auditoría"])
admin_only = require_roles(ADMIN)


@router.get("", response_model=Page[AuditLogOut])
def list_audit(
    db: Session = Depends(get_db),
    user: User = Depends(admin_only),
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


@router.get("/sessions")
def list_sessions(
    db: Session = Depends(get_db),
    user: User = Depends(admin_only),
    method: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    """Inicios de sesión con método (contraseña / facial), resultado y ubicación."""
    company_users = select(User.id).where(User.company_id == company_id_of(user))
    filters = [(LoginSession.user_id.in_(company_users)) | (LoginSession.user_id.is_(None))]
    if method:
        filters.append(LoginSession.method == method)
    if status:
        filters.append(LoginSession.status == status)
    total = db.scalar(select(func.count()).select_from(LoginSession).where(*filters)) or 0
    rows = db.scalars(select(LoginSession).where(*filters)
                      .order_by(LoginSession.created_at.desc(), LoginSession.id.desc())
                      .offset((page - 1) * size).limit(size)).all()
    names = {u.id: u.full_name for u in db.scalars(select(User).where(User.id.in_({r.user_id for r in rows if r.user_id})))}
    items = [{**session_service.session_dict(r), "user": names.get(r.user_id), "identifier": r.identifier} for r in rows]
    return {"items": items, "total": total, "page": page, "size": size}


@router.get("/locations")
def locations(db: Session = Depends(get_db), user: User = Depends(admin_only), days: int = Query(30, ge=1, le=365)):
    """Accesos exitosos agrupados por departamento y distrito."""
    since = dt.datetime.now(dt.UTC) - dt.timedelta(days=days)
    rows = db.execute(
        select(LoginSession.department, LoginSession.district, func.count())
        .where(LoginSession.user_id.in_(select(User.id).where(User.company_id == company_id_of(user))),
               LoginSession.status == "success", LoginSession.created_at >= since)
        .group_by(LoginSession.department, LoginSession.district).order_by(func.count().desc())
    ).all()
    return [{"department": d or "Sin ubicación", "district": di or "—", "logins": n} for d, di, n in rows]


@router.get("/activity")
def activity(db: Session = Depends(get_db), user: User = Depends(admin_only), days: int = Query(7, ge=1, le=90)):
    return session_service.activity_by_day(db, company_id_of(user), days)


@router.get("/top-users")
def top_users(db: Session = Depends(get_db), user: User = Depends(admin_only), days: int = Query(7, ge=1, le=90),
              limit: int = Query(10, ge=1, le=50)):
    return session_service.top_users(db, company_id_of(user), days, limit)
