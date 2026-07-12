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

from .settings_store import get_settings, resolve_factus

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


def _catalog_once(f: dict, token: str, path: str):
    """Returns (items, http_status)."""
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
        logger.info("Factus catalog %s -> HTTP %s body=%s", path, resp.status_code, resp.text[:400])
        if resp.status_code >= 300:
            return [], resp.status_code
        data = resp.json().get("data")
        if isinstance(data, dict):
            data = data.get("data") or []
        if not isinstance(data, list):
            return [], resp.status_code
        out = []
        for r in data:
            if isinstance(r, dict):
                out.append({
                    "code": r.get("code") if r.get("code") is not None else r.get("id"),
                    "name": r.get("name") or r.get("description") or r.get("unit") or "",
                })
        return out, resp.status_code
    except (requests.RequestException, ValueError) as exc:
        return [], str(exc)[:60]


def _try_catalogs(f: dict, token: str, candidates: list[str]):
    """Try candidate endpoint names, return (items, debug)."""
    debug = []
    for path in candidates:
        items, status = _catalog_once(f, token, path)
        debug.append({"path": path, "status": status, "count": len(items)})
        if items:
            return items, debug
    return [], debug


def test_connection_sync(f: dict) -> dict:
    if not (f.get("base_url") and f.get("client_id") and f.get("email")):
        return {"ok": False, "error": "Faltan credenciales de Factus."}
    tok, err = _token_detailed(f)
    if not tok:
        return {"ok": False, "error": err or "No se pudo autenticar."}
    tributes, tdbg = _try_catalogs(f, tok, ["tributes", "tributos", "taxes", "tribute-products"])
    units, udbg = _try_catalogs(
        f, tok,
        ["measurement-units", "units", "unit-measures", "units-measurement", "measure-units", "unit-measurements"],
    )
    return {
        "ok": True,
        "message": "Autenticación con Factus exitosa.",
        "numbering_ranges": _numbering_ranges_sync(f, tok),
        "tributes": tributes,
        "unit_measures": units,
        "catalog_debug": {"tributes": tdbg, "unit_measures": udbg},
    }


async def test_connection() -> dict:
    f = resolve_factus(await get_settings())
    return await asyncio.to_thread(test_connection_sync, f)


def _to_num(v, default=0):
    try:
        return int(round(float(str(v).replace(",", ""))))
    except (TypeError, ValueError):
        return default


def _bill_items(b: dict) -> list[dict]:
    """Normalize a Factus bill's line items to our order-item shape."""
    out = []
    for it in b.get("items", []) or []:
        if not isinstance(it, dict):
            continue
        qty = _to_num(it.get("quantity"), 1) or 1
        price = _to_num(it.get("price") or it.get("unit_price"))
        total = _to_num(it.get("total") or it.get("gross_value")) or price * qty
        out.append({
            "product_id": str(it.get("code_reference") or it.get("code") or ""),
            "name": it.get("name") or it.get("description") or "",
            "price": price,
            "quantity": qty,
            "subtotal": total,
        })
    return out


def _map_bill(b: dict) -> dict:
    """Normalize a Factus bill (from list or detail) for our invoices store."""
    customer = b.get("customer") if isinstance(b.get("customer"), dict) else {}
    name = (
        b.get("names") or customer.get("names") or customer.get("company")
        or customer.get("graphic_representation_name") or b.get("company") or ""
    )
    ident = b.get("identification") or customer.get("identification") or ""
    number = b.get("number") or b.get("name") or ""
    doc = str(b.get("document") or b.get("document_type") or "").lower()
    kind = "credit_note" if "cr" in doc or "nc" in doc else (
        "debit_note" if "deb" in doc or "nd" in doc else "invoice"
    )
    return {
        "number": str(number),
        "reference_code": b.get("reference_code") or b.get("reference") or "",
        "cufe": b.get("cufe") or b.get("cude") or "",
        "qr": b.get("qr") or b.get("qr_image") or b.get("qr_code") or "",
        "public_url": b.get("public_url") or b.get("url") or "",
        "status": b.get("status") or "",
        "total": _to_num(b.get("total") or b.get("total_bill") or b.get("amount")),
        "created_at": b.get("created_at") or b.get("validated") or "",
        "customer_name": name,
        "identification": str(ident),
        "type": kind,
        "items": _bill_items(b),
        "raw": b,
    }


