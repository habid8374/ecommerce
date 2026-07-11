"""FastAPI application assembly."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from starlette.middleware.cors import CORSMiddleware

from . import config, security
from .database import close, ensure_indexes
from .routers import admin, auth, categories, inventory, invoices, orders, payments, products, reviews, settings as settings_router
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
        await security.resolve_secret()
        if config.JWT_SECRET_IS_DEFAULT:
            logger.warning("JWT_SECRET no configurado: usando un secreto generado y persistido. "
                           "Define JWT_SECRET en las variables de entorno para producción.")
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
    allow_credentials=config.CORS_ALLOW_CREDENTIALS,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)

# Security headers on every response (OWASP A05 hardening).
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Cross-Origin-Resource-Policy": "same-site",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
}


@app.middleware("http")
async def security_and_size_guard(request: Request, call_next):
    # Reject oversized bodies early (DoS protection).
    cl = request.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > config.MAX_BODY_BYTES:
        return JSONResponse({"detail": "El contenido enviado es demasiado grande."}, status_code=413)
    response: Response = await call_next(request)
    for k, v in SECURITY_HEADERS.items():
        response.headers.setdefault(k, v)
    return response


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
app.include_router(reviews.router)
app.include_router(reviews.admin_router)
