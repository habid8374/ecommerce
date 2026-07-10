"""Electronic invoicing module: list invoices, emit, and create credit/debit notes."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..database import get_db
from ..deps import get_current_admin
from ..models import UserPublic
from ..services.invoicing import create_note, emit_and_store

router = APIRouter(prefix="/api/admin/invoices", tags=["admin"])
orders_router = APIRouter(prefix="/api/admin/orders", tags=["admin"])

PROJECT = {"_id": 0}


class NoteCreate(BaseModel):
    kind: str  # "credit" | "debit"
    reason: str = ""


@router.get("")
async def list_invoices(_: UserPublic = Depends(get_current_admin)):
    db = get_db()
    docs = await db.invoices.find({}, PROJECT).sort("created_at", -1).to_list(2000)
    return docs


@router.post("/{invoice_id}/note")
async def create_invoice_note(
    invoice_id: str, body: NoteCreate, _: UserPublic = Depends(get_current_admin)
):
    if body.kind not in ("credit", "debit"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Tipo de nota inválido")
    db = get_db()
    invoice = await db.invoices.find_one({"id": invoice_id, "type": "invoice"}, PROJECT)
    if not invoice:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Factura no encontrada")
    order = await db.orders.find_one({"id": invoice["order_id"]}, PROJECT)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido de la factura no encontrado")

    # Return the record even on failure so the UI can show the full error JSON.
    return await create_note(db, order, invoice, body.kind, body.reason)


@orders_router.post("/{order_id}/invoice")
async def emit_invoice_for_order(order_id: str, _: UserPublic = Depends(get_current_admin)):
    """Manually emit the electronic invoice for a (paid) order."""
    db = get_db()
    order = await db.orders.find_one({"id": order_id}, PROJECT)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")
    record = await emit_and_store(db, order, auto=False)
    if record is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Facturación electrónica deshabilitada o la factura ya existe.",
        )
    # Return the record even on failure so the UI can show the full error JSON.
    return record
