"""Application configuration loaded from environment variables.

Kept import-safe: reading this module must never raise, so the app can boot in
any environment (CI, local, container) and surface misconfiguration through the
health endpoint instead of crashing on startup.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")


def _get(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


# --- Database -------------------------------------------------------------
MONGO_URL = _get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = _get("DB_NAME", "ecommerce")

# --- Security -------------------------------------------------------------
# NOTE: JWT_SECRET must be set to a long random value in production.
JWT_SECRET = _get("JWT_SECRET", "dev-insecure-change-me")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(_get("ACCESS_TOKEN_EXPIRE_MINUTES", "10080") or 10080)  # 7 days

# Bootstrap admin: if set, an admin user is (re)ensured on startup.
ADMIN_EMAIL = _get("ADMIN_EMAIL", "admin@ecommerce.com")
ADMIN_PASSWORD = _get("ADMIN_PASSWORD", "admin123")
ADMIN_NAME = _get("ADMIN_NAME", "Administrador")

# When true, on startup the demo catalog is wiped and re-seeded. Use it once to
# refresh the sample products, then remove the variable. (Deletes ALL products.)
RESEED_PRODUCTS = _get("RESEED_PRODUCTS", "").lower() in ("true", "1", "yes")

# --- CORS -----------------------------------------------------------------
CORS_ORIGINS = [o for o in _get("CORS_ORIGINS", "*").split(",") if o] or ["*"]

# --- Wompi payments -------------------------------------------------------
WOMPI_PUBLIC_KEY = _get("WOMPI_PUBLIC_KEY")
WOMPI_PRIVATE_KEY = _get("WOMPI_PRIVATE_KEY")
WOMPI_INTEGRITY_SECRET = _get("WOMPI_INTEGRITY_SECRET")
WOMPI_EVENTS_SECRET = _get("WOMPI_EVENTS_SECRET")
WOMPI_BASE_URL = _get("WOMPI_BASE_URL", "https://sandbox.wompi.co/v1")
CURRENCY = _get("CURRENCY", "COP")

# Public URL of the frontend, used to build the payment redirect URL.
FRONTEND_URL = _get("FRONTEND_URL", "http://localhost:3000")

# --- Shipping (whole COP pesos) -------------------------------------------
SHIPPING_COST = int(_get("SHIPPING_COST", "15000") or 15000)
FREE_SHIPPING_OVER = int(_get("FREE_SHIPPING_OVER", "150000") or 150000)

# Payments are "live" only when the minimum Wompi credentials are present.
# Otherwise the app runs in a simulated mode so the full flow is still testable.
PAYMENTS_ENABLED = bool(WOMPI_PUBLIC_KEY and WOMPI_INTEGRITY_SECRET)

# Allow the dev-only "simulate payment" endpoint. Off automatically once real
# Wompi keys are configured, and can be forced off with SIMULATE_PAYMENTS=false.
_simulate = _get("SIMULATE_PAYMENTS", "").lower()
if _simulate in ("false", "0", "no"):
    SIMULATE_PAYMENTS = False
elif _simulate in ("true", "1", "yes"):
    SIMULATE_PAYMENTS = True
else:
    SIMULATE_PAYMENTS = not PAYMENTS_ENABLED
