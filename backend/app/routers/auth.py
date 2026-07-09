"""Authentication: register, login, current user."""
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import DuplicateKeyError

from .. import security
from ..database import get_db
from ..deps import get_current_user
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


def _full_name(first: str, last: str) -> str:
    return f"{first.strip()} {last.strip()}".strip()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
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


@router.post("/login", response_model=TokenResponse)
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
