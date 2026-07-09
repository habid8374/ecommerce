"""Admin panel: order management, dashboard metrics, and customers."""
import io
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from ..database import get_db
from ..deps import get_current_admin
from ..models import (
    CustomerSummary,
    DashboardStats,
    Order,
    OrderStatus,
    OrderStatusUpdate,
    PaymentStatus,
    UserPublic,
    _now,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])

PROJECT = {"_id": 0}


# --- Orders ---------------------------------------------------------------
@router.get("/orders")
async def list_orders(
    status_filter: Optional[OrderStatus] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: UserPublic = Depends(get_current_admin),
):
    db = get_db()
    query: dict = {}
    if status_filter:
        query["status"] = status_filter.value
    total = await db.orders.count_documents(query)
    cursor = (
        db.orders.find(query, PROJECT)
        .sort("created_at", -1)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    items = [Order(**o) for o in await cursor.to_list(page_size)]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str, _: UserPublic = Depends(get_current_admin)):
    db = get_db()
    order = await db.orders.find_one({"id": order_id}, PROJECT)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")
    return Order(**order)


@router.patch("/orders/{order_id}/status", response_model=Order)
async def update_order_status(
    order_id: str, body: OrderStatusUpdate, _: UserPublic = Depends(get_current_admin)
):
    db = get_db()
    result = await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": body.status.value, "updated_at": _now()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")
    order = await db.orders.find_one({"id": order_id}, PROJECT)
    return Order(**order)


@router.patch("/orders/{order_id}/confirm-payment", response_model=Order)
async def confirm_payment(order_id: str, _: UserPublic = Depends(get_current_admin)):
    """Manually mark a payment as verified (e.g. bank transfer / cash), in
    addition to the automatic Wompi webhook. Decrements stock once, idempotent."""
    from .orders import mark_order_paid

    db = get_db()
    order = await db.orders.find_one({"id": order_id}, PROJECT)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")
    await mark_order_paid(db, order, order.get("wompi_transaction_id") or "MANUAL")
    order = await db.orders.find_one({"id": order_id}, PROJECT)
    return Order(**order)


