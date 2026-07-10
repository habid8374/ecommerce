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

# GRAFIBLESS doc type -> DIAN identification document code (API v2).
DOC_CODE_MAP = {"RC": "11", "TI": "12", "CC": "13", "CE": "22", "NIT": "31", "PP": "41"}


def _v(f: dict) -> str:
    """API version prefix, e.g. 'v2'."""
    return (f.get("api_version") or "v2").strip("/")


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


def _numbering_ranges_sync(f: dict, token: str) -> list[dict]:
    base = f["base_url"].rstrip("/")
    ver = _v(f)
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
    }
    for path in (f"/{ver}/numbering-ranges", f"/{ver}/numbering-ranges?filter[is_active]=true"):
        try:
            resp = requests.get(f"{base}{path}", headers=headers, timeout=20)
            logger.info("Factus %s -> HTTP %s body=%s", path, resp.status_code, resp.text[:400])
            if resp.status_code >= 300:
                continue
            body = resp.json()
            data = body.get("data", body)
            # Handle Laravel pagination: {"data": {"data": [...]}}
            if isinstance(data, dict):
                data = data.get("data") or data.get("numbering_ranges") or []
            if not isinstance(data, list):
                continue
            out = []
            for r in data:
                if not isinstance(r, dict):
                    continue
                out.append({
                    "id": r.get("id"),
                    "document": r.get("document") or r.get("document_type") or r.get("name") or "",
                    "prefix": r.get("prefix", ""),
                    "from": r.get("from"),
                    "to": r.get("to"),
                    "resolution_number": r.get("resolution_number", ""),
                })
            if out:
                return out
        except (requests.RequestException, ValueError) as exc:
            logger.warning("Factus numbering-ranges error on %s: %s", path, exc)
    return []


def _catalog_sync(f: dict, token: str, path: str) -> list[dict]:
    base = f["base_url"].rstrip("/")
    ver = _v(f)
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
    }
    try:
        resp = requests.get(f"{base}/{ver}/{path}", headers=headers, timeout=20)
        logger.info("Factus catalog %s -> HTTP %s body=%s", path, resp.status_code, resp.text[:500])
        if resp.status_code >= 300:
            return []
        data = resp.json().get("data")
        if isinstance(data, dict):
            data = data.get("data") or []
        if not isinstance(data, list):
            return []
        out = []
        for r in data:
            if isinstance(r, dict):
                out.append({
                    "code": r.get("code") if r.get("code") is not None else r.get("id"),
                    "name": r.get("name") or r.get("description") or r.get("unit") or "",
                })
        return out
    except (requests.RequestException, ValueError):
        return []


def test_connection_sync(f: dict) -> dict:
    if not (f.get("base_url") and f.get("client_id") and f.get("email")):
        return {"ok": False, "error": "Faltan credenciales de Factus."}
    tok, err = _token_detailed(f)
    if not tok:
        return {"ok": False, "error": err or "No se pudo autenticar."}
    return {
        "ok": True,
        "message": "Autenticación con Factus exitosa.",
        "numbering_ranges": _numbering_ranges_sync(f, tok),
        "tributes": _catalog_sync(f, tok, "tributes"),
        "unit_measures": _catalog_sync(f, tok, "measurement-units")
        or _catalog_sync(f, tok, "units-measurement")
        or _catalog_sync(f, tok, "units"),
    }


async def test_connection() -> dict:
    from .settings_store import get_settings
    import asyncio

    f = (await get_settings()).get("factus", {})
    return await asyncio.to_thread(test_connection_sync, f)


def _customer(order: dict, f: dict) -> dict:
    doc_type = order.get("doc_type") or "CC"
    is_company = doc_type == "NIT"
    addr = order.get("shipping_address") or {}
    cust = {
        "identification": order.get("doc_number") or "222222222222",
        "identification_document_code": DOC_CODE_MAP.get(doc_type, "13"),
        "legal_organization_code": "1" if is_company else "2",
        "tribute_code": str(f.get("customer_tribute_code", "21")),
        "municipality_code": str(f.get("municipality_code", "08001")),
        "email": order.get("customer_email", ""),
        "address": addr.get("address", ""),
        "phone": addr.get("phone", ""),
    }
    if is_company:
        cust["company"] = order.get("customer_name", "")
    else:
        cust["names"] = order.get("customer_name", "")
    return cust


