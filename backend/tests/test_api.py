"""Pruebas de API, integración, seguridad y aceptación (Fase 8)."""
import datetime as dt

API = "/api/v1"


# ---------------------------------------------------------------- CA-01 autenticación y roles
def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["database"] is True


def test_login_invalid(client):
    r = client.post(f"{API}/auth/login", json={"email": "admin@tecnoandes.pe", "password": "incorrecta"})
    assert r.status_code == 401


def test_requires_token(client):
    assert client.get(f"{API}/branches").status_code == 401
    assert client.get(f"{API}/branches", headers={"Authorization": "Bearer abc"}).status_code == 401


def test_me_modules_by_role(client, admin, analyst, viewer):
    assert "usuarios" in client.get(f"{API}/auth/me", headers=admin).json()["modules"]
    assert "usuarios" not in client.get(f"{API}/auth/me", headers=analyst).json()["modules"]
    assert client.get(f"{API}/auth/me", headers=viewer).json()["modules"] == ["dashboard", "reportes"]


def test_rbac(client, analyst, viewer):
    assert client.get(f"{API}/users", headers=analyst).status_code == 403
    assert client.get(f"{API}/sales", headers=viewer).status_code == 403
    assert client.post(f"{API}/operations", headers=viewer, json={}).status_code in (403, 422)
    assert client.get(f"{API}/reports/dashboard", headers=viewer).status_code == 200
    assert client.post(f"{API}/branches", headers=analyst,
                       json={"code": "X", "name": "Xx", "city": "Ica"}).status_code == 403


# ---------------------------------------------------------------- CA-02 sucursales y productos
def test_admin_creates_branch_and_product(client, admin):
    r = client.post(f"{API}/branches", headers=admin,
                    json={"code": "ICA", "name": "Sede Ica", "city": "Ica", "manager": "Pedro Díaz"})
    assert r.status_code == 201, r.text
    assert client.post(f"{API}/branches", headers=admin,
                       json={"code": "ICA", "name": "Duplicada", "city": "Ica"}).status_code == 409
    cats = client.get(f"{API}/categories", headers=admin).json()
    r = client.post(f"{API}/products", headers=admin, json={
        "sku": "P-006", "name": "Audífonos", "category_id": cats[0]["id"], "unit_price": 150, "unit_cost": 80})
    assert r.status_code == 201, r.text
    assert r.json()["category"]["id"] == cats[0]["id"]
    r = client.patch(f"{API}/products/{r.json()['id']}", headers=admin, json={"unit_price": 160})
    assert r.json()["unit_price"] == 160
    # deshabilitar para no alterar las matrices 5×5 del resto de pruebas
    branch_id = client.get(f"{API}/branches", headers=admin).json()
    ica = next(b for b in branch_id if b["code"] == "ICA")
    assert client.delete(f"{API}/branches/{ica['id']}", headers=admin).status_code == 204
    assert client.delete(f"{API}/products/{r.json()['id']}", headers=admin).status_code == 204


# ---------------------------------------------------------------- CA-03 ventas e inventario
def _first_inventory(client, headers):
    inv = client.get(f"{API}/inventory", headers=headers).json()
    return next(i for i in inv if i["stock"] >= 2)


def test_sale_updates_inventory(client, analyst):
    inv = _first_inventory(client, analyst)
    r = client.post(f"{API}/sales", headers=analyst, json={
        "branch_id": inv["branch_id"], "customer": "Prueba",
        "details": [{"product_id": inv["product_id"], "quantity": 2}]})
    assert r.status_code == 201, r.text
    sale = r.json()
    assert sale["total"] == sale["details"][0]["subtotal"]
    after = next(i for i in client.get(f"{API}/inventory", headers=analyst).json() if i["id"] == inv["id"])
    assert after["stock"] == inv["stock"] - 2
    # anulación devuelve el stock
    assert client.post(f"{API}/sales/{sale['id']}/cancel", headers=analyst).json()["status"] == "anulada"
    after = next(i for i in client.get(f"{API}/inventory", headers=analyst).json() if i["id"] == inv["id"])
    assert after["stock"] == inv["stock"]


def test_sale_insufficient_stock(client, analyst):
    inv = _first_inventory(client, analyst)
    r = client.post(f"{API}/sales", headers=analyst, json={
        "branch_id": inv["branch_id"], "details": [{"product_id": inv["product_id"], "quantity": 99999}]})
    assert r.status_code == 422 and "Stock insuficiente" in r.json()["detail"]


