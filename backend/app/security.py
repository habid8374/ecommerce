"""Password hashing and JWT helpers."""
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from . import config

# Effective signing secret. Starts from the env var; if that is the insecure
# default, startup calls resolve_secret() to load/generate a strong one.
_SECRET = config.JWT_SECRET


def set_secret(value: str) -> None:
    global _SECRET
    if value:
        _SECRET = value


async def resolve_secret() -> None:
    """When JWT_SECRET is unset/default, load a strong secret from the DB (or
    create and persist one) so it stays stable across restarts."""
    if not config.JWT_SECRET_IS_DEFAULT:
        return
    from .database import get_db

    doc = await get_db().app_secrets.find_one({"id": "jwt"}, {"_id": 0, "secret": 1})
    if doc and doc.get("secret"):
        set_secret(doc["secret"])
        return
    generated = secrets.token_urlsafe(48)
    await get_db().app_secrets.update_one(
        {"id": "jwt"}, {"$set": {"secret": generated}}, upsert=True
    )
    set_secret(generated)


def hash_password(password: str) -> str:
    # bcrypt hard-limits inputs to 72 bytes; truncate defensively so long
    # passwords hash/verify consistently instead of raising.
    raw = password.encode("utf-8")[:72]
    return bcrypt.hashpw(raw, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(subject: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, _SECRET, algorithm=config.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    # Require the exp claim and validate it (defends against forever-valid tokens).
    return jwt.decode(
        token, _SECRET, algorithms=[config.JWT_ALGORITHM],
        options={"require": ["exp", "sub"]},
    )