def _bill_detail_sync(f: dict, token: str, number: str) -> dict | None:
    """Best-effort full bill detail (items, cufe, qr, urls) by number."""
    base = f["base_url"].rstrip("/")
    ver = _v(f)
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
    }
    for path in (f"/{ver}/bills/show/{number}", f"/{ver}/bills/{number}"):
        try:
            resp = requests.get(f"{base}{path}", headers=headers, timeout=25)
            if resp.status_code >= 300:
                continue
            body = resp.json()
            data = body.get("data", body)
            if isinstance(data, dict):
                return data.get("bill") or data
        except (requests.RequestException, ValueError):
            continue
    return None


def list_bills_sync(f: dict) -> dict:
    """List invoices already emitted in the Factus account (paginated)."""
    if not (f.get("base_url") and f.get("client_id") and f.get("email")):
        return {"ok": False, "error": "Faltan credenciales de Factus."}
    token, err = _token_detailed(f)
    if not token:
        return {"ok": False, "error": err or "No se pudo autenticar."}
    base = f["base_url"].rstrip("/")
    ver = _v(f)
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
    }
    bills: list[dict] = []
    for page in range(1, 11):  # up to 10 pages
        try:
            resp = requests.get(f"{base}/{ver}/bills?page={page}", headers=headers, timeout=30)
        except requests.RequestException as exc:
            if page == 1:
                return {"ok": False, "error": str(exc)}
            break
        logger.info("Factus bills page %s -> HTTP %s", page, resp.status_code)
        if resp.status_code >= 300:
            if page == 1:
                return {"ok": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
            break
        try:
            body = resp.json()
        except ValueError:
            break
        data = body.get("data", body)
        rows = data.get("data") if isinstance(data, dict) else data
        if not isinstance(rows, list) or not rows:
            break
        for b in rows:
            if isinstance(b, dict):
                mapped = _map_bill(b)
                # Enrich with detail when the list lacks CUFE/items (best-effort).
                if not mapped["cufe"] or not mapped["items"]:
                    detail = _bill_detail_sync(f, token, mapped["number"])
                    if detail:
                        mapped = _map_bill(detail)
                bills.append(mapped)
        pag = data.get("pagination") if isinstance(data, dict) else None
        if pag and pag.get("current_page") and pag.get("last_page"):
            if pag["current_page"] >= pag["last_page"]:
                break
        elif len(rows) < 10:
            break
    return {"ok": True, "bills": bills}


async def list_bills() -> dict:
    f = resolve_factus(await get_settings())
    if not f.get("enabled"):
        return {"ok": False, "error": "Facturación electrónica deshabilitada."}
    return await asyncio.to_thread(list_bills_sync, f)


def _raw_bills(f: dict, token: str, query: str = "") -> list[dict]:
    """Raw bill rows from GET /bills (first pages) — keeps numeric status.
    `query` adds extra querystring params (e.g. 'filter[status]=0')."""
    base = f["base_url"].rstrip("/")
    ver = _v(f)
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
    }
    extra = f"&{query}" if query else ""
    rows: list[dict] = []
    for page in range(1, 6):
        try:
            resp = requests.get(f"{base}/{ver}/bills?page={page}{extra}", headers=headers, timeout=30)
        except requests.RequestException:
            break
        if resp.status_code >= 300:
            break
        try:
            body = resp.json()
        except ValueError:
            break
        data = body.get("data", body)
        page_rows = data.get("data") if isinstance(data, dict) else data
        if not isinstance(page_rows, list) or not page_rows:
            break
        rows.extend([r for r in page_rows if isinstance(r, dict)])
        pag = data.get("pagination") if isinstance(data, dict) else None
        if pag and pag.get("current_page") and pag.get("last_page"):
            if pag["current_page"] >= pag["last_page"]:
                break
        elif len(page_rows) < 10:
            break
    return rows


