"""Transactional email via Brevo (https://developers.brevo.com).

Best-effort: if Brevo isn't configured or the API call fails, we log and move
on — email must never block a payment or a status change.
"""
import asyncio
import logging

import requests

from .settings_store import get_settings

logger = logging.getLogger(__name__)

BREVO_URL = "https://api.brevo.com/v3/smtp/email"

STATUS_LABELS = {
    "pending": "Pendiente de pago",
    "paid": "Pago confirmado",
    "processing": "En preparación",
    "shipped": "Enviado",
    "delivered": "Entregado",
    "cancelled": "Cancelado",
}

STATUS_MESSAGES = {
    "paid": "¡Recibimos tu pago! Estamos preparando tu pedido.",
    "processing": "Tu pedido está en preparación.",
    "shipped": "¡Tu pedido va en camino!",
    "delivered": "Tu pedido fue entregado. ¡Gracias por comprar con nosotros!",
    "cancelled": "Tu pedido fue cancelado.",
}


def _cop(v) -> str:
    return "$ {:,.0f}".format(int(v or 0)).replace(",", ".")


def _send_sync(api_key, sender, to_email, to_name, subject, html) -> bool:
    try:
        resp = requests.post(
            BREVO_URL,
            headers={"api-key": api_key, "content-type": "application/json", "accept": "application/json"},
            json={
                "sender": sender,
                "to": [{"email": to_email, "name": to_name or to_email}],
                "subject": subject,
                "htmlContent": html,
            },
            timeout=15,
        )
        if resp.status_code >= 300:
            logger.warning("Brevo email failed (%s): %s", resp.status_code, resp.text[:200])
            return False
        return True
    except requests.RequestException as exc:
        logger.warning("Brevo email error: %s", exc)
        return False


async def send_email(to_email: str, to_name: str, subject: str, html: str) -> bool:
    if not to_email:
        return False
    settings = await get_settings()
    brevo = settings.get("brevo", {})
    if not brevo.get("enabled") or not brevo.get("api_key") or not brevo.get("sender_email"):
        logger.info("Brevo not configured — skipping email to %s", to_email)
        return False
    sender = {"name": brevo.get("sender_name") or "GRAFIBLESS", "email": brevo["sender_email"]}
    return await asyncio.to_thread(
        _send_sync, brevo["api_key"], sender, to_email, to_name, subject, html
    )


def _layout(company_name: str, title: str, body_html: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden">
      <div style="background:#000;color:#fff;padding:20px 24px;font-size:20px;font-weight:800">
        {company_name} <span style="color:#1e5eff">·</span>
      </div>
      <div style="padding:24px;color:#222">
        <h2 style="margin:0 0 12px">{title}</h2>
        {body_html}
      </div>
      <div style="padding:16px 24px;background:#fafafa;color:#888;font-size:12px">
        Este es un mensaje automático de {company_name}.
      </div>
    </div>
    """


def _items_table(order: dict) -> str:
    rows = "".join(
        f"<tr><td style='padding:4px 0'>{it['quantity']} × {it['name']}</td>"
        f"<td style='padding:4px 0;text-align:right'>{_cop(it['subtotal'])}</td></tr>"
        for it in order.get("items", [])
    )
    return f"""
    <table style="width:100%;border-collapse:collapse;font-size:14px">{rows}
      <tr><td style="padding-top:8px;border-top:1px solid #eee;font-weight:700">Total</td>
      <td style="padding-top:8px;border-top:1px solid #eee;text-align:right;font-weight:700">{_cop(order.get('total'))}</td></tr>
    </table>"""


async def send_order_paid(order: dict) -> None:
    settings = await get_settings()
    company = settings.get("company", {}).get("name", "GRAFIBLESS")
    ref = order["id"][:8]
    body = f"""
      <p>Hola {order.get('customer_name') or ''}, tu pago fue confirmado. 🎉</p>
      <p>Pedido <b>#{ref}</b></p>
      {_items_table(order)}
      <p style="margin-top:16px">Te avisaremos por este medio cada vez que tu pedido avance de estado.</p>
    """
    html = _layout(company, "¡Pago confirmado!", body)
    await send_email(order.get("customer_email"), order.get("customer_name"), f"Pago confirmado · Pedido #{ref}", html)


async def send_invoice(order: dict, public_url: str, number: str) -> None:
    settings = await get_settings()
    company = settings.get("company", {}).get("name", "GRAFIBLESS")
    ref = order["id"][:8]
    body = f"""
      <p>Hola {order.get('customer_name') or ''},</p>
      <p>Adjuntamos tu <b>factura electrónica</b> {number and f'N° {number}'} del pedido <b>#{ref}</b>.</p>
      <p><a href="{public_url}" style="display:inline-block;background:#1e5eff;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Ver / descargar factura</a></p>
    """
    html = _layout(company, "Tu factura electrónica", body)
    await send_email(order.get("customer_email"), order.get("customer_name"), f"Factura electrónica · Pedido #{ref}", html)


async def send_status_changed(order: dict, new_status: str) -> None:
    settings = await get_settings()
    company = settings.get("company", {}).get("name", "GRAFIBLESS")
    ref = order["id"][:8]
    label = STATUS_LABELS.get(new_status, new_status)
    msg = STATUS_MESSAGES.get(new_status, f"El estado de tu pedido cambió a: {label}.")
    tracking = ""
    if new_status == "shipped" and (order.get("carrier_name") or order.get("tracking_number")):
        parts = []
        if order.get("carrier_name"):
            parts.append(f"Transportadora: <b>{order['carrier_name']}</b>")
        if order.get("tracking_number"):
            parts.append(f"Guía: <b>{order['tracking_number']}</b>")
        tracking = "<p>" + " · ".join(parts) + "</p>"
    body = f"""
      <p>Hola {order.get('customer_name') or ''},</p>
      <p>{msg}</p>
      <p>Pedido <b>#{ref}</b> — Estado actual: <b style="color:#1e5eff">{label}</b></p>
      {tracking}
    """
    html = _layout(company, "Actualización de tu pedido", body)
    await send_email(order.get("customer_email"), order.get("customer_name"), f"Pedido #{ref}: {label}", html)
