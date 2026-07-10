"""Inventory movements (kardex): every stock change is recorded so the admin
can audit entradas, salidas y saldos, and value the inventory."""
from ..models import InventoryMovement, _now


async def apply_movement(
    db,
    product: dict,
    change: int,
    mtype: str,
    reason: str = "",
    order_id: str = "",
    unit_cost: int | None = None,
    created_by: str = "",
) -> InventoryMovement:
    """Apply a signed stock change to a product and record the kardex movement.

    Services (is_service) are not stock-tracked, so their stock stays as-is but
    the movement is still logged for traceability.
    """
    prev = int(product.get("stock", 0) or 0)
    new = prev + int(change)
    if new < 0:  # never let stock go negative from a manual salida
        new = 0
        change = new - prev
    if not product.get("is_service"):
        await db.products.update_one(
            {"id": product["id"]}, {"$set": {"stock": new, "updated_at": _now()}}
        )
    else:
        new = prev  # services keep their (irrelevant) stock

    mv = InventoryMovement(
        product_id=product["id"],
        product_name=product.get("name", ""),
        type=mtype,
        change=change,
        previous_stock=prev,
        new_stock=new,
        unit_cost=int(unit_cost if unit_cost is not None else product.get("cost", 0) or 0),
        reason=reason,
        order_id=order_id,
        created_by=created_by,
    )
    await db.inventory_movements.insert_one(mv.model_dump())
    return mv