def _is_pending(b: dict) -> bool:
    """A bill that was created but not validated by the DIAN (status 0). These
    block the numbering queue and must be deleted before emitting again."""
    st = b.get("status")
    if st in (0, "0"):
        return True
    if isinstance(st, str) and "pend" in st.lower():
        return True
    return False


def _delete_bill_sync(f: dict, token: str, reference_code: str) -> dict:
    """DELETE an unvalidated bill by its reference_code (frees the queue)."""
    base = f["base_url"].rstrip("/")
    ver = _v(f)
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
    }
    url = f"{base}/{ver}/bills/destroy/reference/{reference_code}"
    try:
        resp = requests.delete(url, headers=headers, timeout=25)
        logger.info("Factus delete bill %s -> HTTP %s", reference_code, resp.status_code)
        return {"ok": resp.status_code < 300, "status_code": resp.status_code}
    except requests.RequestException as exc:
        return {"ok": False, "error": str(exc)}


def unblock_pending_sync(f: dict, token: str | None = None) -> dict:
    """Find bills stuck as unvalidated (status 0) and delete them so the
    numbering range stops returning 409 'factura pendiente por enviar a la DIAN'."""
    if not (f.get("base_url") and f.get("client_id") and f.get("email")):
        return {"ok": False, "error": "Faltan credenciales de Factus.", "deleted": []}
    if token is None:
        token, err = _token_detailed(f)
        if not token:
            return {"ok": False, "error": err or "No se pudo autenticar.", "deleted": []}
    # Prefer the explicit "pending" filter; fall back to scanning all bills.
    rows = _raw_bills(f, token, "filter[status]=0")
    used_filter = bool(rows)
    if not rows:
        rows = [b for b in _raw_bills(f, token) if _is_pending(b)]
    deleted, failed, samples = [], [], []
    for b in rows:
        ref = b.get("reference_code") or b.get("reference")
        num = b.get("number") or b.get("name")
        # The list may omit reference_code; fetch the detail to get it.
        if not ref and num:
            detail = _bill_detail_sync(f, token, num)
            if detail:
                ref = detail.get("reference_code") or detail.get("reference")
        if len(samples) < 15:
            samples.append({"number": num, "reference_code": ref, "status": b.get("status")})
        if not ref:
            failed.append({"number": num, "why": "sin reference_code"})
            continue
        res = _delete_bill_sync(f, token, ref)
        (deleted if res.get("ok") else failed).append(ref)
    return {
        "ok": True,
        "deleted": deleted,
        "failed": failed,
        "checked": len(rows),
        "used_filter": used_filter,
        "samples": samples,
    }


async def unblock_pending() -> dict:
    f = resolve_factus(await get_settings())
    if not f.get("enabled"):
        return {"ok": False, "error": "Facturación electrónica deshabilitada."}
    return await asyncio.to_thread(unblock_pending_sync, f, None)


def _customer(order: dict, f: dict) -> dict:
    doc_type = order.get("doc_type") or "CC"
    is_company = doc_type == "NIT"
    addr = order.get("shipping_address") or {}
    cust = {
        "identification": order.get("doc_number") or "222222222222",
        "identification_document_code": DOC_CODE_MAP.get(doc_type, "13"),
        "legal_organization_code": "1" if is_company else "2",
        "municipality_code": str(f.get("municipality_code", "08001")),
        "email": order.get("customer_email", ""),
        "address": addr.get("address", ""),
        "phone": addr.get("phone", ""),
    }
    # tribute_code is optional; only send it when set to a real value ("21" was
    # rejected as invalid by Factus v2, so omit it — DIAN accepts no tribute).
    tc = str(f.get("customer_tribute_code", "")).strip()
    if tc and tc != "21":
        cust["tribute_code"] = tc
    if is_company:
        cust["company"] = order.get("customer_name", "")
    else:
        cust["names"] = order.get("customer_name", "")
    return cust


