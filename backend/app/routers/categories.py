"""Product/service categories: public listing + admin management."""
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import DuplicateKeyError

from ..database import get_db
from ..deps import get_current_admin
from ..models import Category, CategoryCreate, UserPublic, _now, _uuid, slugify

router = APIRouter(tags=["categories"])

PROJECT = {"_id": 0}


def normalize(name: str) -> str:
    return (name or "").strip().lower()


async def ensure_category(db, name: str) -> None:
    """Create the category if it doesn't exist yet (used when saving products)."""
    norm = normalize(name)
    if not norm:
        return
    if await db.categories.find_one({"name": norm}, {"_id": 0, "id": 1}):
        return
    doc = Category(name=norm, slug=slugify(norm)).model_dump()
    try:
        await db.categories.insert_one(doc)
    except DuplicateKeyError:
        pass


# --- Public ---------------------------------------------------------------
@router.get("/api/categories")
async def list_categories():
    db = get_db()
    cats = await db.categories.find({}, PROJECT).sort("name", 1).to_list(500)
    if cats:
        return [c["name"] for c in cats]
    # Fallback for older data seeded before categories existed.
    return await db.products.distinct("category", {"active": True})


# --- Admin ----------------------------------------------------------------
@router.get("/api/admin/categories", response_model=list[Category], tags=["admin"])
async def admin_list_categories(_: UserPublic = Depends(get_current_admin)):
    db = get_db()
    cats = await db.categories.find({}, PROJECT).sort("name", 1).to_list(500)
    return [Category(**c) for c in cats]


@router.post(
    "/api/admin/categories",
    response_model=Category,
    status_code=status.HTTP_201_CREATED,
    tags=["admin"],
)
async def create_category(body: CategoryCreate, _: UserPublic = Depends(get_current_admin)):
    db = get_db()
    norm = normalize(body.name)
    if not norm:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nombre de categoría inválido")
    if await db.categories.find_one({"name": norm}, {"_id": 0, "id": 1}):
        raise HTTPException(status.HTTP_409_CONFLICT, "La categoría ya existe")
    category = Category(name=norm, slug=slugify(norm))
    try:
        await db.categories.insert_one(category.model_dump())
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, "La categoría ya existe")
    return category


@router.delete(
    "/api/admin/categories/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["admin"],
)
async def delete_category(category_id: str, _: UserPublic = Depends(get_current_admin)):
    db = get_db()
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoría no encontrada")
