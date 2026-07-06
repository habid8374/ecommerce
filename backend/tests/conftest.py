"""Test fixtures: an in-memory Mongo (mongomock-motor) wired into the app."""
import os

# Must be set BEFORE app.config is imported below (config reads env at import).
os.environ.setdefault("JWT_SECRET", "test-secret-value-at-least-32-bytes-long!!")
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "ecommerce_test")
os.environ.setdefault("SIMULATE_PAYMENTS", "true")
os.environ.setdefault("WOMPI_INTEGRITY_SECRET", "test_integrity")
os.environ.setdefault("WOMPI_EVENTS_SECRET", "test_events")
os.environ.setdefault("ADMIN_EMAIL", "admin@example.com")
os.environ.setdefault("ADMIN_PASSWORD", "admin123")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from mongomock_motor import AsyncMongoMockClient  # noqa: E402

from app import database, security  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Role, _now, _uuid  # noqa: E402


@pytest.fixture
def db():
    fake = AsyncMongoMockClient()["ecommerce_test"]
    database.set_db(fake)
    yield fake


@pytest.fixture
def client(db):
    # Plain TestClient (no `with`) so the app lifespan — index creation and demo
    # seeding — does not run; the db fixture gives each test a clean database.
    return TestClient(app)


@pytest.fixture
async def admin_token(db):
    admin = {
        "id": _uuid(),
        "email": "admin@example.com",
        "name": "Admin",
        "password": security.hash_password("admin123"),
        "role": Role.admin.value,
        "created_at": _now(),
    }
    await db.users.insert_one(admin)
    return security.create_access_token(admin["id"], Role.admin.value)


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
