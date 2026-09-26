"""Ubicación del inicio de sesión: departamento, provincia, distrito y dirección.

1. Si el navegador comparte coordenadas GPS (con permiso del usuario) se hace geocodificación
   inversa con Nominatim (OpenStreetMap).
2. Si no, se estima la ubicación por la IP pública (solo departamento/ciudad, aproximada).
Cualquier fallo de red devuelve datos vacíos: el login nunca se bloquea por la ubicación.
"""
import ipaddress
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger("aurea.geo")
TIMEOUT = httpx.Timeout(3.5)


def _headers() -> dict:
    return {"User-Agent": f"AureaV/1.0 ({settings.GEOCODER_CONTACT})", "Accept-Language": "es"}


def _clean(value: str | None) -> str | None:
    if not value:
        return None
    for prefix in ("Departamento de ", "Provincia de ", "Distrito de "):
        if value.startswith(prefix):
            return value[len(prefix):]
    return value


def reverse_geocode(lat: float, lon: float) -> dict:
    try:
        r = httpx.get(settings.GEOCODER_URL, params={"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 18,
                                                     "addressdetails": 1}, headers=_headers(), timeout=TIMEOUT)
        r.raise_for_status()
        a = r.json().get("address", {})
    except Exception as exc:  # noqa: BLE001
        logger.warning("Geocodificación inversa falló: %s", exc)
        return {}
    road = a.get("road") or a.get("pedestrian") or a.get("residential") or a.get("neighbourhood")
    address = " ".join(x for x in [road, a.get("house_number")] if x) or None
    if address and a.get("suburb") and a.get("suburb") not in address:
        address = f"{address}, {a['suburb']}"
    return {
        "country": a.get("country"),
        "department": _clean(a.get("state") or a.get("region")),
        "province": _clean(a.get("province") or a.get("county") or a.get("state_district")),
        # En Perú el distrito (admin_level 8) suele venir como city/town/village; suburb es la urbanización
        "district": _clean(a.get("city_district") or a.get("town") or a.get("village") or a.get("city")
                           or a.get("municipality") or a.get("suburb")),
        "address": address,
    }


def ip_lookup(ip: str | None) -> dict:
    if not ip:
        return {}
    try:
        if not ipaddress.ip_address(ip).is_global:
            return {}
    except ValueError:
        return {}
    try:
        r = httpx.get(settings.IP_GEO_URL.format(ip=ip), headers=_headers(), timeout=TIMEOUT)
        r.raise_for_status()
        d = r.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Geolocalización por IP falló: %s", exc)
        return {}
    if d.get("error"):
        return {}
    return {
        "country": d.get("country_name"),
        "department": _clean(d.get("region")),
        "district": d.get("city"),
        "latitude": d.get("latitude"),
        "longitude": d.get("longitude"),
    }


def resolve(lat: float | None, lon: float | None, ip: str | None) -> dict:
    """Devuelve los datos de ubicación y la fuente usada (gps | ip | none)."""
    if not settings.GEOLOCATION_ENABLED:
        return {"location_source": "none"}
    if lat is not None and lon is not None:
        data = reverse_geocode(lat, lon)
        return {**data, "latitude": lat, "longitude": lon, "location_source": "gps"}
    data = ip_lookup(ip)
    return {**data, "location_source": "ip" if data else "none"}
