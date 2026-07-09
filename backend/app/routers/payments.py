"""Wompi payment flow: intent creation, webhook, and dev simulation.

Wompi credentials are resolved from system settings (test/production, switchable
from the admin panel), falling back to env vars.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status

from .. import config, wompi
from ..database import get_db
from ..deps import get_current_user
from ..models import Order, PaymentIntent, PaymentStatus, UserPublic
from ..services.settings_store import get_settings, resolve_wompi
from .orders import mark_order_paid, set_payment_failed

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payments", tags=["payments"])

PROJECT = {"_id": 0}

# Map Wompi transaction status -> our PaymentStatus.
_STATUS_MAP = {
    "APPROVED": PaymentStatus.approved,
    "DECLINED": PaymentStatus.declined,
    "VOIDED": PaymentStatus.voided,
    "ERROR": PaymentStatus.error,
}


async def _wompi():
    return resolve_wompi(await get_settings())


@router.get("/config")
async def payment_config():
    w = await _wompi()
    return {
        "provider": "wompi",
        "enabled": w["enabled"],
        "simulate": w["simulate"],
        "public_key": w["public_key"],
        "environment": w["environment"],
        "currency": w["currency"],
    }


async def _load_owned_order(order_id: str, user: UserPublic) -> dict:
    order = await get_db().orders.find_one({"id": order_id}, PROJECT)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")
    if order.get("user_id") != user.id and user.role.value != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No autorizado")
    return order


@router.post("/orders/{order_id}/intent", response_model=PaymentIntent)
async def create_intent(order_id: str, user: UserPublic = Depends(get_current_user)):
    order = await _load_owned_order(order_id, user)
    if order.get("payment_status") == PaymentStatus.approved.value:
        raise HTTPException(status.HTTP_409_CONFLICT, "El pedido ya fue pagado")

    w = await _wompi()
    reference = order["reference"]
    amount_in_cents = int(order["total"]) * 100
    currency = w["currency"]
    redirect_url = f"{config.FRONTEND_URL}/order-confirmation/{order_id}"

    intent = PaymentIntent(
        enabled=w["enabled"],
        simulate=w["simulate"],
        reference=reference,
        amount_in_cents=amount_in_cents,
        currency=currency,
        public_key=w["public_key"],
        redirect_url=redirect_url,
    )
    if w["enabled"]:
        intent.integrity_signature = wompi.integrity_signature(
            reference, amount_in_cents, currency, w["integrity_secret"]
        )
        intent.checkout_url = wompi.checkout_url(
            reference, amount_in_cents, currency, redirect_url,
            w["public_key"], w["integrity_secret"],
        )
    return intent


@router.get("/wompi/webhook")
async def wompi_webhook_check():
    """Health/validation endpoint. Real Wompi events arrive via POST below."""
    return {"status": "ok", "message": "Wompi webhook listo. Los eventos llegan por POST."}


@router.post("/wompi/webhook", status_code=status.HTTP_200_OK)
async def wompi_webhook(request: Request):
    payload = await request.json()
    transaction = (payload.get("data") or {}).get("transaction") or {}
    logger.info(
        "Wompi webhook: event=%s ref=%s status=%s",
        payload.get("event"),
        transaction.get("reference"),
        transaction.get("status"),
    )

    w = await _wompi()
    if not wompi.verify_event_signature(payload, w["events_secret"]):
        logger.warning("Wompi webhook: firma inválida (revisa el secreto de eventos del ambiente activo)")
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Firma de evento inválida")

    reference = transaction.get("reference")
    tx_status = transaction.get("status")
    tx_id = transaction.get("id")
    if not reference:
        return {"received": True}

    db = get_db()
    order = await db.orders.find_one({"reference": reference}, PROJECT)
    if not order:
        logger.warning("Wompi webhook: no se encontró pedido con referencia %s", reference)
        return {"received": True}

    mapped = _STATUS_MAP.get(tx_status)
    if mapped == PaymentStatus.approved:
        await mark_order_paid(db, order, tx_id)
        logger.info("Wompi webhook: pedido %s marcado como PAGADO", order["id"])
    elif mapped is not None:
        await set_payment_failed(db, order["id"], mapped.value, tx_id)
    return {"received": True}


@router.get("/orders/{order_id}/verify", response_model=Order)
async def verify_order(
    order_id: str,
    transaction_id: str | None = None,
    user: UserPublic = Depends(get_current_user),
):
    """Reconcile the order against Wompi.

    `transaction_id` is the `id` Wompi appends to the redirect URL after payment,
    so the order confirms as soon as the customer returns — even if the webhook
    never arrives. Falls back to the id stored by the webhook.
    """
    order = await _load_owned_order(order_id, user)
    db = get_db()
    w = await _wompi()
    tx_id = transaction_id or order.get("wompi_transaction_id")
    if w["enabled"] and tx_id:
        tx = wompi.fetch_transaction(tx_id, w["private_key"], w["base_url"])
        # Only trust the transaction if its reference matches this order.
        if tx and tx.get("reference") == order.get("reference"):
            mapped = _STATUS_MAP.get(tx.get("status"))
            if mapped == PaymentStatus.approved:
                await mark_order_paid(db, order, tx_id)
            elif mapped is not None:
                await set_payment_failed(db, order["id"], mapped.value, tx_id)
            order = await db.orders.find_one({"id": order_id}, PROJECT)
    return Order(**order)


@router.post("/orders/{order_id}/simulate", response_model=Order)
async def simulate_payment(order_id: str, user: UserPublic = Depends(get_current_user)):
    """DEV ONLY: approve a payment without a real gateway.

    Disabled automatically once real Wompi keys are configured.
    """
    w = await _wompi()
    if not w["simulate"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Simulación de pagos deshabilitada")
    order = await _load_owned_order(order_id, user)
    db = get_db()
    await mark_order_paid(db, order, transaction_id="SIMULATED")
    order = await db.orders.find_one({"id": order_id}, PROJECT)
    return Order(**order)