def _items(order: dict, f: dict) -> list[dict]:
    default_iva = float(f.get("default_iva", 0))
    # "70" was rejected as invalid; DIAN "unidad" in Factus v2 is "94".
    unit = str(f.get("unit_measure_code", "") or "94").strip()
    if unit == "70":
        unit = "94"
    std = str(f.get("standard_code", "999"))
    tax_code = str(f.get("tax_code", "01"))
    ship_iva = f"{default_iva:.2f}"
    items = []
    for it in order.get("items", []):
        # Per-item IVA (from the product), falling back to the global default.
        rate = it.get("tax_rate")
        iva = f"{float(rate if rate is not None else default_iva):.2f}"
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
    # Shipping charged now must appear as a line so the invoice total matches
    # what the customer paid (Factus rejects a payment sum ≠ item sum). When
    # shipping is paid on delivery (contraentrega) shipping_cost is 0, so it's
    # correctly excluded from the invoice.
    shipping_cost = int(order.get("shipping_cost", 0) or 0)
    if shipping_cost > 0:
        items.append({
            "code_reference": "ENVIO",
            "name": "Envío / Transporte",
            "quantity": 1,
            "discount_rate": 0,
            "price": shipping_cost,
            "unit_measure_code": unit,
            "standard_code": std,
            "taxes": [{"code": tax_code, "rate": ship_iva}],
        })
    return items


def _items_total(items: list[dict], f: dict) -> float:
    """Total Factus will compute from the items (base + IVA). Used so
    payment_details always equals the item sum Factus expects.

    Reads each item's OWN tax rate (the one embedded in `taxes`), not the global
    default: products can carry different IVA rates, and using the global default
    here would mismatch what Factus derives from the items (409 validation error
    'La suma de los detalles de pago no es igual al total de la factura')."""
    total = 0.0
    for it in items:
        base = it["price"] * it["quantity"] * (1 - it.get("discount_rate", 0) / 100)
        taxes = it.get("taxes") or []
        try:
            rate = float(taxes[0]["rate"]) if taxes else 0.0
        except (KeyError, TypeError, ValueError):
            rate = 0.0
        # Round each line's tax to 2 decimals as DIAN/Factus does per line.
        total += round(base + base * rate / 100, 2)
    return round(total, 2)


