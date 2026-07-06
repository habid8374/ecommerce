"""Public product catalog + admin product management."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.errors import DuplicateKeyError

from ..database import get_db
from ..deps import get_current_admin
from ..models import (
    Product,
    ProductCreate,
    ProductUpdate,
    UserPublic,
    _now,
    slugify,
)

router = APIRouter(tags=["products"])

PROJECT = {"_id": 0}


async def _unique_slug(db, base: str, exclude_id: Optional[str] = None) -> str:
    slug = base
    i = 2
    while True:
        query = {"slug": slug}
        if exclude_id:
            query["id"] = {"$ne": exclude_id}
        if not await db.products.find_one(query, {"_id": 0, "id": 1}):
            return slug
        slug = f"{base}-{i}"
        i += 1


# --- Public ---------------------------------------------------------------
@router.get("/api/products")
async def list_products(
    search: Optional[str] = None,
    category: Optional[str] = None,
    include_inactive: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
):
    db = get_db()
    query: dict = {}
    if not include_inactive:
        query["active"] = True
    if category:
        query["category"] = category.strip().lower()
    if search:
        query["name"] = {"$regex": search.strip(), "$options": "i"}

    total = await db.products.count_documents(query)
    cursor = (
        db.products.find(query, PROJECT)
        .sort("created_at", -1)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    items = [Product(**p) for p in await cursor.to_list(page_size)]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/api/categories")
async def list_categories():
    db = get_db()
    return await db.products.distinct("category", {"active": True})


@router.get("/api/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    db = get_db()
    doc = await db.products.find_one(
        {"$or": [{"id": product_id}, {"slug": product_id}]}, PROJECT
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado")
    return Product(**doc)


# --- Admin ----------------------------------------------------------------
@router.post(
    "/api/admin/products",
    response_model=Product,
    status_code=status.HTTP_201_CREATED,
    tags=["admin"],
)
async def create_product(body: ProductCreate, _: UserPublic = Depends(get_current_admin)):
    db = get_db()
    product = Product(**body.model_dump())
    product.slug = await _unique_slug(db, slugify(product.name))
    try:
        await db.products.insert_one(product.model_dump())
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Slug de producto duplicado")
    return product


@router.put("/api/admin/products/{product_id}", response_model=Product, tags=["admin"])
async def update_product(
    product_id: str, body: ProductUpdate, _: UserPublic = Depends(get_current_admin)
):
    db = get_db()
    existing = await db.products.find_one({"id": product_id}, PROJECT)
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado")

    changes = body.model_dump(exclude_unset=True)
    if "category" in changes and changes["category"]:
        changes["category"] = changes["category"].strip().lower()
    if "name" in changes and changes["name"] and changes["name"] != existing.get("name"):
        changes["slug"] = await _unique_slug(db, slugify(changes["name"]), exclude_id=product_id)
    changes["updated_at"] = _now()

    await db.products.update_one({"id": product_id}, {"$set": changes})
    doc = await db.products.find_one({"id": product_id}, PROJECT)
    return Product(**doc)


@router.delete(
    "/api/admin/products/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["admin"],
)
async def delete_product(product_id: str, _: UserPublic = Depends(get_current_admin)):
    db = get_db()
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado")
