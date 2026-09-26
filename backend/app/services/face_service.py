"""Verificación facial con álgebra lineal.

El navegador (face-api.js) convierte el rostro en un vector descriptor d ∈ ℝ¹²⁸.
Dos rostros son de la misma persona si la distancia euclidiana ‖d₁ − d₂‖ es menor que un umbral.
El backend guarda solo los vectores (no las imágenes del escaneo) y hace la comparación con NumPy.
"""
import numpy as np
from fastapi import HTTPException

from app import algorithms as alg
from app.core.config import settings

DIM = 128


def validate_descriptor(d: list[float]) -> np.ndarray:
    try:
        v = alg.validate_vector(d)
    except alg.AlgebraError as exc:
        raise HTTPException(status_code=422, detail=f"Descriptor facial inválido: {exc}") from None
    if v.size != DIM:
        raise HTTPException(status_code=422, detail=f"El descriptor facial debe tener {DIM} componentes.")
    norm = alg.vector_norm(v)
    if not 0.1 < norm < 10:
        raise HTTPException(status_code=422, detail="Descriptor facial fuera de rango.")
    return v


def validate_enrollment(descriptors: list[list[float]]) -> list[list[float]]:
    """Las muestras del registro deben ser consistentes entre sí (misma persona, buena captura)."""
    vs = [validate_descriptor(d) for d in descriptors]
    for i in range(len(vs)):
        for j in range(i + 1, len(vs)):
            if alg.vector_norm(alg.subtract_vector(vs[i], vs[j])) > settings.FACE_MATCH_THRESHOLD:
                raise HTTPException(
                    status_code=422,
                    detail="Las capturas no son consistentes. Mire de frente a la cámara con buena iluminación y repita.",
                )
    return [np.round(v, 6).tolist() for v in vs]


def best_distance(stored: list[list[float]], probe: list[float]) -> float:
    """min ‖dᵢ − p‖ entre los descriptores registrados y la captura actual."""
    p = validate_descriptor(probe)
    return min(alg.vector_norm(alg.subtract_vector(np.asarray(s), p)) for s in stored)


def similarity(distance: float) -> float:
    """Porcentaje orientativo de similitud (100 % = idéntico, 0 % = en el umbral o más lejos)."""
    t = settings.FACE_MATCH_THRESHOLD
    return round(max(0.0, 1 - distance / (t * 2)) * 100, 1)
