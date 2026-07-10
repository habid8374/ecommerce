"""Factus electronic-invoicing (DIAN) integration.

Docs: https://developers.factus.com.co

Best-effort and defensive: every call returns a dict with `ok` and, on failure,
an `error` string — invoicing must never break a payment. Some DIAN catalog
values (municipality, tribute, unit measure) are configurable in Ajustes since
they depend on the merchant's Factus account.
"""
import asyncio
import logging

import requests

from .settings_store import get_settings

logger = logging.getLogger(__name__)

# GRAFIBLESS doc type -> DIAN identification_document_id.
DOC_ID_MAP = {"TI": 2, "CC": 3, "CE": 5, "NIT": 6, "PP": 7}


def _token_detailed(f: dict):
    """Returns (token, error). Tries form-encoded (OAuth2 standard for Passport)
    then JSON, since Factus deployments have accepted both."""
    url = f"{f['base_url'].rstrip('/')}/oauth/token"
    payload = {
        "grant_type": "password",
        "client_id": f.get("client_id"),
        "client_secret": f.get("client_secret"),
        "username": f.get("email"),
        "password": f.get("password"),
    }
    last_err = "sin respuesta"
    for kind in ("form", "json"):
        try:
            kwargs = {"data": payload} if kind == "form" else {"json": payload}
            resp = requests.post(url, timeout=20, headers={"Accept": "application/json"}, **kwargs)
            if resp.status_code < 300:
                tok = resp.json().get("access_token")
                if tok:
                    return tok, None
            last_err = f"HTTP {resp.status_code}: {resp.text[:200]}"
        except requests.RequestException as exc:
            last_err = str(exc)
    logger.warning("Factus auth failed: %s", last_err)
    return None, last_err


def _token(f: dict) -> str | None:
    return _token_detailed(f)[0]


def test_connection_sync(f: dict) -> dict:
    if not (f.get("base_url") and f.get("client_id") and f.get("email")):
        return {"ok": False, "error": "Faltan credenciales de Factus."}
    tok, err = _token_detailed(f)
    if tok:
        return {"ok": True, "message": "Autenticación con Factus exitosa."}
    return {"ok": False, "error": err or "No se pudo autenticar."}


async def test_connection() -> dict:
    from .settings_store import get_settings
    import asyncio

    f = (await get_settings()).get("factus", {})
    return await asyncio.to_thread(test_connection_sync, f)


def _customer(order: dict, f: dict) -> dict:
    doc_type = order.get("doc_type") or "CC"
    is_company = doc_type == "NIT"
    cust = {
        "identification": order.get("doc_number") or "222222222222",
        "identification_document_id": DOC_ID_MAP.get(doc_type, 3),
        "legal_organization_id": 1 if is_company else 2,
        "tribute_id": int(f.get("customer_tribute_id", 21)),
        "municipality_id": int(f.get("municipality_id", 980)),
        "email": order.get("customer_email", ""),
        "address": (order.get("shipping_address") or {}).get("address", ""),
        "phone": (order.get("shipping_address") or {}).get("phone", ""),
    }
    if is_company:
        cust["company"] = order.get("customer_name", "")
    else:
        cust["names"] = order.get("customer_name", "")
    return cust


def _items(order: dict, f: dict) -> list[dict]:
    iva = f"{float(f.get('default_iva', 0)):.2f}"
    unit = int(f.get("unit_measure_id", 70))
    items = []
    for it in order.get("items", []):
        items.append({
            "code_reference": it.get("product_id", "")[:20] or "ITEM",
            "name": it.get("name", ""),
            "quantity": int(it.get("quantity", 1)),
            "discount_rate": 0,
            "price": int(it.get("price", 0)),
            "tax_rate": iva,
            "unit_measure_id": unit,
            "standard_code_id": 1,
            "is_excluded": 0,
            "tribute_id": 1,  # IVA
            "withholding_taxes": [],
        })
    return items


def _post(f: dict, token: str, path: str, payload: dict) -> dict:
    try:
        resp = requests.post(
            f"{f['base_url'].rstrip('/')}{path}",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            json=payload,
            timeout=30,
        )
        data = resp.json() if resp.content else {}
        if resp.status_code >= 300:
            msg = data.get("message") or resp.text[:300]
            logger.warning("Factus %s failed (%s): %s", path, resp.status_code, msg)
            return {"ok": False, "error": msg}
        bill = (data.get("data") or {}).get("bill") or (data.get("data") or {})
        return {
            "ok": True,
            "number": bill.get("number") or bill.get("name"),
            "cufe": bill.get("cufe") or bill.get("cude"),
            "public_url": bill.get("public_url") or bill.get("qr_image"),
            "status": bill.get("status", "emitida"),
            "raw": data,
        }
    except requests.RequestException as exc:
        logger.warning("Factus %s error: %s", path, exc)
        return {"ok": False, "error": str(exc)}


def _emit_sync(f: dict, order: dict) -> dict:
    token = _token(f)
    if not token:
        return {"ok": False, "error": "No se pudo autenticar con Factus (revisa credenciales)."}
    payload = {
        "numbering_range_id": int(f.get("numbering_range_id", 0)),
        "reference_code": order["id"][:20],
        "observation": "",
        "payment_form": str(f.get("payment_form", "1")),
        "payment_method_code": str(f.get("payment_method_code", "10")),
        "customer": _customer(order, f),
        "items": _items(order, f),
    }
    return _post(f, token, "/v1/bills/validate", payload)


def _note_sync(f: dict, order: dict, kind: str, reason: str, invoice_number: str) -> dict:
    token = _token(f)
    if not token:
        return {"ok": False, "error": "No se pudo autenticar con Factus."}
    path = "/v1/credit-notes/validate" if kind == "credit" else "/v1/debit-notes/validate"
    payload = {
        "numbering_range_id": int(f.get("numbering_range_id", 0)),
        "reference_code": f"{order['id'][:16]}-{kind[:2]}",
        "bill_number": invoice_number,
        "correction_concept_code": "2",  # 2=Anulación/Ajuste (adjust per DIAN)
        "observation": reason or "",
        "customer": _customer(order, f),
        "items": _items(order, f),
    }
    return _post(f, token, path, payload)


async def emit_invoice(order: dict) -> dict:
    settings = await get_settings()
    f = settings.get("factus", {})
    if not f.get("enabled"):
        return {"ok": False, "error": "Facturación electrónica deshabilitada."}
    if not (f.get("client_id") and f.get("email") and f.get("numbering_range_id")):
        return {"ok": False, "error": "Factus sin configurar (credenciales / numbering_range)."}
    return await asyncio.to_thread(_emit_sync, f, order)


async def emit_note(order: dict, kind: str, reason: str, invoice_number: str) -> dict:
    settings = await get_settings()
    f = settings.get("factus", {})
    if not f.get("enabled"):
        return {"ok": False, "error": "Facturación electrónica deshabilitada."}
    return await asyncio.to_thread(_note_sync, f, order, kind, reason, invoice_number)
