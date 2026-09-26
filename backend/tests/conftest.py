import os

# Debe configurarse antes de importar la aplicación.
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "sqlite:///./test_matrixflow.db")
os.environ.setdefault("SECRET_KEY", "clave-de-pruebas")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)


def _login(client: TestClient, email: str, password: str) -> dict:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def admin(client):
    return _login(client, "admin@tecnoandes.pe", "Admin2026!")


@pytest.fixture(scope="session")
def analyst(client):
    return _login(client, "analista@tecnoandes.pe", "Demo2026!")


@pytest.fixture(scope="session")
def viewer(client):
    return _login(client, "gerencia@tecnoandes.pe", "Demo2026!")
