"""MongoDB connection helpers.

The client is created lazily so importing the app never opens a socket — this
keeps unit tests and the health endpoint working even without a database.
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from . import config

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGO_URL, uuidRepresentation="standard")
    return _client


def get_db() -> AsyncIOMotorDatabase:
    global _db
    if _db is None:
        _db = get_client()[config.DB_NAME]
    return _db


# Allow tests to inject a fake database (e.g. mongomock-motor).
def set_db(db: AsyncIOMotorDatabase) -> None:
    global _db
    _db = db


def close() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


async def ensure_indexes() -> None:
    db = get_db()
    await db.users.create_index("email", unique=True)
    await db.categories.create_index("name", unique=True)
    await db.products.create_index("slug", unique=True)
    await db.products.create_index([("name", "text"), ("description", "text")])
    await db.orders.create_index("user_id")
    await db.orders.create_index("reference", unique=True, sparse=True)
    await db.orders.create_index("created_at")
