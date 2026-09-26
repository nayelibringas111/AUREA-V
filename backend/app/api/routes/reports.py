import csv
import datetime as dt
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ALL_ROLES, company_id_of, require_roles
from app.models import User
from app.services import analytics_service as an

router = APIRouter(prefix="/reports", tags=["Reportes"])
any_role = require_roles(*ALL_ROLES)
PERIOD = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$")


@router.get("")
def reports_index(_: User = Depends(any_role)):
    return [
        {"key": "dashboard", "name": "Dashboard ejecutivo"},
        {"key": "sales-by-branch", "name": "Ventas por sucursal"},
        {"key": "sales-by-product", "name": "Ventas por producto"},
        {"key": "target-compliance", "name": "Cumplimiento de metas"},
        {"key": "inventory-rotation", "name": "Inventario y rotación"},
        {"key": "performance-index", "name": "Índice de desempeño (combinación lineal)"},
        {"key": "monthly-trend", "name": "Tendencia mensual"},
        {"key": "operations-stats", "name": "Indicadores de procesamiento"},
    ]


@router.get("/dashboard")
def dashboard(period: str | None = PERIOD, db: Session = Depends(get_db), user: User = Depends(any_role)):
    return an.dashboard(db, company_id_of(user), period)


@router.get("/kpis")
def kpis(period: str | None = PERIOD, db: Session = Depends(get_db), user: User = Depends(any_role)):
    return an.kpis(db, company_id_of(user), period)


@router.get("/recent-activity")
def recent_activity(limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db), user: User = Depends(any_role)):
    return an.recent_activity(db, company_id_of(user), limit)


@router.get("/sales-by-branch")
def sales_by_branch(date_from: dt.date | None = None, date_to: dt.date | None = None, db: Session = Depends(get_db),
                    user: User = Depends(any_role)):
    return an.sales_by_branch(db, company_id_of(user), date_from, date_to)


@router.get("/sales-by-product")
def sales_by_product(date_from: dt.date | None = None, date_to: dt.date | None = None, db: Session = Depends(get_db),
                     user: User = Depends(any_role)):
    return an.sales_by_product(db, company_id_of(user), date_from, date_to)


@router.get("/target-compliance")
def target_compliance(period: str | None = PERIOD, db: Session = Depends(get_db), user: User = Depends(any_role)):
    return an.target_compliance(db, company_id_of(user), period or an.current_period())


@router.get("/inventory-rotation")
def inventory_rotation(days: int = Query(30, ge=7, le=365), db: Session = Depends(get_db),
                       user: User = Depends(any_role)):
    return an.inventory_rotation(db, company_id_of(user), days)


@router.get("/performance-index")
def performance_index(
    period: str | None = PERIOD,
    w_sales: float = Query(0.4, ge=0, le=1),
    w_margin: float = Query(0.3, ge=0, le=1),
    w_compliance: float = Query(0.2, ge=0, le=1),
    w_rotation: float = Query(0.1, ge=0, le=1),
    db: Session = Depends(get_db),
    user: User = Depends(any_role),
):
    if abs(w_sales + w_margin + w_compliance + w_rotation - 1) > 1e-6:
        raise HTTPException(status_code=422, detail="Los pesos de la combinación lineal deben sumar 1.")
    return an.performance_index(db, company_id_of(user), period or an.current_period(),
                                (w_sales, w_margin, w_compliance, w_rotation))


@router.get("/monthly-trend")
def monthly_trend(months: int = Query(6, ge=1, le=24), db: Session = Depends(get_db), user: User = Depends(any_role)):
    return an.monthly_trend(db, company_id_of(user), months)


@router.get("/operations-stats")
def operations_stats(db: Session = Depends(get_db), user: User = Depends(any_role)):
    return an.operations_stats(db, company_id_of(user))


@router.get("/export/{report}.csv")
def export_csv(report: str, period: str | None = PERIOD, db: Session = Depends(get_db),
               user: User = Depends(any_role)):
    cid = company_id_of(user)
    period = period or an.current_period()
    start, end = an.period_bounds(period)
    if report == "sales-by-branch":
        rows = an.sales_by_branch(db, cid, start, end)["items"]
    elif report == "sales-by-product":
        rows = an.sales_by_product(db, cid, start, end)["items"]
    elif report == "target-compliance":
        rows = an.target_compliance(db, cid, period)["by_branch"]
    elif report == "inventory-rotation":
        rows = an.inventory_rotation(db, cid)["items"]
    elif report == "performance-index":
        rows = [{k: v for k, v in r.items() if k != "components"} for r in an.performance_index(db, cid, period)["items"]]
    else:
        raise HTTPException(status_code=404, detail="Reporte no disponible para exportación.")
    buf = io.StringIO()
    if rows:
        writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    data = "﻿" + buf.getvalue()  # BOM para que Excel respete tildes
    return StreamingResponse(
        iter([data]), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{report}-{period}.csv"'},
    )
