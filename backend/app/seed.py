"""Carga inicial de la empresa TecnoAndes Distribuciones S.A.C.

Es idempotente: si la empresa ya existe no vuelve a insertar datos. Uso:
    python -m app.seed            # crea datos si no existen
    python -m app.seed --reset    # (solo desarrollo) borra todo y recrea
"""
import calendar
import datetime as dt
import random
import sys
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.deps import ADMIN, ANALYST, ROLE_PERMISSIONS, VIEWER
from app.core.security import hash_password
from app.models import (
    AuditLog,
    Branch,
    Category,
    Company,
    Inventory,
    InventoryMovement,
    Product,
    Role,
    Sale,
    SaleDetail,
    Target,
    User,
)
from app.schemas.algebra import OperandIn, OperationCreate
from app.services import algebra_service as svc
from app.services import operation_service

COMPANY = {
    "name": "TecnoAndes Distribuciones",
    "legal_name": "TecnoAndes Distribuciones S.A.C.",
    "ruc": "20601234571",
    "sector": "Comercialización de equipos tecnológicos",
    "address": "Av. Javier Prado Este 4200, Santiago de Surco, Lima",
    "phone": "+51 1 615-2040",
    "email": "contacto@tecnoandes.pe",
    "currency": "PEN",
}

BRANCHES = [  # code, name, city, address, manager, factor de demanda
    ("LIM", "Sede Lima", "Lima", "Av. Javier Prado Este 4200, Surco", "Carla Mendoza", 1.8),
    ("AQP", "Sede Arequipa", "Arequipa", "Av. Ejército 710, Yanahuara", "Jorge Salinas", 1.1),
    ("TRU", "Sede Trujillo", "Trujillo", "Av. España 1520, Centro", "Lucía Paredes", 0.9),
    ("CUS", "Sede Cusco", "Cusco", "Av. La Cultura 1105, Wanchaq", "Raúl Quispe", 0.7),
    ("PIU", "Sede Piura", "Piura", "Av. Grau 980, Piura", "Andrea Castillo", 0.8),
]

CATEGORIES = [("Computadoras", "Equipos de cómputo"), ("Periféricos", "Monitores y accesorios")]

PRODUCTS = [  # sku, name, category, price, cost, rango de cantidad por venta, probabilidad
    ("P-001", "Laptop", "Computadoras", 3200, 2480, (1, 2), 0.45),
    ("P-002", "PC", "Computadoras", 2800, 2150, (1, 2), 0.35),
    ("P-003", "Monitor", "Periféricos", 750, 520, (1, 3), 0.55),
    ("P-004", "Teclado", "Periféricos", 120, 65, (1, 5), 0.65),
    ("P-005", "Mouse", "Periféricos", 60, 28, (1, 6), 0.75),
]

USERS = [
    ("admin", settings.ADMIN_EMAIL, "Administrador General", ADMIN),
    ("analista", "analista@tecnoandes.pe", "María Torres (Analista)", ANALYST),
    ("consulta", "gerencia@tecnoandes.pe", "Luis Ramírez (Gerencia)", VIEWER),
]

CUSTOMERS = ["Cliente final", "Colegio San Martín", "Estudio Contable Ríos", "Clínica Santa Rosa",
             "Municipalidad Distrital", "Constructora Andina", "Universidad Regional", "Hotel Plaza"]


