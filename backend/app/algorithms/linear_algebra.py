"""Validaciones y combinaciones lineales (Semana 06 – Álgebra lineal).

Los algoritmos son funciones puras: reciben listas o arreglos y devuelven arreglos NumPy.
No conocen la base de datos ni FastAPI, por lo que se pueden probar y reutilizar de forma aislada.
"""
from collections.abc import Sequence

import numpy as np

MAX_DIMENSION = 200


class AlgebraError(ValueError):
    """Error de validación matemática (dimensiones incompatibles, datos no numéricos, etc.)."""


def _to_float_array(data, what: str) -> np.ndarray:
    try:
        arr = np.asarray(data, dtype=float)
    except (TypeError, ValueError) as exc:
        raise AlgebraError(f"El {what} contiene valores no numéricos.") from exc
    if not np.all(np.isfinite(arr)):
        raise AlgebraError(f"El {what} contiene valores infinitos o NaN.")
    return arr


def validate_vector(data) -> np.ndarray:
    arr = _to_float_array(data, "vector")
    if arr.ndim != 1:
        raise AlgebraError("Un vector debe ser unidimensional.")
    if arr.size == 0:
        raise AlgebraError("El vector no puede estar vacío.")
    if arr.size > MAX_DIMENSION:
        raise AlgebraError(f"La dimensión máxima permitida es {MAX_DIMENSION}.")
    return arr


def validate_matrix(data) -> np.ndarray:
    if isinstance(data, list) and data and isinstance(data[0], list):
        widths = {len(r) for r in data}
        if len(widths) != 1:
            raise AlgebraError("Todas las filas de la matriz deben tener la misma cantidad de columnas.")
    arr = _to_float_array(data, "matriz")
    if arr.ndim != 2:
        raise AlgebraError("Una matriz debe ser bidimensional (filas × columnas).")
    if arr.shape[0] == 0 or arr.shape[1] == 0:
        raise AlgebraError("La matriz no puede estar vacía.")
    if arr.shape[0] > MAX_DIMENSION or arr.shape[1] > MAX_DIMENSION:
        raise AlgebraError(f"La dimensión máxima permitida es {MAX_DIMENSION}×{MAX_DIMENSION}.")
    return arr


def validate_scalar(value) -> float:
    if value is None:
        raise AlgebraError("La operación requiere un escalar.")
    try:
        k = float(value)
    except (TypeError, ValueError) as exc:
        raise AlgebraError("El escalar debe ser numérico.") from exc
    if not np.isfinite(k):
        raise AlgebraError("El escalar debe ser un número finito.")
    return k


def validate_dimensions(operation: str, *arrays: np.ndarray) -> None:
    """Valida que las dimensiones sean compatibles con la operación solicitada."""
    if operation in {"add", "subtract", "combination"}:
        shapes = {a.shape for a in arrays}
        if len(shapes) != 1:
            detail = " vs ".join("×".join(map(str, a.shape)) for a in arrays)
            raise AlgebraError(f"Dimensiones incompatibles para la operación: {detail}. Deben ser iguales.")
    elif operation == "dot":
        a, b = arrays
        if a.shape != b.shape:
            raise AlgebraError(f"El producto escalar requiere vectores de igual dimensión ({a.size} vs {b.size}).")
    elif operation == "multiply":
        a, b = arrays
        inner_b = b.shape[0]
        if a.shape[1] != inner_b:
            raise AlgebraError(
                f"No se puede multiplicar {a.shape[0]}×{a.shape[1]} por "
                f"{'×'.join(map(str, b.shape))}: columnas de A ({a.shape[1]}) ≠ filas de B ({inner_b})."
            )


def linear_combination(operands: Sequence, coefficients: Sequence[float]) -> np.ndarray:
    """Σ cᵢ·Xᵢ  — válido para vectores o matrices del mismo tamaño."""
    if len(operands) < 1:
        raise AlgebraError("La combinación lineal requiere al menos un operando.")
    if len(operands) != len(coefficients):
        raise AlgebraError(
            f"Se recibieron {len(operands)} operandos y {len(coefficients)} coeficientes; deben coincidir."
        )
    arrays = [_to_float_array(o, "operando") for o in operands]
    validate_dimensions("combination", *arrays)
    coefs = [validate_scalar(c) for c in coefficients]
    result = np.zeros_like(arrays[0])
    for c, arr in zip(coefs, arrays, strict=True):
        result = result + c * arr
    return result
