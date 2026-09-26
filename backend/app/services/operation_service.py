"""Ejecuta operaciones de álgebra lineal y guarda entradas, resultado, usuario, duración y estado."""
import time
from dataclasses import dataclass

import numpy as np
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import algorithms as alg
from app.models import Operation, OperationInput, OperationResult, User
from app.schemas.algebra import OperandIn, OperationCreate
from app.services import algebra_service as svc

OPERATION_LABELS = {
    "vector_add": "Suma de vectores",
    "vector_subtract": "Resta de vectores",
    "vector_scalar": "Vector por escalar",
    "dot_product": "Producto escalar",
    "matrix_add": "Suma de matrices",
    "matrix_subtract": "Resta de matrices",
    "matrix_scalar": "Matriz por escalar",
    "matrix_multiply": "Multiplicación matricial",
    "matrix_transpose": "Transpuesta",
    "linear_combination": "Combinación lineal",
}

# (tipo de operando esperado, cantidad mínima, cantidad máxima)
RULES: dict[str, tuple[str, int, int]] = {
    "vector_add": ("vector", 2, 2),
    "vector_subtract": ("vector", 2, 2),
    "vector_scalar": ("vector", 1, 1),
    "dot_product": ("vector", 2, 2),
    "matrix_add": ("matrix", 2, 2),
    "matrix_subtract": ("matrix", 2, 2),
    "matrix_scalar": ("matrix", 1, 1),
    "matrix_multiply": ("matrix", 2, 2),
    "matrix_transpose": ("matrix", 1, 1),
    "linear_combination": ("any", 1, 10),
}


@dataclass
class Resolved:
    kind: str
    data: list
    label: str | None
    vector_id: int | None = None
    matrix_id: int | None = None
    row_labels: list[str] | None = None
    col_labels: list[str] | None = None


def _resolve(db: Session, company_id: int, op: OperandIn) -> Resolved:
    if op.id is not None:
        if op.kind == "vector":
            v = svc.get_vector(db, op.id, company_id)
            return Resolved("vector", v.as_list(), op.label or v.name, vector_id=v.id, row_labels=v.labels)
        m = svc.get_matrix(db, op.id, company_id)
        return Resolved("matrix", m.as_list(), op.label or m.name, matrix_id=m.id,
                        row_labels=m.row_labels, col_labels=m.col_labels)
    return Resolved(op.kind, op.values, op.label, row_labels=op.row_labels, col_labels=op.col_labels)  # type: ignore[arg-type]


def _fmt(x: float) -> str:
    return f"{x:,.2f}"


def _interpret(op_type: str, result: np.ndarray | float, labels: dict | None, scalar: float | None) -> str:
    if isinstance(result, float):
        return (f"Resultado escalar = {_fmt(result)}. Si el primer vector representa cantidades y el segundo "
                f"precios, el valor equivale al ingreso total.")
    arr = np.asarray(result)
    parts = [f"{OPERATION_LABELS[op_type]}: resultado de dimensión {'×'.join(map(str, arr.shape))}."]
    parts.append(f"Suma total de componentes = {_fmt(float(arr.sum()))}.")
    if arr.ndim == 1:
        names = (labels or {}).get("rows")
        i_max, i_min = int(arr.argmax()), int(arr.argmin())
        n_max = names[i_max] if names and i_max < len(names) else f"posición {i_max + 1}"
        n_min = names[i_min] if names and i_min < len(names) else f"posición {i_min + 1}"
        parts.append(f"Mayor valor: {n_max} ({_fmt(float(arr[i_max]))}); menor: {n_min} ({_fmt(float(arr[i_min]))}).")
    else:
        rows = (labels or {}).get("rows")
        if rows and len(rows) == arr.shape[0]:
            totals = arr.sum(axis=1)
            k = int(totals.argmax())
            parts.append(f"Fila con mayor total: {rows[k]} ({_fmt(float(totals[k]))}).")
    if op_type == "matrix_subtract" or op_type == "vector_subtract":
        neg = int((arr < 0).sum())
        parts.append(f"Componentes negativos (por debajo de la referencia): {neg}.")
    if scalar is not None and op_type in ("vector_scalar", "matrix_scalar"):
        parts.append(f"Factor aplicado k = {scalar} ({(scalar - 1) * 100:+.1f} %).")
    return " ".join(parts)


