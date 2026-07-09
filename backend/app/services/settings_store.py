"""System settings stored in MongoDB (editable from the admin panel).

Everything that used to live only in Railway env vars can be configured here:
Wompi credentials (test + production, with an active-environment switch), Brevo
(email), and the company data used for invoices. Values fall back to env vars
when a setting is blank, so existing deployments keep working.
"""
from copy import deepcopy

from .. import config
from ..database import get_db

SETTINGS_ID = "app"

DEFAULTS = {
    "id": SETTINGS_ID,
    "wompi": {
        "environment": "test",  # "test" | "production"
        "test": {
            "public_key": "",
            "private_key": "",
            "integrity_secret": "",
            "events_secret": "",
        },
        "production": {
            "public_key": "",
            "private_key": "",
            "integrity_secret": "",
            "events_secret": "",
        },
    },
    "brevo": {
        "api_key": "",
        "sender_name": "GRAFIBLESS",
        "sender_email": "",
        "enabled": True,
    },
    "company": {
        "name": "GRAFIBLESS",
        "nit": "",
        "address": "",
        "city": "",
        "phone": "",
        "email": "",
    },
    # Factus electronic invoicing (DIAN). Filled in from the admin panel.
    "factus": {
        "enabled": False,
        "auto_emit": True,  # emit the invoice automatically when payment is approved
        "base_url": "https://api-sandbox.factus.com.co",
        "email": "",
        "password": "",
        "client_id": "",
        "client_secret": "",
        "numbering_range_id": 0,
        "default_iva": 0,  # % IVA applied to items (0 or 19)
        # DIAN catalog values (defaults; adjust to your account).
        "municipality_id": 980,        # Barranquilla
        "payment_form": "1",           # 1=contado, 2=crédito
        "payment_method_code": "10",   # 10=efectivo (contraentrega), 42=transferencia
        "customer_tribute_id": 21,     # 21=No responsable de IVA
        "unit_measure_id": 70,         # 70=unidad
    },
    "shipping": {
        # Free national (carrier) shipping over this subtotal (0 disables it).
        "free_over": config.FREE_SHIPPING_OVER,
        # Cost of national shipping by carrier (0 = "por cobrar / contraentrega").
        "carrier_cost": 0,
        # Local delivery zones (Barranquilla metro area) with their price.
        "local_zones": [
            {"name": "Barranquilla", "price": 8000},
            {"name": "Soledad", "price": 9000},
            {"name": "Puerto Colombia", "price": 12000},
            {"name": "Galapa", "price": 12000},
            {"name": "Malambo", "price": 13000},
        ],
    },
}

# Wompi API/checkout hosts per environment.
WOMPI_HOSTS = {
    "test": "https://sandbox.wompi.co/v1",
    "production": "https://production.wompi.co/v1",
}


def _merge(base: dict, override: dict) -> dict:
    out = deepcopy(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


async def get_settings() -> dict:
    doc = await get_db().settings.find_one({"id": SETTINGS_ID}, {"_id": 0})
    return _merge(DEFAULTS, doc or {})


async def update_settings(patch: dict) -> dict:
    current = await get_settings()
    merged = _merge(current, patch)
    merged["id"] = SETTINGS_ID
    await get_db().settings.update_one(
        {"id": SETTINGS_ID}, {"$set": merged}, upsert=True
    )
    return merged


def resolve_wompi(settings: dict) -> dict:
    """Effective Wompi config from the active environment, falling back to env vars."""
    env = settings.get("wompi", {}).get("environment", "test")
    block = settings.get("wompi", {}).get(env, {})

    public_key = block.get("public_key") or config.WOMPI_PUBLIC_KEY
    private_key = block.get("private_key") or config.WOMPI_PRIVATE_KEY
    integrity_secret = block.get("integrity_secret") or config.WOMPI_INTEGRITY_SECRET
    events_secret = block.get("events_secret") or config.WOMPI_EVENTS_SECRET
    base_url = WOMPI_HOSTS.get(env, config.WOMPI_BASE_URL)

    enabled = bool(public_key and integrity_secret)
    return {
        "environment": env,
        "public_key": public_key,
        "private_key": private_key,
        "integrity_secret": integrity_secret,
        "events_secret": events_secret,
        "base_url": base_url,
        "currency": config.CURRENCY,
        "enabled": enabled,
        # Simulated payments only when no real keys AND env allows it.
        "simulate": (not enabled) and config.SIMULATE_PAYMENTS,
    }


def public_settings(settings: dict, wompi: dict) -> dict:
    """Non-secret view for clients / admin display (no private keys/secrets)."""
    return {
        "wompi": {
            "environment": wompi["environment"],
            "enabled": wompi["enabled"],
            "simulate": wompi["simulate"],
            "public_key": wompi["public_key"],
            # booleans only for secrets, so the admin sees what's configured
            "test_configured": bool(settings["wompi"]["test"]["public_key"]),
            "production_configured": bool(settings["wompi"]["production"]["public_key"]),
        },
        "brevo": {
            "enabled": settings["brevo"]["enabled"],
            "configured": bool(settings["brevo"]["api_key"]),
            "sender_name": settings["brevo"]["sender_name"],
            "sender_email": settings["brevo"]["sender_email"],
        },
        "company": settings["company"],
        "shipping": settings["shipping"],
    }
