"""Product reviews (opiniones): verified-buyer reviews with photos + moderation."""
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..database import get_db
from ..deps import get_current_admin, get_current_user
from ..models import (
    PaymentStatus,
    Review,
    ReviewCreate,
    ReviewModerate,
    UserPublic,
    _now,
)
from ..services.reviews import recompute_product_rating

router = APIRouter(prefix="/api", tags=["reviews"])
admin_router = APIRouter(prefix="/api/admin/reviews", tags=["admin"])

PROJECT = {"_id": 0}
MAX_PHOTO_LEN = 700_000  # ~500 KB image as a data URI


def _public(r: dict) -> dict:
    return {
        "id": r["id"],
        "product_id": r["product_id"],
        "customer_name": r.get("customer_name", "") or "Cliente",
        "rating": r.get("rating", 0),
        "comment": r.get("comment", ""),
        "photos": r.get("photos", []),
        "verified": r.get("verified", True),
        "admin_reply": r.get("admin_reply", ""),
        "created_at": r.get("created_at"),
    }


@router.post("/reviews", response_model=Review, status_code=status.HTTP_201_CREATED)
async def create_review(body: ReviewCreate, user: UserPublic = Depends(get_current_user)):
    db = get_db()
    # The order must belong to the user, be paid, and contain the product.
    order = await db.orders.find_one({"id": body.order_id, "user_id": user.id}, PROJECT)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido no encontrado.")
    if order.get("payment_status") != PaymentStatus.approved.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo puedes reseñar compras pagadas.")
    item = next((it for it in order.get("items", []) if it["product_id"] == body.product_id), None)
    if not item:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ese producto no está en el pedido.")
    # One review per product per order.
    if await db.reviews.find_one(
        {"user_id": user.id, "product_id": body.product_id, "order_id": body.order_id},
        {"_id": 0, "id": 1},
    ):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya reseñaste este producto de este pedido.")
    # Validate photos (data URIs, reasonable size, max 5).
    photos = []
    for p in (body.photos or [])[:5]:
        if isinstance(p, str) and p.startswith("data:image/") and len(p) <= MAX_PHOTO_LEN:
            photos.append(p)

    review = Review(
        product_id=body.product_id,
        product_name=item.get("name", ""),
        user_id=user.id,
        order_id=body.order_id,
        customer_name=user.name,
        rating=body.rating,
        comment=body.comment.strip(),
        photos=photos,
        verified=True,
        status="pending",
    )
    await db.reviews.insert_one(review.model_dump())
    return review


@router.get("/products/{product_id}/reviews")
async def product_reviews(product_id: str):
    """Public: approved reviews + rating summary for a product.

    Accepts either the product id or its slug (reviews are stored by real id).
    """
    db = get_db()
    prod = await db.products.find_one(
        {"$or": [{"id": product_id}, {"slug": product_id}]}, {"_id": 0, "id": 1}
    )
    real_id = prod["id"] if prod else product_id
    docs = await db.reviews.find(
        {"product_id": real_id, "status": "approved"}, PROJECT
    ).sort("created_at", -1).to_list(500)
    dist = {i: 0 for i in range(1, 6)}
    total = 0
    for r in docs:
        dist[r.get("rating", 0)] = dist.get(r.get("rating", 0), 0) + 1
        total += r.get("rating", 0)
    count = len(docs)
    return {
        "summary": {
            "avg": round(total / count, 2) if count else 0,
            "count": count,
            "distribution": dist,
        },
        "items": [_public(r) for r in docs],
    }


@router.get("/reviews/mine")
async def my_reviews(user: UserPublic = Depends(get_current_user)):
    """Product+order pairs the user has already reviewed (to hide the button)."""
    db = get_db()
    docs = await db.reviews.find({"user_id": user.id}, {"_id": 0, "product_id": 1, "order_id": 1}).to_list(2000)
    return [f"{d['order_id']}:{d['product_id']}" for d in docs]


# --- Admin moderation -----------------------------------------------------
@admin_router.get("")
async def list_reviews(
    status_filter: str = Query(default="", alias="status"),
    _: UserPublic = Depends(get_current_admin),
):
    db = get_db()
    q = {"status": status_filter} if status_filter else {}
    docs = await db.reviews.find(q, PROJECT).sort("created_at", -1).to_list(2000)
    return docs


@admin_router.get("/pending-count")
async def pending_count(_: UserPublic = Depends(get_current_admin)):
    db = get_db()
    return {"pending": await db.reviews.count_documents({"status": "pending"})}


@admin_router.patch("/{review_id}")
async def moderate_review(
    review_id: str, body: ReviewModerate, _: UserPublic = Depends(get_current_admin)
):
    db = get_db()
    review = await db.reviews.find_one({"id": review_id}, PROJECT)
    if not review:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reseña no encontrada.")
    patch = {"updated_at": _now()}
    if body.status in ("approved", "hidden", "pending"):
        patch["status"] = body.status
    if body.admin_reply is not None:
        patch["admin_reply"] = body.admin_reply.strip()
    await db.reviews.update_one({"id": review_id}, {"$set": patch})
    await recompute_product_rating(db, review["product_id"])
    return {**review, **patch}


@admin_router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(review_id: str, _: UserPublic = Depends(get_current_admin)):
    db = get_db()
    review = await db.reviews.find_one({"id": review_id}, {"_id": 0, "product_id": 1})
    if not review:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reseña no encontrada.")
    await db.reviews.delete_one({"id": review_id})
    await recompute_product_rating(db, review["product_id"])
