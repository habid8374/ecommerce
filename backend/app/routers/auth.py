"""Authentication: register, login, current user, account management."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError

from .. import security
from ..database import get_db
from ..deps import get_current_user
from ..ratelimit import rate_limit
from ..models import (
    ProfileUpdate,
    Role,
    TokenResponse,
    UserLogin,
    UserPublic,
    UserRegister,
    _now,
    _uuid,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class EmailChange(BaseModel):
    email: EmailStr
    password: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class AccountDelete(BaseModel):
    password: str


def _full_name(first: str, last: str) -> str:
    return f"{first.strip()} {last.strip()}".strip()


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(10, 60))],
)
async def register(body: UserRegister):
    db = get_db()
    email = body.email.lower()
    if await db.users.find_one({"email": email}, {"_id": 0, "id": 1}):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una cuenta con ese correo")
    doc = {
        "id": _uuid(),
        "email": email,
        "first_name": body.first_name.strip(),
        "last_name": body.last_name.strip(),
        "name": _full_name(body.first_name, body.last_name),
        "doc_type": body.doc_type.value,
        "doc_number": body.doc_number.strip(),
        "phone": body.phone.strip(),
        "address": body.address.strip(),
        "city": body.city.strip(),
        "region": body.region.strip(),
        "address_notes": (body.address_notes or "").strip(),
        "postal_code": (body.postal_code or "").strip(),
        "password": security.hash_password(body.password),
        "role": Role.customer.value,
        "created_at": _now(),
    }
    try:
        await db.users.insert_one(dict(doc))
    except DuplicateKeyError:
        # Race: another request inserted the same email between the check and now.
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una cuenta con ese correo")

    user = UserPublic(**doc)
    token = security.create_access_token(user.id, user.role.value)
    return TokenResponse(access_token=token, user=user)


@router.put("/me", response_model=UserPublic)
async def update_me(body: ProfileUpdate, current: UserPublic = Depends(get_current_user)):
    db = get_db()
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if "doc_type" in changes and changes["doc_type"] is not None:
        changes["doc_type"] = changes["doc_type"].value
    # Trim strings.
    changes = {k: (v.strip() if isinstance(v, str) else v) for k, v in changes.items()}
    if "first_name" in changes or "last_name" in changes:
        first = changes.get("first_name", current.first_name)
        last = changes.get("last_name", current.last_name)
        changes["name"] = _full_name(first, last)
    if changes:
        await db.users.update_one({"id": current.id}, {"$set": changes})
    doc = await db.users.find_one({"id": current.id}, {"_id": 0, "password": 0})
    return UserPublic(**doc)


@router.post(
    "/change-email",
    response_model=UserPublic,
    dependencies=[Depends(rate_limit(6, 60))],
)
async def change_email(body: EmailChange, current: UserPublic = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"id": current.id})
    if not user or not security.verify_password(body.password, user.get("password", "")):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Contraseña incorrecta")
    new_email = body.email.lower()
    if new_email != user["email"]:
        if await db.users.find_one({"email": new_email}, {"_id": 0, "id": 1}):
            raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una cuenta con ese correo")
        await db.users.update_one({"id": current.id}, {"$set": {"email": new_email, "updated_at": _now()}})
    doc = await db.users.find_one({"id": current.id}, {"_id": 0, "password": 0})
    return UserPublic(**doc)


@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(rate_limit(6, 60))],
)
async def change_password(body: PasswordChange, current: UserPublic = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"id": current.id})
    if not user or not security.verify_password(body.current_password, user.get("password", "")):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "La contraseña actual es incorrecta")
    await db.users.update_one(
        {"id": current.id},
        {"$set": {"password": security.hash_password(body.new_password), "updated_at": _now()}},
    )


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(rate_limit(6, 60))],
)
async def delete_account(body: AccountDelete, current: UserPublic = Depends(get_current_user)):
    """Delete the customer's own account. Orders are kept (they carry their own
    customer data for accounting/invoicing); the user's reviews are removed."""
    db = get_db()
    user = await db.users.find_one({"id": current.id})
    if not user or not security.verify_password(body.password, user.get("password", "")):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Contraseña incorrecta")
    if current.role == Role.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Una cuenta de administrador no puede eliminarse aquí.")
    # Remove the user's reviews and refresh the affected products' ratings.
    product_ids = await db.reviews.distinct("product_id", {"user_id": current.id})
    await db.reviews.delete_many({"user_id": current.id})
    from ..services.reviews import recompute_product_rating

    for pid in product_ids:
        await recompute_product_rating(db, pid)
    await db.users.delete_one({"id": current.id})


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit(10, 60))],
)
async def login(body: UserLogin):
    db = get_db()
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not security.verify_password(body.password, user.get("password", "")):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Correo o contraseña incorrectos")

    public = UserPublic(**user)
    token = security.create_access_token(public.id, public.role.value)
    return TokenResponse(access_token=token, user=public)


@router.get("/me", response_model=UserPublic)
async def me(current: UserPublic = Depends(get_current_user)):
    return current
