"""Orchestrates Factus emission + persistence in the `invoices` collection."""
import json
import logging

from ..models import _now, _uuid
from . import factus
from .settings_store import get_settings

logger = logging.getLogger(__name__)


async def _record(db, order: dict, kind: str, result: dict, reason: str = "") -> dict:
    doc = {
        "id": _uuid(),
        "order_id": order["id"],
        "type": kind,  # invoice | credit_note | debit_note
        "number": result.get("number") or "",
        "cufe": result.get("cufe") or "",
        "public_url": result.get("public_url") or "",
        "status": "emitida" if result.get("ok") else "error",
        "total": order.get("total", 0),
        "customer_name": order.get("customer_name", ""),
        "customer_email": order.get("customer_email", ""),
        "doc_number": order.get("doc_number", ""),
        "reason": reason,
        "error": result.get("error", ""),
        # Full Factus response + the exact payload we sent, for diagnosis.
        "error_detail": json.dumps(result.get("raw"), ensure_ascii=False, indent=2)[:8000]
        if result.get("raw") is not None else "",
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
    f = (await get_settings()).get("factus", {})
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
