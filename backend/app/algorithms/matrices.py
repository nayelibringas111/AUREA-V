import numpy as np

from app.algorithms.linear_algebra import (
    AlgebraError,
    validate_dimensions,
    validate_matrix,
    validate_scalar,
    validate_vector,
)


def add_matrix(a, b) -> np.ndarray:
    """A + B. Ej.: ventas del trimestre = ventas mes 1 + mes 2 + mes 3."""
    A, B = validate_matrix(a), validate_matrix(b)
    validate_dimensions("add", A, B)
    return A + B


def subtract_matrix(a, b) -> np.ndarray:
    """A − B. Ej.: matriz de ventas reales − matriz de metas = brecha por sucursal/producto."""
    A, B = validate_matrix(a), validate_matrix(b)
    validate_dimensions("subtract", A, B)
    return A - B


def multiply_matrix(a, b) -> np.ndarray:
    """A·B (m×n · n×p = m×p).

    Si B es un vector de n elementos se trata como columna n×1 y el resultado es un vector de m elementos.
    Ej.: cantidades (sucursal×producto) · precios (producto) = ingresos por sucursal.
    """
    A = validate_matrix(a)
    b_arr = np.asarray(b, dtype=float)
    if b_arr.ndim == 1:
        B = validate_vector(b)
        validate_dimensions("multiply", A, B)
        return A @ B
    B = validate_matrix(b)
    validate_dimensions("multiply", A, B)
    return A @ B


def transpose_matrix(a) -> np.ndarray:
    """Aᵀ. Cambia la perspectiva sucursal×producto a producto×sucursal."""
    return validate_matrix(a).T


def scalar_multiply_matrix(k, a) -> np.ndarray:
    """k·A. Ej.: proyectar un crecimiento del 8 % en todas las celdas (k = 1.08)."""
    return validate_scalar(k) * validate_matrix(a)


def determinant(a) -> float:
    A = validate_matrix(a)
    if A.shape[0] != A.shape[1]:
        raise AlgebraError("El determinante solo existe para matrices cuadradas.")
    return float(np.linalg.det(A))