def _payment_details(order: dict, f: dict, items: list[dict]) -> list[dict]:
    from datetime import date
    return [{
        "payment_form": str(f.get("payment_form", "1")),
        "payment_method_code": str(f.get("payment_method_code", "10")),
        "amount": f"{_items_total(items, f):.2f}",
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
        # QR / CUFE / public URL live at data level, often under `links`.
        links = outer.get("links") or bill.get("links") or {}
        return {
            "ok": True,
            "number": bill.get("number") or bill.get("name"),
            "cufe": bill.get("cufe") or bill.get("cude") or outer.get("cufe"),
            "qr": links.get("qr") or bill.get("qr") or bill.get("qr_image")
            or bill.get("qr_code") or outer.get("qr") or outer.get("qr_image"),
            "public_url": links.get("public_url") or bill.get("public_url")
            or bill.get("url") or outer.get("public_url") or outer.get("url"),
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
    # reference_code must be STABLE per order (deterministic), not unique per
    # attempt: DIAN numbering is strictly sequential, so if a bill got created
    # but its transmission to the DIAN stayed pending, retrying with the SAME
    # reference lets Factus resume that same bill instead of requesting a new
    # number (which would 409 "factura pendiente por enviar a la DIAN").
    ref = order["id"][:20]
    items = _items(order, f)
    payload = {
        "numbering_range_id": int(f.get("numbering_range_id", 0)),
        "reference_code": ref,
        "observation": "",
        "payment_details": _payment_details(order, f, items),
        "customer": _customer(order, f),
        "items": items,
    }
    result = _post(f, token, f"/{_v(f)}/bills/validate", payload)
    # 409 = a previous unvalidated bill is blocking the numbering queue. Delete
    # our own stuck bill (same reference) AND any other status-0 bills, then
    # retry once (the documented recovery).
    if not result.get("ok") and result.get("status_code") == 409:
        own = _delete_bill_sync(f, token, ref)
        unblock = unblock_pending_sync(f, token)
        logger.info(
            "Factus 409: own-ref delete=%s, unblocked=%s (checked=%s)",
            own.get("status_code"), unblock.get("deleted"), unblock.get("checked"),
        )
        retry = _post(f, token, f"/{_v(f)}/bills/validate", payload)
        retry["unblocked"] = unblock.get("deleted")
        retry["unblock_debug"] = {
            "own_ref": ref, "own_delete_status": own.get("status_code"),
            "checked": unblock.get("checked"), "used_filter": unblock.get("used_filter"),
            "samples": unblock.get("samples"), "failed": unblock.get("failed"),
        }
        result = retry
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
    ref = f"{order['id'][:16]}-{kind[:2]}"
    items = _items(order, f)
    payload = {
        "numbering_range_id": note_range,
        "reference_code": ref,
        "bill_number": invoice_number,
        "correction_concept_code": "2",  # 2=Anulación/Ajuste (adjust per DIAN)
        "observation": reason or "",
        "payment_details": _payment_details(order, f, items),
        "customer": _customer(order, f),
        "items": items,
    }
    result = _post(f, token, path, payload)
    if not result.get("ok") and result.get("status_code") == 409:
        _delete_bill_sync(f, token, ref)
        unblock = unblock_pending_sync(f, token)
        retry = _post(f, token, path, payload)
        retry["unblocked"] = unblock.get("deleted")
        retry["unblock_debug"] = {
            "checked": unblock.get("checked"), "samples": unblock.get("samples"),
        }
        result = retry
    result["sent"] = payload
    return result


def create_numbering_range_sync(f: dict, payload: dict) -> dict:
    """Create/register a numbering range in Factus. Returns the raw response so
    the UI can iterate on the exact fields the account requires."""
    if not (f.get("base_url") and f.get("client_id") and f.get("email")):
        return {"ok": False, "error": "Faltan credenciales de Factus."}
    token, err = _token_detailed(f)
    if not token:
        return {"ok": False, "error": err or "No se pudo autenticar."}
    result = _post(f, token, f"/{_v(f)}/numbering-ranges", payload)
    result["sent"] = payload
    return result


async def create_numbering_range(payload: dict) -> dict:
    f = resolve_factus(await get_settings())
    return await asyncio.to_thread(create_numbering_range_sync, f, payload)


async def emit_invoice(order: dict) -> dict:
    f = resolve_factus(await get_settings())
    if not f.get("enabled"):
        return {"ok": False, "error": "Facturación electrónica deshabilitada."}
    if not (f.get("client_id") and f.get("email") and f.get("numbering_range_id")):
        return {"ok": False, "error": "Factus sin configurar (credenciales / numbering_range)."}
    return await asyncio.to_thread(_emit_sync, f, order)


async def emit_note(order: dict, kind: str, reason: str, invoice_number: str) -> dict:
    f = resolve_factus(await get_settings())
    if not f.get("enabled"):
        return {"ok": False, "error": "Facturación electrónica deshabilitada."}
    return await asyncio.to_thread(_note_sync, f, order, kind, reason, invoice_number)
