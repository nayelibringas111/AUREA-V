import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.api.routes import (
    audit,
    auth,
    branches,
    companies,
    inventory,
    matrices,
    operations,
    products,
    reports,
    sales,
    targets,
    users,
    vectors,
)
from app.core.config import settings
from app.core.database import SessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aurea")

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="API empresarial de análisis de ventas, inventario e indicadores mediante álgebra lineal (NumPy).",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    errors = [
        {"campo": ".".join(str(p) for p in e["loc"] if p != "body"), "mensaje": e["msg"].replace("Value error, ", "")}
        for e in exc.errors()
    ]
    first = errors[0] if errors else {"campo": "", "mensaje": "Datos inválidos"}
    msg = f"{first['campo']}: {first['mensaje']}" if first["campo"] else first["mensaje"]
    return JSONResponse(status_code=422, content={"detail": msg, "errors": errors})


@app.exception_handler(IntegrityError)
async def integrity_handler(_: Request, exc: IntegrityError):
    logger.info("IntegrityError: %s", exc.orig)
    return JSONResponse(status_code=409, content={"detail": "Ya existe un registro con esos datos (código, nombre o SKU duplicado)."})


for r in (auth, users, companies, branches, products, sales, inventory, targets, vectors, matrices, operations,
          reports, audit):
    app.include_router(r.router, prefix=settings.API_PREFIX)


@app.get("/", tags=["Sistema"])
def root():
    return {"name": settings.APP_NAME, "version": "1.0.0", "docs": "/docs", "health": "/health"}


@app.get("/health", tags=["Sistema"])
def health():
    db_ok = True
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        logger.warning("Health check DB error: %s", exc)
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "database": db_ok, "environment": settings.ENVIRONMENT}
