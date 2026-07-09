"""Customer orders: create (with stock validation) and read own orders."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from .. import config
from ..database import get_db
from ..deps import get_current_user
from ..models import (
    Order,
    OrderCreate,
    OrderItem,
    OrderStatus,
    PaymentStatus,
    ShippingAddress,
    UserPublic,
    _now,
)

router = APIRouter(prefix="/api/orders", tags=["orders"])

PROJECT = {"_id": 0}


def compute_shipping(subtotal: int) -> int:
    if subtotal <= 0 or subtotal >= config.FREE_SHIPPING_OVER:
        return 0
    return config.SHIPPING_COST


async def mark_order_paid(db, order: dict, transaction_id: Optional[str] = None) -> None:
    """Idempotently mark an order paid and decrement stock exactly once."""
    if order.get("payment_status") == PaymentStatus.approved.value:
        return
    for item in order.get("items", []):
        await db.products.update_one(
            {"id": item["product_id"]},
            {"$inc": {"stock": -int(item["quantity"])}},
        )
    await db.orders.update_one(
        {"id": order["id"]},
        {
            "$set": {
                "payment_status": PaymentStatus.approved.value,
                "status": OrderStatus.paid.value,
                "wompi_transaction_id": transaction_id,
                "updated_at": _now(),
            }
        },
    )
    # Notify the customer (best-effort; never blocks the payment).
    try:
        from ..services.email import send_order_paid

        await send_order_paid({**order, "status": OrderStatus.paid.value})
    except Exception as exc:  # noqa: BLE001
        import logging

        logging.getLogger(__name__).warning("order paid email failed: %s", exc)


async def set_payment_failed(db, order_id: str, payment_status: str, transaction_id: Optional[str]):
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "payment_status": payment_status,
                "wompi_transaction_id": transaction_id,
                "updated_at": _now(),
            }
        },
    )


@router.post("", response_model=Order, status_code=status.HTTP_201_CREATED)
async def create_order(body: OrderCreate, user: UserPublic = Depends(get_current_user)):
    db = get_db()

    # Shipping/invoice data comes from the saved profile — no re-entry at checkout.
    if not user.profile_complete:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Completa los datos de tu perfil (documento y dirección) antes de comprar.",
        )
    shipping = ShippingAddress(
        full_name=user.name,
        phone=user.phone,
        address=user.address,
        city=user.city,
        region=user.region,
        notes=user.address_notes,
        postal_code=user.postal_code,
    )

    # Collapse duplicate product lines and validate availability.
    wanted: dict[str, int] = {}
    for item in body.items:
        wanted[item.product_id] = wanted.get(item.product_id, 0) + item.quantity

    order_items: list[OrderItem] = []
    subtotal = 0
    for product_id, quantity in wanted.items():
        product = await db.products.find_one({"id": product_id}, PROJECT)
        if not product or not product.get("active", False):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Producto no disponible: {product_id}")
        if product["stock"] < quantity:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Stock insuficiente para '{product['name']}' (disponible: {product['stock']})",
            )
        line_subtotal = product["price"] * quantity
        subtotal += line_subtotal
        order_items.append(
            OrderItem(
                product_id=product_id,
                name=product["name"],
                price=product["price"],
                quantity=quantity,
                subtotal=line_subtotal,
            )
        )

    # Shipping cost from system settings (falls back to env defaults).
    from ..services.settings_store import get_settings

    ship = (await get_settings()).get("shipping", {})
    free_over = ship.get("free_over", config.FREE_SHIPPING_OVER)
    flat = ship.get("cost", config.SHIPPING_COST)
    shipping_cost = 0 if (subtotal <= 0 or subtotal >= free_over) else flat

    order = Order(
        user_id=user.id,
        customer_email=user.email,
        customer_name=user.name,
        doc_type=user.doc_type,
        doc_number=user.doc_number,
        items=order_items,
        subtotal=subtotal,
        shipping_cost=shipping_cost,
        total=subtotal + shipping_cost,
        shipping_address=shipping,
    )
    await db.orders.insert_one(order.model_dump())
    return order


@router.get("/mine", response_model=list[Order])
async def my_orders(user: UserPublic = Depends(get_current_user)):
    db = get_db()
    cursor = db.orders.find({"user_id": user.id}, PROJECT).sort("created_at", -1)
    return [Order(**o) for o in await cursor.to_list(500)]


@router.get("/{order_id}", response_model=Order)
async def get_order(order_id: str, user: UserPublic = Depends(get_current_user)):
    db = get_db()
    order = await db.orders.find_one({"id": order_id}, PROJECT)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")
    if order.get("user_id") != user.id and user.role.value != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No autorizado")
    return Order(**order)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_order(order_id: str, user: UserPublic = Depends(get_current_user)):
    """Let a customer remove their own order while it hasn't been paid — useful
    when the payment failed and the order got stuck as pending."""
    db = get_db()
    order = await db.orders.find_one({"id": order_id}, PROJECT)
    if not order or order.get("user_id") != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")
    if order.get("payment_status") == PaymentStatus.approved.value:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "No puedes eliminar un pedido ya pagado. Contacta al soporte.",
        )
    await db.orders.delete_one({"id": order_id})
