"""Admin panel: order management, dashboard metrics, and customers."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

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
@router.get("/customers", response_model=list[CustomerSummary])
async def list_customers(_: UserPublic = Depends(get_current_admin)):
    db = get_db()
    users = await db.users.find({"role": "customer"}, {"_id": 0, "password": 0}).sort(
        "created_at", -1
    ).to_list(1000)

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
        summaries.append(
            CustomerSummary(
                id=u["id"],
                name=u["name"],
                email=u["email"],
                created_at=u["created_at"],
                orders_count=count,
                total_spent=spent,
            )
        )
    return summaries