@router.delete("/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(order_id: str, _: UserPublic = Depends(get_current_admin)):
    """Delete any order. If it had been paid (stock already decremented), the
    stock is restored so inventory stays correct."""
    db = get_db()
    order = await db.orders.find_one({"id": order_id}, PROJECT)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")
    if order.get("payment_status") == PaymentStatus.approved.value:
        for item in order.get("items", []):
            await db.products.update_one(
                {"id": item["product_id"]},
                {"$inc": {"stock": int(item["quantity"])}},
            )
    await db.orders.delete_one({"id": order_id})


@router.get("/orders/pending-count")
async def pending_payment_count(_: UserPublic = Depends(get_current_admin)):
    """Orders awaiting payment verification — used for the live admin badge."""
    db = get_db()
    n = await db.orders.count_documents({"payment_status": PaymentStatus.pending.value})
    return {"pending_payment": n}


# --- Dashboard ------------------------------------------------------------
@router.get("/stats", response_model=DashboardStats)
async def dashboard_stats(_: UserPublic = Depends(get_current_admin)):
    db = get_db()

    revenue_agg = await db.orders.aggregate(
        [
            {"$match": {"payment_status": PaymentStatus.approved.value}},
            {"$group": {"_id": None, "total": {"$sum": "$total"}}},
        ]
    ).to_list(1)
    revenue = revenue_agg[0]["total"] if revenue_agg else 0

    recent_cursor = db.orders.find({}, PROJECT).sort("created_at", -1).limit(5)
    recent = [Order(**o) for o in await recent_cursor.to_list(5)]

    return DashboardStats(
        revenue=revenue,
        orders_total=await db.orders.count_documents({}),
        orders_pending=await db.orders.count_documents({"status": OrderStatus.pending.value}),
        orders_paid=await db.orders.count_documents(
            {"payment_status": PaymentStatus.approved.value}
        ),
        customers_total=await db.users.count_documents({"role": "customer"}),
        products_total=await db.products.count_documents({}),
        low_stock=await db.products.count_documents({"stock": {"$lte": 5}}),
        recent_orders=recent,
    )


# --- Customers ------------------------------------------------------------
async def _customer_summaries(db) -> list[CustomerSummary]:
    users = await db.users.find({"role": "customer"}, {"_id": 0, "password": 0}).sort(
        "created_at", -1
    ).to_list(5000)

    summaries: list[CustomerSummary] = []
    for u in users:
        agg = await db.orders.aggregate(
            [
                {
                    "$match": {
                        "user_id": u["id"],
                        "payment_status": PaymentStatus.approved.value,
                    }
                },
                {"$group": {"_id": None, "spent": {"$sum": "$total"}, "count": {"$sum": 1}}},
            ]
        ).to_list(1)
        spent = agg[0]["spent"] if agg else 0
        count = agg[0]["count"] if agg else 0

        # Phone/city: prefer the profile phone, fall back to the latest order.
        latest = await db.orders.find({"user_id": u["id"]}, PROJECT).sort(
            "created_at", -1
        ).limit(1).to_list(1)
        addr = (latest[0].get("shipping_address") if latest else None) or {}
        phone = u.get("phone") or addr.get("phone", "")
        city = addr.get("city", "")

        summaries.append(
            CustomerSummary(
                id=u["id"],
                name=u["name"],
                email=u["email"],
                phone=phone,
                city=city,
                created_at=u["created_at"],
                orders_count=count,
                total_spent=spent,
            )
        )
    return summaries


@router.get("/customers", response_model=list[CustomerSummary])
async def list_customers(_: UserPublic = Depends(get_current_admin)):
    return await _customer_summaries(get_db())


def _fmt_date(value) -> str:
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    return str(value or "")


@router.get("/customers/export")
async def export_customers(_: UserPublic = Depends(get_current_admin)):
    """Download an .xlsx with all customers and their purchases (for marketing)."""
    from openpyxl import Workbook
    from openpyxl.styles import Font

    db = get_db()
    summaries = await _customer_summaries(db)

    wb = Workbook()

    # Sheet 1: customers
    ws = wb.active
    ws.title = "Clientes"
    headers = ["Nombre", "Email", "Teléfono", "Ciudad", "Registrado", "N° Pedidos", "Total gastado (COP)"]
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)
    for c in summaries:
        ws.append([
            c.name, c.email, c.phone, c.city, _fmt_date(c.created_at),
            c.orders_count, c.total_spent,
        ])

    # Sheet 2: every order (their purchases)
    ws2 = wb.create_sheet("Pedidos")
    ws2.append([
        "Pedido", "Cliente", "Email", "Teléfono", "Ciudad", "Fecha",
        "Estado", "Pago", "Artículos", "Total (COP)",
    ])
    for cell in ws2[1]:
        cell.font = Font(bold=True)
    orders = await db.orders.find({}, PROJECT).sort("created_at", -1).to_list(50000)
    for o in orders:
        addr = o.get("shipping_address") or {}
        items = "; ".join(f"{it['quantity']}x {it['name']}" for it in o.get("items", []))
        ws2.append([
            o["id"][:8], addr.get("full_name", ""), o.get("customer_email", ""),
            addr.get("phone", ""), addr.get("city", ""), _fmt_date(o.get("created_at")),
            o.get("status", ""), o.get("payment_status", ""), items, o.get("total", 0),
        ])

    # Auto-ish column widths
    for sheet in (ws, ws2):
        for col in sheet.columns:
            width = max((len(str(c.value)) for c in col if c.value is not None), default=10)
            sheet.column_dimensions[col[0].column_letter].width = min(max(width + 2, 12), 45)

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    filename = f"clientes_grafibless_{datetime.now():%Y%m%d}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
