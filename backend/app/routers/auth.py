"""Authentication: register, login, current user."""
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import DuplicateKeyError

from .. import security
from ..database import get_db
from ..deps import get_current_user
from ..models import (
    Role,
    TokenResponse,
    UserLogin,
    UserPublic,
    UserRegister,
    _now,
    _uuid,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: UserRegister):
    db = get_db()
    email = body.email.lower()
    if await db.users.find_one({"email": email}, {"_id": 0, "id": 1}):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una cuenta con ese correo")
    doc = {
        "id": _uuid(),
        "email": email,
        "name": body.name.strip(),
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
