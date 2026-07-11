"""Review helpers: recompute a product's aggregate rating from approved reviews."""
from ..models import _now


async def recompute_product_rating(db, product_id: str) -> None:
    agg = await db.reviews.aggregate([
        {"$match": {"product_id": product_id, "status": "approved"}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}},
    ]).to_list(1)
    avg = round(agg[0]["avg"], 2) if agg else 0.0
    count = agg[0]["n"] if agg else 0
    await db.products.update_one(
        {"id": product_id},
        {"$set": {"rating_avg": avg, "rating_count": count, "updated_at": _now()}},
    )
