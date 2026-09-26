import numpy as np

from app.algorithms.linear_algebra import validate_dimensions, validate_scalar, validate_vector


def sum_vector(a, b) -> np.ndarray:
    """u + v, componente a componente. Ej.: ventas enero + ventas febrero."""
    u, v = validate_vector(a), validate_vector(b)
    validate_dimensions("add", u, v)
    return u + v


def subtract_vector(a, b) -> np.ndarray:
    """u − v. Ej.: ventas reales − metas."""
    u, v = validate_vector(a), validate_vector(b)
    validate_dimensions("subtract", u, v)
    return u - v


def scalar_multiply(k, a) -> np.ndarray:
    """k·u. Ej.: aplicar un ajuste de precios del +10 % (k = 1.10)."""
    return validate_scalar(k) * validate_vector(a)


def dot_product(a, b) -> float:
    """u · v = Σ uᵢ·vᵢ. Ej.: cantidades · precios = ingreso total."""
    u, v = validate_vector(a), validate_vector(b)
    validate_dimensions("dot", u, v)
    return float(np.dot(u, v))


def vector_norm(a) -> float:
    return float(np.linalg.norm(validate_vector(a)))