def test_inventory_movements(client, analyst):
    inv = _first_inventory(client, analyst)
    base = {"branch_id": inv["branch_id"], "product_id": inv["product_id"]}
    assert client.post(f"{API}/inventory/movements", headers=analyst,
                       json={**base, "movement_type": "entrada", "quantity": 10}).status_code == 201
    r = client.post(f"{API}/inventory/movements", headers=analyst,
                    json={**base, "movement_type": "ajuste", "quantity": inv["stock"]})
    assert r.json()["quantity"] == -10
    assert len(client.get(f"{API}/inventory/movements", headers=analyst).json()) > 0


def test_sales_pagination(client, analyst):
    r = client.get(f"{API}/sales", headers=analyst, params={"size": 5, "page": 2}).json()
    assert len(r["items"]) == 5 and r["total"] > 100


def test_targets(client, analyst):
    periods = client.get(f"{API}/targets/periods", headers=analyst).json()
    assert dt.date.today().strftime("%Y-%m") in periods
    t = client.get(f"{API}/targets", headers=analyst, params={"period": periods[0]}).json()[0]
    r = client.put(f"{API}/targets", headers=analyst, json={
        "branch_id": t["branch_id"], "product_id": t["product_id"], "period": t["period"],
        "target_quantity": 50, "target_amount": 1000})
    assert r.status_code == 200 and r.json()["id"] == t["id"]


# ---------------------------------------------------------------- CA-04/05 vectores y matrices
def test_vector_crud(client, analyst):
    r = client.post(f"{API}/vectors", headers=analyst,
                    json={"name": "Cantidades", "values": [2, 3, 10], "labels": ["Laptop", "Monitor", "Mouse"]})
    assert r.status_code == 201 and r.json()["dimension"] == 3
    vid = r.json()["id"]
    r = client.put(f"{API}/vectors/{vid}", headers=analyst, json={"name": "Cantidades", "values": [1, 1, 1]})
    assert r.json()["values"] == [1, 1, 1]
    bad = client.post(f"{API}/vectors", headers=analyst, json={"name": "x", "values": [1, 2], "labels": ["a"]})
    assert bad.status_code == 422


def test_matrix_validation_and_from_sales(client, analyst):
    bad = client.post(f"{API}/matrices", headers=analyst, json={"name": "x", "values": [[1, 2], [3]]})
    assert bad.status_code == 422
    r = client.post(f"{API}/matrices/from-sales", headers=analyst, json={"metric": "quantity"})
    assert r.status_code == 201
    m = r.json()
    assert (m["rows"], m["cols"]) == (5, 5) and len(m["row_labels"]) == 5
    prev = client.post(f"{API}/matrices/preview-from-sales", headers=analyst, json={"metric": "stock"}).json()
    assert prev["id"] == 0


# ---------------------------------------------------------------- CA-06/07/08 operaciones e historial
def test_business_operation_revenue(client, analyst):
    """Q (sucursal×producto) · p (precios) = ingresos por sucursal."""
    q = client.post(f"{API}/matrices/from-sales", headers=analyst, json={"metric": "quantity"}).json()
    p = client.post(f"{API}/vectors/from-products", headers=analyst, json={"field": "unit_price"}).json()
    r = client.post(f"{API}/operations", headers=analyst, json={
        "operation_type": "matrix_multiply",
        "operands": [{"kind": "matrix", "id": q["id"]}, {"kind": "vector", "id": p["id"]}],
        "save_result_as": "Ingresos a precio de lista"})
    assert r.status_code == 201, r.text
    op = r.json()
    assert op["status"] == "success" and op["result"]["result_kind"] == "vector"
    assert op["result"]["labels"]["rows"] == q["row_labels"]
    expected = [sum(a * b for a, b in zip(row, p["values"], strict=True)) for row in q["values"]]
    assert op["result"]["values"] == [round(x, 6) for x in expected]
    assert op["result"]["saved_vector_id"] is not None


