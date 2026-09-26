"""Pruebas unitarias del motor matemático (Fase 4 / CA-06, CA-07)."""
import numpy as np
import pytest

from app import algorithms as alg


# ------------------------------- vectores
def test_sum_vector():
    assert alg.sum_vector([1, 2, 3], [4, 5, 6]).tolist() == [5, 7, 9]


def test_subtract_vector_real_minus_target():
    ventas, metas = [120, 80, 50], [100, 90, 50]
    assert alg.subtract_vector(ventas, metas).tolist() == [20, -10, 0]


def test_scalar_multiply_vector():
    np.testing.assert_allclose(alg.scalar_multiply(1.1, [100, 200]), [110, 220])


def test_dot_product_revenue():
    cantidades, precios = [2, 3, 10], [3200, 750, 60]
    assert alg.dot_product(cantidades, precios) == 2 * 3200 + 3 * 750 + 10 * 60


def test_vector_dimension_mismatch():
    with pytest.raises(alg.AlgebraError, match="(?i)dimensi"):
        alg.sum_vector([1, 2], [1, 2, 3])
    with pytest.raises(alg.AlgebraError):
        alg.dot_product([1, 2], [1])


def test_vector_validation():
    with pytest.raises(alg.AlgebraError):
        alg.validate_vector([])
    with pytest.raises(alg.AlgebraError):
        alg.validate_vector([[1, 2]])
    with pytest.raises(alg.AlgebraError):
        alg.validate_vector([1, "x"])
    with pytest.raises(alg.AlgebraError):
        alg.validate_vector([1, float("nan")])


# ------------------------------- matrices
A = [[1, 2], [3, 4]]
B = [[5, 6], [7, 8]]


def test_add_subtract_matrix():
    assert alg.add_matrix(A, B).tolist() == [[6, 8], [10, 12]]
    assert alg.subtract_matrix(B, A).tolist() == [[4, 4], [4, 4]]


def test_multiply_matrix():
    assert alg.multiply_matrix(A, B).tolist() == [[19, 22], [43, 50]]


def test_multiply_matrix_by_vector_revenue_per_branch():
    Q = [[2, 1, 5], [1, 0, 3]]  # sucursales × productos
    p = [3200, 750, 60]
    assert alg.multiply_matrix(Q, p).tolist() == [2 * 3200 + 750 + 300, 3200 + 180]


def test_multiply_rectangular_shapes():
    res = alg.multiply_matrix(np.ones((5, 3)), np.ones((3, 2)))
    assert res.shape == (5, 2)
    with pytest.raises(alg.AlgebraError, match="columnas de A"):
        alg.multiply_matrix(np.ones((2, 3)), np.ones((2, 3)))


def test_transpose():
    assert alg.transpose_matrix([[1, 2, 3], [4, 5, 6]]).tolist() == [[1, 4], [2, 5], [3, 6]]


def test_scalar_multiply_matrix():
    assert alg.scalar_multiply_matrix(2, A).tolist() == [[2, 4], [6, 8]]


def test_matrix_validation():
    with pytest.raises(alg.AlgebraError, match="misma cantidad"):
        alg.validate_matrix([[1, 2], [3]])
    with pytest.raises(alg.AlgebraError):
        alg.validate_matrix([1, 2, 3])
    with pytest.raises(alg.AlgebraError):
        alg.add_matrix(A, [[1, 2, 3], [4, 5, 6]])


def test_determinant():
    assert alg.determinant(A) == pytest.approx(-2)
    with pytest.raises(alg.AlgebraError):
        alg.determinant([[1, 2, 3], [4, 5, 6]])


# ------------------------------- combinación lineal
def test_linear_combination_vectors():
    res = alg.linear_combination([[1, 0], [0, 1], [1, 1]], [2, 3, 1])
    assert res.tolist() == [3, 4]


def test_linear_combination_matrices():
    res = alg.linear_combination([A, B], [0.5, 0.5])
    assert res.tolist() == [[3, 4], [5, 6]]


def test_linear_combination_errors():
    with pytest.raises(alg.AlgebraError, match="coeficientes"):
        alg.linear_combination([[1, 2], [3, 4]], [1])
    with pytest.raises(alg.AlgebraError):
        alg.linear_combination([[1, 2], [3, 4, 5]], [1, 1])


def test_scalar_validation():
    with pytest.raises(alg.AlgebraError):
        alg.scalar_multiply(None, [1])
    with pytest.raises(alg.AlgebraError):
        alg.scalar_multiply(float("inf"), [1])