def _items(order: dict, f: dict) -> list[dict]:
    iva = f"{float(f.get('default_iva', 0)):.2f}"
    unit = str(f.get("unit_measure_code", "70"))
    std = str(f.get("standard_code", "999"))
    tax_code = str(f.get("tax_code", "01"))
    items = []
    for it in order.get("items", []):
        items.append({
            "code_reference": (it.get("product_id") or "ITEM")[:20],
            "name": it.get("name", ""),
            "quantity": int(it.get("quantity", 1)),
            "discount_rate": 0,
            "price": int(it.get("price", 0)),
            "unit_measure_code": unit,
            "standard_code": std,
            "taxes": [{"code": tax_code, "rate": iva}],
        })
    return items


def _payment_details(order: dict, f: dict) -> list[dict]:
    from datetime import date
    return [{
        "payment_form": str(f.get("payment_form", "1")),
        "payment_method_code": str(f.get("payment_method_code", "10")),
        "amount": f"{int(order.get('total', 0)):.2f}",
        "due_date": date.today().isoformat(),
    }]


def _post(f: dict, token: str, path: str, payload: dict) -> dict:
    try:
        resp = requests.post(
            f"{f['base_url'].rstrip('/')}{path}",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
            json=payload,
            timeout=30,
        )
        try:
            data = resp.json() if resp.content else {}
        except ValueError:
            data = {"raw_text": resp.text[:4000]}
        if resp.status_code >= 300:
            msg = data.get("message") or str(data)[:300]
            logger.warning("Factus %s failed (%s): %s", path, resp.status_code, str(data)[:600])
            return {"ok": False, "error": msg, "status_code": resp.status_code, "raw": data}
        outer = data.get("data") or {}
        bill = outer.get("bill") or outer
        return {
            "ok": True,
            "number": bill.get("number") or bill.get("name"),
            "cufe": bill.get("cufe") or bill.get("cude"),
            "qr": bill.get("qr") or bill.get("qr_image") or bill.get("qr_code"),
            "public_url": bill.get("public_url") or bill.get("url") or bill.get("qr_image"),
            "status": bill.get("status", "emitida"),
            "raw": data,
        }
    except requests.RequestException as exc:
        logger.warning("Factus %s error: %s", path, exc)
        return {"ok": False, "error": str(exc), "raw": {"exception": str(exc)}}


def _emit_sync(f: dict, order: dict) -> dict:
    token = _token(f)
    if not token:
        return {"ok": False, "error": "No se pudo autenticar con Factus (revisa credenciales)."}
    payload = {
        "numbering_range_id": int(f.get("numbering_range_id", 0)),
        "reference_code": order["id"][:20],
        "observation": "",
        "payment_details": _payment_details(order, f),
        "customer": _customer(order, f),
        "items": _items(order, f),
    }
    result = _post(f, token, f"/{_v(f)}/bills/validate", payload)
    result["sent"] = payload
    return result


def _note_sync(f: dict, order: dict, kind: str, reason: str, invoice_number: str) -> dict:
    token = _token(f)
    if not token:
        return {"ok": False, "error": "No se pudo autenticar con Factus."}
    ver = _v(f)
    path = f"/{ver}/credit-notes/validate" if kind == "credit" else f"/{ver}/debit-notes/validate"
    # Credit/debit notes use their OWN DIAN numbering range (not the invoice's).
    range_key = "numbering_range_id_credit" if kind == "credit" else "numbering_range_id_debit"
    note_range = int(f.get(range_key) or f.get("numbering_range_id", 0))
    payload = {
        "numbering_range_id": note_range,
        "reference_code": f"{order['id'][:16]}-{kind[:2]}",
        "bill_number": invoice_number,
        "correction_concept_code": "2",  # 2=Anulación/Ajuste (adjust per DIAN)
        "observation": reason or "",
        "payment_details": _payment_details(order, f),
        "customer": _customer(order, f),
        "items": _items(order, f),
    }
    result = _post(f, token, path, payload)
    result["sent"] = payload
    return result


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
