"""Interpretación de respuestas de Nominatim / ipapi (sin red: se simula httpx)."""
import httpx

from tests.conftest import REAL_IP_LOOKUP, REAL_REVERSE_GEOCODE

NOMINATIM_SURCO = {"address": {
    "house_number": "4200", "road": "Avenida Javier Prado Este", "suburb": "Monterrico",
    "city": "Santiago de Surco", "province": "Provincia de Lima", "state": "Lima", "country": "Perú"}}


class FakeResponse:
    def __init__(self, data):
        self._data = data

    def raise_for_status(self):
        pass

    def json(self):
        return self._data


def test_reverse_geocode_peru(monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda *a, **k: FakeResponse(NOMINATIM_SURCO))
    r = REAL_REVERSE_GEOCODE(-12.08, -76.97)
    assert r == {"country": "Perú", "department": "Lima", "province": "Lima", "district": "Santiago de Surco",
                 "address": "Avenida Javier Prado Este 4200, Monterrico"}


def test_ip_lookup_ignores_private_and_errors(monkeypatch):
    assert REAL_IP_LOOKUP("192.168.1.10") == {}
    assert REAL_IP_LOOKUP(None) == {}

    def boom(*a, **k):
        raise httpx.ConnectError("sin red")

    monkeypatch.setattr(httpx, "get", boom)
    assert REAL_IP_LOOKUP("190.12.34.56") == {}
    monkeypatch.setattr(httpx, "get", lambda *a, **k: FakeResponse({"region": "Arequipa", "city": "Arequipa",
                                                                     "country_name": "Peru", "latitude": -16.4}))
    assert REAL_IP_LOOKUP("190.12.34.56")["department"] == "Arequipa"
