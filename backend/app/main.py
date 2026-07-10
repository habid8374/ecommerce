"""FastAPI application assembly."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from . import config
from .database import close, ensure_indexes
from .routers import admin, auth, categories, inventory, invoices, orders, payments, products, settings as settings_router
from .seed import ensure_admin, ensure_categories, ensure_demo_products

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: best-effort DB bootstrap. Never crash the app if Mongo is down —
    # the /api/health endpoint will report the real status.
    try:
        await ensure_indexes()
        await ensure_admin()
        await ensure_demo_products()
        await ensure_categories()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Startup DB bootstrap skipped: %s", exc)
    yield
    close()


app = FastAPI(title="Ecommerce API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/")
async def root():
    return {"message": "Ecommerce API", "status": "ok"}


@app.get("/api/health")
async def health():
    from .database import get_client

    db_ok = True
    try:
        await get_client().admin.command("ping")
    except Exception:  # noqa: BLE001
        db_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "unavailable",
        "payments": "wompi" if config.PAYMENTS_ENABLED else "simulated",
    }


app.include_router(auth.router)
app.include_router(categories.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(payments.router)
app.include_router(admin.router)
app.include_router(settings_router.router)
app.include_router(settings_router.public_router)
app.include_router(invoices.router)
app.include_router(invoices.orders_router)
app.include_router(inventory.router)
