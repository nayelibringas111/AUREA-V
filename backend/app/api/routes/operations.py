from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import STAFF, company_id_of, require_roles
from app.models import Operation, User
from app.schemas.algebra import OperationCreate, OperationOut, OperationSummary
from app.schemas.common import Page
from app.services import operation_service
from app.services.audit_service import log_event

router = APIRouter(prefix="/operations", tags=["Operaciones"])
staff = require_roles(*STAFF)


@router.get("/types")
def operation_types(_: User = Depends(staff)):
    return [
        {"value": k, "label": v, "operand": operation_service.RULES[k][0],
         "min": operation_service.RULES[k][1], "max": operation_service.RULES[k][2]}
        for k, v in operation_service.OPERATION_LABELS.items()
    ]


@router.post("", response_model=OperationOut, status_code=201)
def run_operation(payload: OperationCreate, request: Request, db: Session = Depends(get_db),
                  user: User = Depends(staff)):
    op = operation_service.execute(db, user, payload)
    log_event(db, request=request, user=user, action="execute", module="operaciones", entity_id=op.id,
              status=op.status, detail={"type": op.operation_type, "error": op.error_message}, commit=False)
    db.commit()
    if op.status == "error":
        # La operación queda registrada en el historial con estado "error".
        raise HTTPException(status_code=422, detail={"message": op.error_message, "operation_id": op.id})
    return op


@router.get("", response_model=Page[OperationSummary])
def history(
    db: Session = Depends(get_db),
    user: User = Depends(staff),
    operation_type: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    filters = [Operation.user_id.in_(select(User.id).where(User.company_id == company_id_of(user)))]
    if operation_type:
        filters.append(Operation.operation_type == operation_type)
    if status:
        filters.append(Operation.status == status)
    total = db.scalar(select(func.count()).select_from(Operation).where(*filters)) or 0
    items = db.scalars(
        select(Operation).where(*filters).order_by(Operation.created_at.desc(), Operation.id.desc())
        .offset((page - 1) * size).limit(size)
    ).all()
    return Page(items=[OperationSummary.model_validate(o) for o in items], total=total, page=page, size=size)


@router.get("/{operation_id}", response_model=OperationOut)
def get_operation(operation_id: int, db: Session = Depends(get_db), user: User = Depends(staff)):
    op = db.get(Operation, operation_id)
    owner = db.get(User, op.user_id) if op and op.user_id else None
    if op is None or owner is None or owner.company_id != company_id_of(user):
        raise HTTPException(status_code=404, detail="Operación no encontrada.")
    return op
