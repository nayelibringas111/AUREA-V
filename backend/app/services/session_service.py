"""Registro de sesiones de acceso y datos del carnet de auditoría."""
import datetime as dt
import hashlib
import hmac
from collections import defaultdict
from zoneinfo import ZoneInfo

from fastapi import Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import AuditLog, Company, LoginSession, Operation, User
from app.services import geo_service
from app.services.audit_service import client_ip


def _tz() -> ZoneInfo:
    return ZoneInfo(settings.TIMEZONE)


def local_date(ts: dt.datetime) -> dt.date:
    if ts.tzinfo is None:  # SQLite devuelve fechas sin zona (UTC)
        ts = ts.replace(tzinfo=dt.UTC)
    return ts.astimezone(_tz()).date()


def record_login(
    db: Session, *, request: Request | None, user: User | None, identifier: str, method: str, status: str,
    reason: str | None = None, face_distance: float | None = None, brightness: float | None = None,
    location: dict | None = None, resolve_location: bool = True,
) -> LoginSession:
    ip = client_ip(request)
    loc = location or {}
    geo = geo_service.resolve(loc.get("latitude"), loc.get("longitude"), ip) if resolve_location else {}
    s = LoginSession(
        user_id=user.id if user else None, identifier=identifier[:255], method=method, status=status, reason=reason,
        face_distance=round(face_distance, 4) if face_distance is not None else None, brightness=brightness,
        ip_address=ip, user_agent=(request.headers.get("user-agent", "")[:255] if request else None),
        accuracy_m=loc.get("accuracy"),
        **{k: geo.get(k) for k in ("latitude", "longitude", "location_source", "country", "department", "province",
                                   "district", "address")},
    )
    db.add(s)
    db.flush()
    return s


def recent_face_failures(db: Session, dni: str) -> int:
    since = dt.datetime.now(dt.UTC) - dt.timedelta(minutes=settings.FACE_LOCK_MINUTES)
    return db.scalar(
        select(func.count()).select_from(LoginSession).where(
            LoginSession.identifier == dni, LoginSession.method == "face", LoginSession.status == "error",
            LoginSession.created_at >= since,
        )
    ) or 0


def session_dict(s: LoginSession | None) -> dict | None:
    if s is None:
        return None
    return {
        "id": s.id, "method": s.method, "status": s.status, "reason": s.reason, "ip_address": s.ip_address,
        "location_source": s.location_source, "country": s.country, "department": s.department,
        "province": s.province, "district": s.district, "address": s.address, "latitude": s.latitude,
        "longitude": s.longitude, "accuracy_m": s.accuracy_m, "face_distance": s.face_distance,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _company_user_ids(cid: int):
    return select(User.id).where(User.company_id == cid)


def activity_by_day(db: Session, cid: int, days: int = 7, user_id: int | None = None) -> list[dict]:
    """Eventos por día (auditoría, inicios de sesión y operaciones) en los últimos `days` días."""
    today = dt.datetime.now(_tz()).date()
    start = today - dt.timedelta(days=days - 1)
    since = dt.datetime.combine(start, dt.time.min, tzinfo=_tz())
    ids = [user_id] if user_id else _company_user_ids(cid)
    buckets = {start + dt.timedelta(days=i): {"events": 0, "logins": 0, "operations": 0} for i in range(days)}

    def add(rows, key):
        for (ts,) in rows:
            d = local_date(ts)
            if d in buckets:
                buckets[d][key] += 1

    add(db.execute(select(AuditLog.created_at).where(AuditLog.user_id.in_(ids), AuditLog.created_at >= since)), "events")
    add(db.execute(select(LoginSession.created_at).where(LoginSession.user_id.in_(ids), LoginSession.status == "success",
                                                         LoginSession.created_at >= since)), "logins")
    add(db.execute(select(Operation.created_at).where(Operation.user_id.in_(ids), Operation.created_at >= since)),
        "operations")
    return [{"date": d.isoformat(), **v} for d, v in buckets.items()]


def top_users(db: Session, cid: int, days: int = 7, limit: int = 5) -> list[dict]:
    since = dt.datetime.now(dt.UTC) - dt.timedelta(days=days)
    rows = db.execute(
        select(AuditLog.user_id, func.count())
        .where(AuditLog.user_id.in_(_company_user_ids(cid)), AuditLog.created_at >= since)
        .group_by(AuditLog.user_id).order_by(func.count().desc()).limit(limit)
    ).all()
    ops = dict(db.execute(
        select(Operation.user_id, func.count())
        .where(Operation.user_id.in_(_company_user_ids(cid)), Operation.created_at >= since)
        .group_by(Operation.user_id)
    ).all())
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_([r[0] for r in rows])))}
    return [
        {"user_id": uid, "name": users[uid].full_name, "role": users[uid].role.name, "events": n,
         "operations": ops.get(uid, 0)}
        for uid, n in rows if uid in users
    ]


def carnet_code(user: User) -> tuple[str, str]:
    code = f"MF-{user.company_id or 0:02d}-{user.id:05d}"
    sig = hmac.new(settings.SECRET_KEY.encode(), f"{code}|{user.dni}|{user.email}".encode(), hashlib.sha256)
    return code, sig.hexdigest()[:12].upper()


def carnet(db: Session, user: User) -> dict:
    cid = user.company_id
    company = db.get(Company, cid) if cid else None
    sessions = list(db.scalars(
        select(LoginSession).where(LoginSession.user_id == user.id, LoginSession.status == "success")
        .order_by(LoginSession.created_at.desc(), LoginSession.id.desc()).limit(6)
    ))
    my_activity = activity_by_day(db, cid, 7, user_id=user.id)
    company_activity = activity_by_day(db, cid, 7)
    code, verification = carnet_code(user)
    by_module: dict[str, int] = defaultdict(int)
    since = dt.datetime.now(dt.UTC) - dt.timedelta(days=7)
    for (module,) in db.execute(select(AuditLog.module).where(AuditLog.user_id == user.id, AuditLog.created_at >= since)):
        by_module[module] += 1
    return {
        "code": code,
        "verification": verification,
        "issued_at": dt.datetime.now(dt.UTC).isoformat(),
        "valid_until": (dt.date.today() + dt.timedelta(days=365)).isoformat(),
        "user": {
            "id": user.id, "full_name": user.full_name, "email": user.email, "dni": user.dni,
            "role": user.role.name, "photo": user.photo, "face_enrolled": user.face_enrolled,
            "member_since": user.created_at.isoformat() if user.created_at else None,
        },
        "company": {"name": company.name, "legal_name": company.legal_name, "ruc": company.ruc} if company else None,
        "current_session": session_dict(sessions[0]) if sessions else None,
        "recent_sessions": [session_dict(s) for s in sessions[1:]],
        "activity_7d": my_activity,
        "company_activity_7d": company_activity,
        "totals_7d": {k: sum(d[k] for d in my_activity) for k in ("events", "logins", "operations")},
        "modules_7d": sorted(({"module": k, "events": v} for k, v in by_module.items()), key=lambda x: -x["events"]),
        "top_users": top_users(db, cid, 7),
    }
