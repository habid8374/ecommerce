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
    # Factus electronic invoicing (DIAN). Two environments (test/production)
    # with separate credentials, like Wompi. Filled in from the admin panel.
    "factus": {
        "enabled": False,
        "auto_emit": True,  # emit the invoice automatically when payment is approved
        "api_version": "v2",  # Factus API version (this account uses v2)
        "environment": "test",  # "test" | "production"
        "test": {
            "base_url": "https://api-sandbox.factus.com.co",
            "email": "", "password": "", "client_id": "", "client_secret": "",
            "numbering_range_id": 0,          # Factura de venta (ej: 389 SETP)
            "numbering_range_id_credit": 0,   # Nota crédito (ej: 390 NC)
            "numbering_range_id_debit": 0,    # Nota débito (ej: 391 ND)
        },
        "production": {
            "base_url": "https://api.factus.com.co",
            "email": "", "password": "", "client_id": "", "client_secret": "",
            "numbering_range_id": 0,
            "numbering_range_id_credit": 0,
            "numbering_range_id_debit": 0,
        },
        "default_iva": 0,  # % IVA applied to items (0 or 19)
        # DIAN catalog values — API v2 (codes, adjust to your account).
        "municipality_code": "08001",  # Barranquilla (DANE)
        "payment_form": "1",           # 1=contado, 2=crédito
        "payment_method_code": "10",   # 10=efectivo (contraentrega), 42=transferencia
        "customer_tribute_code": "21", # ver catálogo (Probar conexión)
        "unit_measure_code": "94",     # 94=unidad
        "standard_code": "999",        # 999=estándar de adopción del contribuyente
        "tax_code": "01",              # 01=IVA
    },
    "shipping": {
        # Free national (carrier) shipping over this subtotal (0 disables it).
        "free_over": config.FREE_SHIPPING_OVER,
        # Fallback national carrier cost when the customer's city has no
        # specific rate below (0 = "por cobrar / contraentrega").
        "carrier_cost": 0,
        # Allow the customer to pay the transport on delivery (contraentrega):
        # it isn't charged through Wompi, only collected when the order arrives.
        "carrier_cod": True,
        # Per-city carrier rates — shipping isn't the same for every city, so
        # the price is looked up by the customer's city (falls back to
        # carrier_cost). Parametrizable in Ajustes → Envíos.
        "carrier_zones": [],  # [{"name": "Bogotá", "price": 18000}, ...]
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

# Factus API hosts per environment.
FACTUS_HOSTS = {
    "test": "https://api-sandbox.factus.com.co",
    "production": "https://api.factus.com.co",
}


def _merge(base: dict, override: dict) -> dict:
    out = deepcopy(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def _migrate_factus(settings: dict) -> dict:
    """Lift legacy flat Factus credentials into the new `test` block so existing
    configs keep working after adding the test/production split."""
    fx = settings.get("factus")
    if not isinstance(fx, dict):
        return settings
    test = fx.get("test") or {}
    cred_keys = ("email", "client_id", "client_secret", "password")
    flat_has = any(fx.get(k) for k in cred_keys)
    test_has = any(test.get(k) for k in cred_keys)
    if flat_has and not test_has:
        for k in (
            "base_url", "email", "password", "client_id", "client_secret",
            "numbering_range_id", "numbering_range_id_credit", "numbering_range_id_debit",
        ):
            if fx.get(k) not in (None, "", 0) and not test.get(k):
                test[k] = fx[k]
        fx["test"] = test
    return settings


async def get_settings() -> dict:
    doc = await get_db().settings.find_one({"id": SETTINGS_ID}, {"_id": 0})
    return _migrate_factus(_merge(DEFAULTS, doc or {}))


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


def resolve_factus(settings: dict) -> dict:
    """Effective Factus config from the active environment (test/production),
    falling back to legacy flat fields for backward compatibility."""
    fx = settings.get("factus", {}) or {}
    env = fx.get("environment", "test")
    if env not in ("test", "production"):
        env = "test"
    block = fx.get(env, {}) or {}

    def pick(key, default):
        v = block.get(key)
        if v in (None, "", 0):
            alt = fx.get(key)  # legacy flat value
            if alt not in (None, "", 0):
                v = alt
        return v if v not in (None, "") else default

    return {
        "enabled": fx.get("enabled", False),
        "auto_emit": fx.get("auto_emit", True),
        "environment": env,
        "api_version": fx.get("api_version", "v2"),
        "base_url": pick("base_url", FACTUS_HOSTS[env]),
        "email": pick("email", ""),
        "password": pick("password", ""),
        "client_id": pick("client_id", ""),
        "client_secret": pick("client_secret", ""),
        "numbering_range_id": pick("numbering_range_id", 0),
        "numbering_range_id_credit": pick("numbering_range_id_credit", 0),
        "numbering_range_id_debit": pick("numbering_range_id_debit", 0),
        # DIAN catalog values are shared across environments.
        "default_iva": fx.get("default_iva", 0),
        "municipality_code": fx.get("municipality_code", "08001"),
        "payment_form": fx.get("payment_form", "1"),
        "payment_method_code": fx.get("payment_method_code", "10"),
        "customer_tribute_code": fx.get("customer_tribute_code", "21"),
        "unit_measure_code": fx.get("unit_measure_code", "94"),
        "standard_code": fx.get("standard_code", "999"),
        "tax_code": fx.get("tax_code", "01"),
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