def _compute(op_type: str, ops: list[Resolved], scalar: float | None, coefficients: list[float] | None):
    """Devuelve (resultado, etiquetas)."""
    a = ops[0]
    same = {"rows": a.row_labels, "cols": a.col_labels}
    match op_type:
        case "vector_add":
            return alg.sum_vector(a.data, ops[1].data), same
        case "vector_subtract":
            return alg.subtract_vector(a.data, ops[1].data), same
        case "vector_scalar":
            return alg.scalar_multiply(scalar, a.data), same
        case "dot_product":
            return alg.dot_product(a.data, ops[1].data), None
        case "matrix_add":
            return alg.add_matrix(a.data, ops[1].data), same
        case "matrix_subtract":
            return alg.subtract_matrix(a.data, ops[1].data), same
        case "matrix_scalar":
            return alg.scalar_multiply_matrix(scalar, a.data), same
        case "matrix_transpose":
            return alg.transpose_matrix(a.data), {"rows": a.col_labels, "cols": a.row_labels}
        case "matrix_multiply":
            b = ops[1]
            res = alg.multiply_matrix(a.data, b.data)
            if b.kind == "vector":
                return res, {"rows": a.row_labels, "cols": None}
            return res, {"rows": a.row_labels, "cols": b.col_labels}
        case "linear_combination":
            if coefficients is None:
                raise alg.AlgebraError("La combinación lineal requiere coeficientes.")
            kinds = {o.kind for o in ops}
            if len(kinds) > 1:
                raise alg.AlgebraError("Todos los operandos de la combinación deben ser del mismo tipo.")
            return alg.linear_combination([o.data for o in ops], coefficients), same
    raise alg.AlgebraError(f"Operación no soportada: {op_type}")


def execute(db: Session, user: User, payload: OperationCreate) -> Operation:
    company_id = user.company_id
    expected, lo, hi = RULES[payload.operation_type]
    if not lo <= len(payload.operands) <= hi:
        n = f"{lo}" if lo == hi else f"entre {lo} y {hi}"
        raise HTTPException(status_code=422, detail=f"{OPERATION_LABELS[payload.operation_type]} requiere {n} operando(s).")
    for i, o in enumerate(payload.operands):
        allowed = expected == "any" or o.kind == expected
        if payload.operation_type == "matrix_multiply" and i == 1 and o.kind == "vector":
            allowed = True  # A·v
        if not allowed:
            raise HTTPException(status_code=422, detail=f"El operando {i + 1} debe ser de tipo {expected}.")

    resolved = [_resolve(db, company_id, o) for o in payload.operands]

    operation = Operation(
        operation_type=payload.operation_type,
        description=payload.description or OPERATION_LABELS[payload.operation_type],
        scalar=payload.scalar,
        coefficients=payload.coefficients,
        user_id=user.id,
    )
    for pos, r in enumerate(resolved):
        arr = np.asarray(r.data, dtype=object)
        operation.inputs.append(OperationInput(
            position=pos, operand_kind=r.kind, label=r.label, vector_id=r.vector_id, matrix_id=r.matrix_id,
            values=r.data, shape=list(arr.shape) if arr.ndim <= 2 else [],
        ))

    start = time.perf_counter()
    try:
        result, labels = _compute(payload.operation_type, resolved, payload.scalar, payload.coefficients)
    except alg.AlgebraError as exc:
        operation.status = "error"
        operation.error_message = str(exc)
        operation.duration_ms = round((time.perf_counter() - start) * 1000, 3)
        db.add(operation)
        db.flush()
        return operation
    operation.duration_ms = round((time.perf_counter() - start) * 1000, 3)
    operation.status = "success"

    if isinstance(result, float):
        kind, values, shape = "scalar", round(result, 6), []
    else:
        arr = np.round(np.asarray(result, dtype=float), 6)
        kind = "vector" if arr.ndim == 1 else "matrix"
        values, shape = arr.tolist(), list(arr.shape)
    if labels and not any(labels.values()):
        labels = None

    op_result = OperationResult(
        result_kind=kind, values=values, shape=shape, labels=labels,
        interpretation=_interpret(payload.operation_type, result, labels, payload.scalar),
    )
    if payload.save_result_as and kind != "scalar":
        rl = (labels or {}).get("rows")
        cl = (labels or {}).get("cols")
        desc = f"Resultado de la operación: {operation.description}"
        if kind == "vector":
            saved = svc.save_vector(db, company_id=company_id, user_id=user.id, name=payload.save_result_as,
                                    values=values, labels=rl, description=desc, source="operacion")
            op_result.saved_vector_id = saved.id
        else:
            saved = svc.save_matrix(db, company_id=company_id, user_id=user.id, name=payload.save_result_as,
                                    values=values, row_labels=rl, col_labels=cl, description=desc,
                                    source="operacion")
            op_result.saved_matrix_id = saved.id
    operation.result = op_result
    db.add(operation)
    db.flush()
    return operation
