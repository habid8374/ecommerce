"""Orchestrates Factus emission + persistence in the `invoices` collection."""
import json
import logging

from ..models import _now, _uuid
from . import factus
from .settings_store import get_settings, resolve_factus

logger = logging.getLogger(__name__)


async def _record(db, order: dict, kind: str, result: dict, reason: str = "") -> dict:
    # Include the auto-unblock diagnostics in the error detail when present.
    detail_obj = result.get("raw")
    if result.get("unblock_debug") is not None:
        detail_obj = {"response": result.get("raw"), "unblock_debug": result["unblock_debug"]}
    doc = {
        "id": _uuid(),
        "order_id": order["id"],
        "type": kind,  # invoice | credit_note | debit_note
        "number": result.get("number") or "",
        "cufe": result.get("cufe") or "",
        "qr": result.get("qr") or "",
        "public_url": result.get("public_url") or "",
        "factus_data": json.dumps(result.get("raw"), ensure_ascii=False)[:20000]
        if result.get("ok") and result.get("raw") is not None else "",
        "status": "emitida" if result.get("ok") else "error",
        "total": order.get("total", 0),
        "customer_name": order.get("customer_name", ""),
        "customer_email": order.get("customer_email", ""),
        "doc_number": order.get("doc_number", ""),
        "reason": reason,
        "error": result.get("error", ""),
        # Full Factus response (+ unblock diagnostics) and the payload we sent.
        "error_detail": json.dumps(detail_obj, ensure_ascii=False, indent=2)[:8000]
        if detail_obj is not None else "",
        "request_payload": json.dumps(result.get("sent"), ensure_ascii=False, indent=2)[:8000]
        if result.get("sent") else "",
        "status_code": result.get("status_code"),
        "created_at": _now(),
    }
    await db.invoices.insert_one(dict(doc))
    return doc


async def emit_and_store(db, order: dict, auto: bool = True) -> dict | None:
    """Emit the electronic invoice for an order and store the result.

    Skips silently when Factus is disabled or (for auto mode) auto-emit is off,
    and avoids emitting a second invoice for the same order.
    """
    f = resolve_factus(await get_settings())
    if not f.get("enabled"):
        return None
    if auto and not f.get("auto_emit", True):
        return None
    existing = await db.invoices.find_one(
        {"order_id": order["id"], "type": "invoice", "status": "emitida"}, {"_id": 0, "id": 1}
    )
    if existing:
        return None

    result = await factus.emit_invoice(order)
    record = await _record(db, order, "invoice", result)

    if result.get("ok") and record["public_url"]:
        try:
            from .email import send_invoice

            await send_invoice(order, record["public_url"], record["number"])
        except Exception as exc:  # noqa: BLE001
            logger.warning("invoice email failed: %s", exc)
    return record


async def create_note(db, order: dict, invoice: dict, kind: str, reason: str) -> dict:
    """kind = 'credit' | 'debit'."""
    result = await factus.emit_note(order, kind, reason, invoice.get("number", ""))
    return await _record(db, order, f"{kind}_note", result, reason=reason)


async def sync_from_factus(db) -> dict:
    """Import invoices already emitted in the Factus account that aren't stored
    locally yet, so they show up in the module and can be printed."""
    res = await factus.list_bills()
    if not res.get("ok"):
        return {"ok": False, "error": res.get("error", "No se pudo consultar Factus."), "imported": 0}

    imported = 0
    for b in res.get("bills", []):
        number = (b.get("number") or "").strip()
        if not number:
            continue
        # Skip if we already have this document number stored.
        if await db.invoices.find_one({"number": number}, {"_id": 0, "id": 1}):
            continue
        # Try to link back to a local order via the reference_code prefix.
        order_id = ""
        ref = (b.get("reference_code") or "").split("-")[0]
        if ref:
            match = await db.orders.find_one(
                {"id": {"$regex": f"^{ref}"}}, {"_id": 0, "id": 1}
            )
            if match:
                order_id = match["id"]

        doc = {
            "id": _uuid(),
            "order_id": order_id,
            "type": b.get("type", "invoice"),
            "number": number,
            "cufe": b.get("cufe", ""),
            "qr": b.get("qr", ""),
            "public_url": b.get("public_url", ""),
            "factus_data": json.dumps(b.get("raw"), ensure_ascii=False)[:20000]
            if b.get("raw") is not None else "",
            "status": "emitida",
            "total": b.get("total", 0),
            "customer_name": b.get("customer_name", ""),
            "customer_email": "",
            "doc_number": b.get("identification", ""),
            "reason": "",
            "error": "",
            "error_detail": "",
            "request_payload": "",
            "status_code": None,
            "items": b.get("items", []),  # Factus line items for the printable copy
            "imported": True,
            "created_at": _now(),
        }
        await db.invoices.insert_one(dict(doc))
        imported += 1
    return {"ok": True, "imported": imported, "total": len(res.get("bills", []))}
