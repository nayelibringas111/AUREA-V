from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


def _engine_kwargs(url: str) -> dict:
    if url.startswith("sqlite"):
        return {"connect_args": {"check_same_thread": False}}
    kwargs: dict = {"pool_pre_ping": True, "pool_size": 5, "max_overflow": 5, "pool_recycle": 300}
    # El "Transaction pooler" de Supabase (puerto 6543) no admite prepared statements.
    if ":6543" in url:
        kwargs["connect_args"] = {"prepare_threshold": None}
    return kwargs


engine = create_engine(settings.DATABASE_URL, **_engine_kwargs(settings.DATABASE_URL))
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
