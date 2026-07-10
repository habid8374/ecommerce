"""Electronic invoicing module: list invoices, emit, and create credit/debit notes."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..database import get_db
from ..deps import get_current_admin
from ..models import UserPublic
from ..services.invoicing import create_note, emit_and_store, sync_from_factus

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


@router.post("/sync")
async def sync_invoices(_: UserPublic = Depends(get_current_admin)):
    """Import invoices already emitted in Factus that aren't stored locally."""
    db = get_db()
    result = await sync_from_factus(db)
    if not result.get("ok"):
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, result.get("error", "No se pudo sincronizar con Factus.")
        )
    return result


@router.post("/unblock-factus")
async def unblock_factus(_: UserPublic = Depends(get_current_admin)):
    """Delete Factus bills stuck as unvalidated (status 0) that block the
    numbering queue with 409 'factura pendiente por enviar a la DIAN'."""
    from ..services.factus import unblock_pending

    result = await unblock_pending()
    if not result.get("ok"):
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, result.get("error", "No se pudo desbloquear.")
        )
    return result


@router.delete("/imported")
async def delete_imported(_: UserPublic = Depends(get_current_admin)):
    """Remove all invoices brought in via Sync (the shared Factus sandbox
    account returns bills that aren't the merchant's own)."""
    db = get_db()
    res = await db.invoices.delete_many({"imported": True})
    return {"deleted": res.deleted_count}


@router.delete("/{invoice_id}")
async def delete_invoice(invoice_id: str, _: UserPublic = Depends(get_current_admin)):
    """Delete a single invoice record (does not affect the document in DIAN)."""
    db = get_db()
    res = await db.invoices.delete_one({"id": invoice_id})
    if res.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento no encontrado")
    return {"deleted": res.deleted_count}


@router.get("/{invoice_id}")
async def get_invoice(invoice_id: str, _: UserPublic = Depends(get_current_admin)):
    """One invoice + its order (for the printable graphical representation)."""
    db = get_db()
    inv = await db.invoices.find_one({"id": invoice_id}, PROJECT)
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento no encontrado")
    order = await db.orders.find_one({"id": inv.get("order_id")}, PROJECT)
    return {"invoice": inv, "order": order}


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
    # Clear previous failed attempts for this order so retries don't pile up.
    await db.invoices.delete_many({"order_id": order_id, "type": "invoice", "status": "error"})
    record = await emit_and_store(db, order, auto=False)
    if record is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Facturación electrónica deshabilitada o la factura ya existe.",
        )
    # Return the record even on failure so the UI can show the full error JSON.
    return record
