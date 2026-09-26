"""Indicadores empresariales calculados con álgebra lineal (NumPy).

Notación usada en las respuestas:
  Q  = matriz de unidades vendidas   (sucursales × productos)
  A  = matriz de ventas en importe   (sucursales × productos)
  T  = matriz de metas en importe    (sucursales × productos)
  S  = matriz de existencias         (sucursales × productos)
  c  = vector de costos unitarios    (productos)
  1  = vector de unos
"""
import calendar
import datetime as dt
from collections import defaultdict

import numpy as np
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import algorithms as alg
from app.models import AuditLog, Branch, Inventory, Operation, Sale
from app.services import algebra_service as svc


def period_bounds(period: str) -> tuple[dt.date, dt.date]:
    y, m = map(int, period.split("-"))
    return dt.date(y, m, 1), dt.date(y, m, calendar.monthrange(y, m)[1])


def current_period() -> str:
    return dt.date.today().strftime("%Y-%m")


def _shift_month(d: dt.date, months: int) -> dt.date:
    m = d.month - 1 + months
    return dt.date(d.year + m // 12, m % 12 + 1, 1)


def _mat(db: Session, cid: int, metric: str, **kw):
    values, rows, cols, _ = svc.business_matrix(db, cid, metric, **kw)
    return np.asarray(values, dtype=float), rows, cols


def _r(x: float) -> float:
    return round(float(x), 2)


# ------------------------------------------------------------------ reportes
def sales_by_branch(db: Session, cid: int, date_from=None, date_to=None) -> dict:
    A, branches, _ = _mat(db, cid, "amount", date_from=date_from, date_to=date_to)
    Q, _, _ = _mat(db, cid, "quantity", date_from=date_from, date_to=date_to)
    ones = np.ones(A.shape[1])
    amount, units = alg.multiply_matrix(A, ones), alg.multiply_matrix(Q, ones)
    total = float(amount.sum()) or 1.0
    return {
        "formula": "ventas_por_sucursal = A · 1",
        "items": [
            {"branch": b, "amount": _r(a), "units": int(u), "share": _r(a / total * 100)}
            for b, a, u in zip(branches, amount, units, strict=True)
        ],
    }


def sales_by_product(db: Session, cid: int, date_from=None, date_to=None) -> dict:
    A, _, products = _mat(db, cid, "amount", date_from=date_from, date_to=date_to)
    Q, _, _ = _mat(db, cid, "quantity", date_from=date_from, date_to=date_to)
    ones = np.ones(A.shape[0])
    amount = alg.multiply_matrix(alg.transpose_matrix(A), ones)
    units = alg.multiply_matrix(alg.transpose_matrix(Q), ones)
    total = float(amount.sum()) or 1.0
    return {
        "formula": "ventas_por_producto = Aᵀ · 1",
        "items": [
            {"product": p, "amount": _r(a), "units": int(u), "share": _r(a / total * 100)}
            for p, a, u in zip(products, amount, units, strict=True)
        ],
    }


def target_compliance(db: Session, cid: int, period: str) -> dict:
    start, end = period_bounds(period)
    A, branches, products = _mat(db, cid, "amount", date_from=start, date_to=end)
    T, _, _ = _mat(db, cid, "target_amount", period=period)
    G = alg.subtract_matrix(A, T)
    actual_b, target_b = A.sum(axis=1), T.sum(axis=1)
    actual_p, target_p = A.sum(axis=0), T.sum(axis=0)

    def pct(a, t):
        return _r(a / t * 100) if t else None

    return {
        "period": period,
        "formula": "brecha = A − T ; cumplimiento = (A·1) / (T·1)",
        "total": {"actual": _r(A.sum()), "target": _r(T.sum()), "gap": _r(G.sum()), "pct": pct(A.sum(), T.sum())},
        "by_branch": [
            {"branch": b, "actual": _r(a), "target": _r(t), "gap": _r(a - t), "pct": pct(a, t)}
            for b, a, t in zip(branches, actual_b, target_b, strict=True)
        ],
        "by_product": [
            {"product": p, "actual": _r(a), "target": _r(t), "gap": _r(a - t), "pct": pct(a, t)}
            for p, a, t in zip(products, actual_p, target_p, strict=True)
        ],
        "gap_matrix": {"rows": branches, "cols": products, "values": np.round(G, 2).tolist()},
    }


def inventory_rotation(db: Session, cid: int, days: int = 30) -> dict:
    end = dt.date.today()
    start = end - dt.timedelta(days=days - 1)
    Q, branches, products = _mat(db, cid, "quantity", date_from=start, date_to=end)
    S, _, _ = _mat(db, cid, "stock")
    avg_stock = S + Q / 2  # aproximación: stock promedio del periodo
    with np.errstate(divide="ignore", invalid="ignore"):
        rotation = np.where(avg_stock > 0, Q / avg_stock, 0.0)
        daily = Q / days
        coverage = np.where(daily > 0, S / daily, np.inf)

    mins = {
        (inv.branch.name, inv.product.name): inv.min_stock
        for inv in db.scalars(select(Inventory).join(Branch, Branch.id == Inventory.branch_id).where(Branch.company_id == cid))
    }
    items, alerts = [], []
    for i, b in enumerate(branches):
        for j, p in enumerate(products):
            row = {
                "branch": b, "product": p, "stock": int(S[i, j]), "sold": int(Q[i, j]),
                "rotation": _r(rotation[i, j]),
                "coverage_days": None if np.isinf(coverage[i, j]) else _r(coverage[i, j]),
                "min_stock": mins.get((b, p), 0),
            }
            items.append(row)
            if row["stock"] <= row["min_stock"]:
                alerts.append(row)
    by_product = [
        {"product": p, "stock": int(S[:, j].sum()), "sold": int(Q[:, j].sum()),
         "rotation": _r(Q[:, j].sum() / avg_stock[:, j].sum()) if avg_stock[:, j].sum() else 0.0}
        for j, p in enumerate(products)
    ]
    return {
        "days": days,
        "formula": "rotación = Q / (S + Q/2) ; cobertura_días = S / (Q/días)",
        "items": items,
        "by_product": by_product,
        "alerts": alerts,
    }


def performance_index(
    db: Session, cid: int, period: str, weights: tuple[float, float, float, float] = (0.4, 0.3, 0.2, 0.1)
) -> dict:
    """Índice de desempeño por sucursal = combinación lineal de indicadores normalizados (0–100)."""
    start, end = period_bounds(period)
    A, branches, products = _mat(db, cid, "amount", date_from=start, date_to=end)
    Q, _, _ = _mat(db, cid, "quantity", date_from=start, date_to=end)
    T, _, _ = _mat(db, cid, "target_amount", period=period)
    S, _, _ = _mat(db, cid, "stock")
    costs, _, _ = svc.product_vector(db, cid, "unit_cost")
    c = np.asarray(costs)
    ones = np.ones(len(products))

    sales = alg.multiply_matrix(A, ones)                       # A·1
    margin = alg.subtract_vector(sales, alg.multiply_matrix(Q, c))  # A·1 − Q·c
    target = alg.multiply_matrix(T, ones)
    compliance = np.divide(sales, target, out=np.zeros_like(sales), where=target > 0) * 100
    units = alg.multiply_matrix(Q, ones)
    stock = alg.multiply_matrix(S, ones)
    rotation = np.divide(units, stock + units / 2, out=np.zeros_like(units), where=(stock + units / 2) > 0)

    def norm(v: np.ndarray) -> np.ndarray:
        m = float(np.max(np.abs(v))) if v.size else 0.0
        return v / m * 100 if m > 0 else np.zeros_like(v)

    comps = [norm(sales), norm(margin), np.clip(compliance, 0, 150) / 1.5, norm(rotation)]
    index = alg.linear_combination(comps, list(weights))
    order = np.argsort(-index)
    return {
        "period": period,
        "weights": {"ventas": weights[0], "margen": weights[1], "cumplimiento": weights[2], "rotacion": weights[3]},
        "formula": "índice = w₁·ventas_n + w₂·margen_n + w₃·cumplimiento_n + w₄·rotación_n",
        "items": [
            {
                "rank": int(np.where(order == i)[0][0]) + 1,
                "branch": b,
                "sales": _r(sales[i]),
                "margin": _r(margin[i]),
                "compliance_pct": _r(compliance[i]),
                "rotation": _r(rotation[i]),
                "components": [_r(x[i]) for x in comps],
                "index": _r(index[i]),
            }
            for i, b in enumerate(branches)
        ],
    }


def monthly_trend(db: Session, cid: int, months: int = 6) -> dict:
    first = _shift_month(dt.date.today().replace(day=1), -(months - 1))
    branches = svc.active_branches(db, cid)
    rows = db.execute(
        select(Sale.sale_date, Sale.total)
        .where(Sale.branch_id.in_([b.id for b in branches]), Sale.sale_date >= first, Sale.status != "anulada")
    ).all()
    buckets: dict[str, float] = defaultdict(float)
    counts: dict[str, int] = defaultdict(int)
    for d, total in rows:
        key = d.strftime("%Y-%m")
        buckets[key] += float(total)
        counts[key] += 1
    series = []
    for k in range(months):
        key = _shift_month(first, k).strftime("%Y-%m")
        series.append({"period": key, "amount": _r(buckets[key]), "sales": counts[key]})
    return {"months": months, "items": series}


def operations_stats(db: Session, cid: int) -> dict:
    from app.models import User  # evitar import circular

    user_ids = select(User.id).where(User.company_id == cid)
    rows = db.execute(
        select(Operation.operation_type, Operation.status, func.count(), func.avg(Operation.duration_ms))
        .where(Operation.user_id.in_(user_ids))
        .group_by(Operation.operation_type, Operation.status)
    ).all()
    by_type: dict[str, dict] = defaultdict(lambda: {"success": 0, "error": 0, "avg_ms": 0.0})
    total = ok = 0
    for op_type, status, n, avg in rows:
        by_type[op_type][status] = n
        if status == "success":
            by_type[op_type]["avg_ms"] = _r(avg or 0)
            ok += n
        total += n
    return {
        "total": total,
        "success": ok,
        "errors": total - ok,
        "success_rate": _r(ok / total * 100) if total else None,
        "by_type": [{"operation_type": k, **v} for k, v in sorted(by_type.items())],
    }


def recent_activity(db: Session, cid: int, limit: int = 8) -> list[dict]:
    from app.models import User

    logs = db.scalars(
        select(AuditLog)
        .where(AuditLog.user_id.in_(select(User.id).where(User.company_id == cid)))
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(limit)
    )
    return [
        {"id": log.id, "user": log.user_email, "action": log.action, "module": log.module,
         "status": log.status, "created_at": log.created_at.isoformat() if log.created_at else None}
        for log in logs
    ]


def dashboard(db: Session, cid: int, period: str | None = None) -> dict:
    period = period or current_period()
    start, end = period_bounds(period)
    A, branches, products = _mat(db, cid, "amount", date_from=start, date_to=end)
    Q, _, _ = _mat(db, cid, "quantity", date_from=start, date_to=end)
    costs, _, _ = svc.product_vector(db, cid, "unit_cost")
    revenue = float(A.sum())
    cost = float(alg.dot_product(Q.sum(axis=0), costs))  # (Qᵀ·1) · c
    sales_count = db.scalar(
        select(func.count()).select_from(Sale).where(
            Sale.branch_id.in_([b.id for b in svc.active_branches(db, cid)]),
            Sale.sale_date.between(start, end), Sale.status != "anulada",
        )
    ) or 0
    compliance = target_compliance(db, cid, period)
    rotation = inventory_rotation(db, cid)
    ops = operations_stats(db, cid)
    return {
        "period": period,
        "kpis": {
            "revenue": _r(revenue),
            "units": int(Q.sum()),
            "sales_count": sales_count,
            "avg_ticket": _r(revenue / sales_count) if sales_count else 0,
            "gross_margin": _r(revenue - cost),
            "margin_pct": _r((revenue - cost) / revenue * 100) if revenue else 0,
            "compliance_pct": compliance["total"]["pct"],
            "low_stock": len(rotation["alerts"]),
            "operations": ops["total"],
            "operations_success_rate": ops["success_rate"],
        },
        "sales_by_branch": sales_by_branch(db, cid, start, end)["items"],
        "sales_by_product": sales_by_product(db, cid, start, end)["items"],
        "compliance_by_branch": compliance["by_branch"],
        "monthly_trend": monthly_trend(db, cid, 6)["items"],
        "inventory_by_product": rotation["by_product"],
        "low_stock": rotation["alerts"][:10],
        "recent_activity": recent_activity(db, cid),
        "formulas": {
            "ingresos": "Σ A",
            "costo": "(Qᵀ·1) · c",
            "ventas_por_sucursal": "A · 1",
            "ventas_por_producto": "Aᵀ · 1",
            "cumplimiento": "(A·1) / (T·1)",
        },
    }