def test_all_operation_types(client, analyst):
    cases = [
        ("vector_add", [{"kind": "vector", "values": [1, 2]}, {"kind": "vector", "values": [3, 4]}], {}, [4, 6]),
        ("vector_subtract", [{"kind": "vector", "values": [5, 5]}, {"kind": "vector", "values": [3, 4]}], {}, [2, 1]),
        ("vector_scalar", [{"kind": "vector", "values": [10, 20]}], {"scalar": 1.5}, [15, 30]),
        ("dot_product", [{"kind": "vector", "values": [1, 2, 3]}, {"kind": "vector", "values": [4, 5, 6]}], {}, 32),
        ("matrix_add", [{"kind": "matrix", "values": [[1]]}, {"kind": "matrix", "values": [[2]]}], {}, [[3]]),
        ("matrix_subtract", [{"kind": "matrix", "values": [[5]]}, {"kind": "matrix", "values": [[2]]}], {}, [[3]]),
        ("matrix_scalar", [{"kind": "matrix", "values": [[1, 2]]}], {"scalar": 3}, [[3, 6]]),
        ("matrix_transpose", [{"kind": "matrix", "values": [[1, 2]]}], {}, [[1], [2]]),
        ("matrix_multiply", [{"kind": "matrix", "values": [[1, 2]]}, {"kind": "matrix", "values": [[3], [4]]}], {}, [[11]]),
        ("linear_combination", [{"kind": "vector", "values": [1, 0]}, {"kind": "vector", "values": [0, 1]}],
         {"coefficients": [0.7, 0.3]}, [0.7, 0.3]),
    ]
    for op_type, operands, extra, expected in cases:
        r = client.post(f"{API}/operations", headers=analyst,
                        json={"operation_type": op_type, "operands": operands, **extra})
        assert r.status_code == 201, (op_type, r.text)
        assert r.json()["result"]["values"] == expected, op_type


def test_incompatible_dimensions_are_rejected_and_logged(client, analyst):
    r = client.post(f"{API}/operations", headers=analyst, json={
        "operation_type": "matrix_add",
        "operands": [{"kind": "matrix", "values": [[1, 2]]}, {"kind": "matrix", "values": [[1], [2]]}]})
    assert r.status_code == 422
    op_id = r.json()["detail"]["operation_id"]
    stored = client.get(f"{API}/operations/{op_id}", headers=analyst).json()
    assert stored["status"] == "error" and "Dimensiones incompatibles" in stored["error_message"]
    hist = client.get(f"{API}/operations", headers=analyst, params={"status": "error"}).json()
    assert any(o["id"] == op_id for o in hist["items"])


def test_wrong_operand_count(client, analyst):
    r = client.post(f"{API}/operations", headers=analyst, json={
        "operation_type": "vector_add", "operands": [{"kind": "vector", "values": [1]}]})
    assert r.status_code == 422


# ---------------------------------------------------------------- CA-10 reportes con datos persistidos
def test_reports(client, viewer):
    for path in ["dashboard", "sales-by-branch", "sales-by-product", "target-compliance", "inventory-rotation",
                 "performance-index", "monthly-trend", "operations-stats"]:
        r = client.get(f"{API}/reports/{path}", headers=viewer)
        assert r.status_code == 200, (path, r.text)
    d = client.get(f"{API}/reports/dashboard", headers=viewer).json()
    assert d["kpis"]["revenue"] > 0 and len(d["sales_by_branch"]) == 5
    assert sum(i["amount"] for i in d["sales_by_branch"]) == sum(i["amount"] for i in d["sales_by_product"])
    bad = client.get(f"{API}/reports/performance-index", headers=viewer, params={"w_sales": 0.9})
    assert bad.status_code == 422
    csv = client.get(f"{API}/reports/export/target-compliance.csv", headers=viewer)
    assert csv.status_code == 200 and "branch" in csv.text


# ---------------------------------------------------------------- CA-15 auditoría
def test_audit_log(client, admin):
    r = client.get(f"{API}/audit", headers=admin, params={"module": "auth"}).json()
    assert r["total"] > 0
    assert any(i["status"] == "error" for i in r["items"])  # login fallido registrado


def test_user_management(client, admin):
    roles = client.get(f"{API}/users/roles", headers=admin).json()
    viewer_role = next(r for r in roles if r["name"] == "consulta")
    r = client.post(f"{API}/users", headers=admin, json={
        "email": "nuevo@tecnoandes.pe", "full_name": "Usuario Nuevo", "password": "Segura2026!",
        "role_id": viewer_role["id"]})
    assert r.status_code == 201
    uid = r.json()["id"]
    assert client.post(f"{API}/users", headers=admin, json={
        "email": "nuevo@tecnoandes.pe", "full_name": "Dup", "password": "Segura2026!",
        "role_id": viewer_role["id"]}).status_code == 409
    assert client.delete(f"{API}/users/{uid}", headers=admin).status_code == 204
    r = client.post(f"{API}/auth/login", json={"email": "nuevo@tecnoandes.pe", "password": "Segura2026!"})
    assert r.status_code == 403
