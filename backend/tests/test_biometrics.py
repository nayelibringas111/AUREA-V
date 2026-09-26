"""Acceso con DNI + reconocimiento facial, ubicación, carnet y auditoría de sesiones."""
import numpy as np
import pytest

API = "/api/v1"
LIMA = {"latitude": -12.0866, "longitude": -76.9745, "accuracy": 20}


def face(seed: int) -> np.ndarray:
    return np.random.default_rng(seed).normal(0, 0.09, 128)


def samples(base: np.ndarray, n: int = 3, noise: float = 0.01, seed: int = 0) -> list[list[float]]:
    rng = np.random.default_rng(seed)
    return [(base + rng.normal(0, noise, 128)).tolist() for _ in range(n)]


@pytest.fixture(scope="module")
def enrolled_analyst(client, analyst):
    base = face(42)
    r = client.post(f"{API}/users/me/face", headers=analyst,
                    json={"descriptors": samples(base), "consent": True, "photo": "data:image/jpeg;base64,/9j/AAAA"})
    assert r.status_code == 200, r.text
    assert r.json()["face_enrolled"] is True
    return base


def test_enroll_requires_consent_and_consistency(client, viewer):
    base = face(7)
    r = client.post(f"{API}/users/me/face", headers=viewer, json={"descriptors": samples(base), "consent": False})
    assert r.status_code == 422 and "consentimiento" in r.json()["detail"]
    mixed = samples(base, 2) + [face(8).tolist()]  # una captura de otra persona
    r = client.post(f"{API}/users/me/face", headers=viewer, json={"descriptors": mixed, "consent": True})
    assert r.status_code == 422 and "consistentes" in r.json()["detail"]
    r = client.post(f"{API}/users/me/face", headers=viewer, json={"descriptors": [[0.1] * 10] * 3, "consent": True})
    assert r.status_code == 422


def test_face_login_success_with_location(client, enrolled_analyst):
    probe = (enrolled_analyst + np.random.default_rng(99).normal(0, 0.012, 128)).tolist()
    r = client.post(f"{API}/auth/face-login", json={
        "dni": "70000002", "descriptor": probe, "liveness": True, "brightness": 128, "location": LIMA})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["email"] == "analista@tecnoandes.pe"
    assert body["match"]["distance"] < body["match"]["threshold"]
    token = {"Authorization": f"Bearer {body['access_token']}"}
    carnet = client.get(f"{API}/auth/carnet", headers=token).json()
    loc = carnet["current_session"]
    assert loc["method"] == "face" and loc["location_source"] == "gps"
    assert (loc["department"], loc["district"]) == ("Lima", "Santiago de Surco")
    assert loc["address"].startswith("Avenida Javier Prado")
    assert len(carnet["activity_7d"]) == 7 and carnet["user"]["dni"] == "70000002"
    assert carnet["top_users"] and carnet["code"].startswith("MF-")
    assert carnet["user"]["photo"].startswith("data:image/jpeg")


def test_face_login_rejects_impostor_and_missing_liveness(client, enrolled_analyst):
    r = client.post(f"{API}/auth/face-login", json={"dni": "70000002", "descriptor": face(1234).tolist(), "liveness": True})
    assert r.status_code == 401
    r = client.post(f"{API}/auth/face-login", json={
        "dni": "70000002", "descriptor": enrolled_analyst.tolist(), "liveness": False})
    assert r.status_code == 422 and "parpadeo" in r.json()["detail"]
    # DNI inexistente: mismo mensaje genérico (no revela si el DNI existe)
    r = client.post(f"{API}/auth/face-login", json={"dni": "12345678", "descriptor": face(5).tolist(), "liveness": True})
    assert r.status_code == 401
    r = client.post(f"{API}/auth/face-login", json={"dni": "123", "descriptor": face(5).tolist(), "liveness": True})
    assert r.status_code == 422


def test_face_login_lockout(client):
    for _ in range(5):
        client.post(f"{API}/auth/face-login", json={"dni": "70000003", "descriptor": face(77).tolist(), "liveness": True})
    r = client.post(f"{API}/auth/face-login", json={"dni": "70000003", "descriptor": face(77).tolist(), "liveness": True})
    assert r.status_code == 429


def test_admin_manages_dni_and_biometrics(client, admin):
    users = client.get(f"{API}/users", headers=admin).json()
    analyst = next(u for u in users if u["email"] == "analista@tecnoandes.pe")
    admin_u = next(u for u in users if u["email"] == "admin@tecnoandes.pe")
    r = client.patch(f"{API}/users/{admin_u['id']}", headers=admin, json={"dni": analyst["dni"]})
    assert r.status_code == 409
    r = client.post(f"{API}/users/{admin_u['id']}/face", headers=admin, json={"descriptors": samples(face(3)), "consent": True})
    assert r.status_code == 200 and r.json()["face_enrolled"]
    assert client.delete(f"{API}/users/{admin_u['id']}/face", headers=admin).status_code == 204


def test_password_login_records_location(client):
    r = client.post(f"{API}/auth/login", json={"email": "gerencia@tecnoandes.pe", "password": "Demo2026!", "location": LIMA})
    token = {"Authorization": f"Bearer {r.json()['access_token']}"}
    carnet = client.get(f"{API}/auth/carnet", headers=token).json()
    assert carnet["current_session"]["method"] == "password"
    assert carnet["current_session"]["district"] == "Santiago de Surco"


def test_audit_session_endpoints(client, admin, viewer):
    s = client.get(f"{API}/audit/sessions", headers=admin, params={"method": "face"}).json()
    assert s["total"] >= 1 and any(i["status"] == "error" for i in s["items"])
    assert client.get(f"{API}/audit/locations", headers=admin).json()[0]["logins"] > 0
    act = client.get(f"{API}/audit/activity", headers=admin).json()
    assert len(act) == 7 and sum(d["logins"] for d in act) > 0
    top = client.get(f"{API}/audit/top-users", headers=admin).json()
    assert top[0]["events"] >= top[-1]["events"]
    assert client.get(f"{API}/audit/sessions", headers=viewer).status_code == 403


def test_kpis_endpoint(client, viewer):
    k = client.get(f"{API}/reports/kpis", headers=viewer).json()
    assert k["kpis"]["revenue"] > 0 and len(k["compliance_by_branch"]) == 5