def _month_start(d: dt.date, shift: int) -> dt.date:
    m = d.month - 1 + shift
    return dt.date(d.year + m // 12, m % 12 + 1, 1)


def ensure_roles(db: Session) -> dict[str, Role]:
    desc = {ADMIN: "Acceso total al sistema", ANALYST: "Ventas, inventario, álgebra lineal y reportes",
            VIEWER: "Dashboard y reportes autorizados"}
    roles = {}
    for name in (ADMIN, ANALYST, VIEWER):
        role = db.scalar(select(Role).where(Role.name == name))
        if role is None:
            role = Role(name=name, description=desc[name], permissions=ROLE_PERMISSIONS[name])
            db.add(role)
        else:
            role.permissions = ROLE_PERMISSIONS[name]
        roles[name] = role
    db.flush()
    return roles


def seed(db: Session) -> bool:
    roles = ensure_roles(db)
    if db.scalar(select(Company).where(Company.ruc == COMPANY["ruc"])):
        db.commit()
        return False

    rng = random.Random(2026)
    today = dt.date.today()
    company = Company(**COMPANY)
    db.add(company)
    db.flush()

    users = {}
    for key, email, name, role in USERS:
        pwd = settings.ADMIN_PASSWORD if key == "admin" else settings.DEMO_USERS_PASSWORD
        u = db.scalar(select(User).where(User.email == email))
        if u is None:
            u = User(email=email, full_name=name, hashed_password=hash_password(pwd), role_id=roles[role].id,
                     company_id=company.id)
            db.add(u)
        users[key] = u
    db.flush()
    admin = users["admin"]

    branches = []
    for code, name, city, address, manager, factor in BRANCHES:
        b = Branch(company_id=company.id, code=code, name=name, city=city, address=address, manager=manager)
        db.add(b)
        branches.append((b, factor))
    cats = {n: Category(company_id=company.id, name=n, description=d) for n, d in CATEGORIES}
    db.add_all(cats.values())
    db.flush()
    products = []
    for sku, name, cat, price, cost, qty_range, prob in PRODUCTS:
        p = Product(company_id=company.id, category_id=cats[cat].id, sku=sku, name=name,
                    unit_price=Decimal(price), unit_cost=Decimal(cost))
        db.add(p)
        products.append((p, qty_range, prob))
    db.flush()

    # ---------------- Ventas históricas (6 meses + mes en curso) ----------------
    start = _month_start(today, -6)
    monthly: dict[tuple[str, int, int], list[float]] = {}
    d = start
    sales = []
    while d <= today:
        season = 1.25 if d.month in (3, 12) else (1.1 if d.month in (7, 11) else 1.0)
        weekend = 0.6 if d.weekday() == 6 else 1.0
        for b, factor in branches:
            n_sales = max(0, round(rng.gauss(2.0 * factor * season * weekend, 0.8)))
            for _ in range(n_sales):
                sale = Sale(branch_id=b.id, user_id=admin.id, sale_date=d, customer=rng.choice(CUSTOMERS))
                total = Decimal(0)
                for p, (lo, hi), prob in products:
                    if rng.random() > prob:
                        continue
                    q = rng.randint(lo, hi)
                    price = p.unit_price
                    if rng.random() < 0.15:  # descuento ocasional
                        price = (price * Decimal("0.95")).quantize(Decimal("0.01"))
                    sub = (price * q).quantize(Decimal("0.01"))
                    sale.details.append(SaleDetail(product_id=p.id, quantity=q, unit_price=price, subtotal=sub))
                    total += sub
                    key = (d.strftime("%Y-%m"), b.id, p.id)
                    acc = monthly.setdefault(key, [0, 0.0])
                    acc[0] += q
                    acc[1] += float(sub)
                if sale.details:
                    sale.total = total
                    sales.append(sale)
        d += dt.timedelta(days=1)
    db.add_all(sales)
    db.flush()

    # ---------------- Metas mensuales ----------------
    cur = today.strftime("%Y-%m")
    days_in_month = calendar.monthrange(today.year, today.month)[1]
    for k in range(-6, 2):
        period = _month_start(today, k).strftime("%Y-%m")
        for b, factor in branches:
            for p, (lo, hi), prob in products:
                q, amt = monthly.get((period, b.id, p.id), (0, 0.0))
                if period == cur:
                    projected = q / max(today.day, 1) * days_in_month
                    tq = round(projected * rng.uniform(0.95, 1.12))
                elif period > cur:
                    base = monthly.get((_month_start(today, -1).strftime("%Y-%m"), b.id, p.id), (0, 0))[0]
                    tq = round(base * rng.uniform(1.0, 1.1))
                else:
                    tq = round(q * rng.uniform(0.88, 1.15))
                tq = max(tq, 1)
                db.add(Target(branch_id=b.id, product_id=p.id, period=period, target_quantity=tq,
                              target_amount=Decimal(tq) * p.unit_price))

    # ---------------- Inventario ----------------
    for b, factor in branches:
        for p, (lo, hi), prob in products:
            stock = max(0, round(rng.uniform(4, 40) * factor * (2 if p.unit_price < 200 else 1)))
            min_stock = max(3, round(6 * factor * (2 if p.unit_price < 200 else 1)))
            if rng.random() < 0.15:
                stock = rng.randint(0, min_stock)  # algunas alertas de stock bajo
            db.add(Inventory(branch_id=b.id, product_id=p.id, stock=stock, min_stock=min_stock))
            db.add(InventoryMovement(branch_id=b.id, product_id=p.id, movement_type="ajuste", quantity=stock,
                                     reason="Carga inicial de inventario", user_id=admin.id))
    db.flush()

    # ---------------- Vectores, matrices y operaciones de ejemplo ----------------
    cid = company.id
    prices, labels, desc = svc.product_vector(db, cid, "unit_price")
    v_prices = svc.save_vector(db, company_id=cid, user_id=admin.id, name="Precios unitarios", values=prices,
                               labels=labels, description=desc, source="productos")
    costs, _, desc_c = svc.product_vector(db, cid, "unit_cost")
    svc.save_vector(db, company_id=cid, user_id=admin.id, name="Costos unitarios", values=costs, labels=labels,
                    description=desc_c, source="productos")
    prev = _month_start(today, -1)
    prev_end = dt.date(prev.year, prev.month, calendar.monthrange(prev.year, prev.month)[1])
    pp = prev.strftime("%Y-%m")
    q_vals, rl, cl, q_desc = svc.business_matrix(db, cid, "quantity", prev, prev_end)
    m_q = svc.save_matrix(db, company_id=cid, user_id=admin.id, name=f"Unidades vendidas {pp}", values=q_vals,
                          row_labels=rl, col_labels=cl, description=q_desc, source="ventas")
    t_vals, _, _, t_desc = svc.business_matrix(db, cid, "target_quantity", period=pp)
    m_t = svc.save_matrix(db, company_id=cid, user_id=admin.id, name=f"Metas (unidades) {pp}", values=t_vals,
                          row_labels=rl, col_labels=cl, description=t_desc, source="metas")

    demo_ops = [
        OperationCreate(operation_type="matrix_multiply", description=f"Ingresos por sucursal {pp} (Q·p)",
                        operands=[OperandIn(kind="matrix", id=m_q.id), OperandIn(kind="vector", id=v_prices.id)],
                        save_result_as=f"Ingresos por sucursal {pp}"),
        OperationCreate(operation_type="matrix_subtract", description=f"Brecha ventas − metas {pp}",
                        operands=[OperandIn(kind="matrix", id=m_q.id), OperandIn(kind="matrix", id=m_t.id)]),
        OperationCreate(operation_type="matrix_transpose", description="Perspectiva producto × sucursal",
                        operands=[OperandIn(kind="matrix", id=m_q.id)]),
        OperationCreate(operation_type="vector_scalar", description="Ajuste de precios +8 %", scalar=1.08,
                        operands=[OperandIn(kind="vector", id=v_prices.id)]),
    ]
    for op in demo_ops:
        operation_service.execute(db, admin, op)

    db.add(AuditLog(user_id=admin.id, user_email=admin.email, action="seed", module="sistema",
                    detail={"empresa": company.name, "ventas": len(sales)}))
    db.commit()
    return True


def main() -> None:
    if "--reset" in sys.argv:
        if settings.ENVIRONMENT == "production":
            raise SystemExit("No se permite --reset en producción.")
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
    with SessionLocal() as db:
        created = seed(db)
    print("Datos iniciales creados." if created else "La empresa ya existe; no se insertaron datos.")


if __name__ == "__main__":
    if not settings.SEED_ON_START and "--force" not in sys.argv:
        print("SEED_ON_START=false: se omite la carga inicial.")
    else:
        main()
