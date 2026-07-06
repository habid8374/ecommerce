"""Wompi payment-gateway integration.

Docs: https://docs.wompi.co/

Two pieces matter for a server integration:

1. Integrity signature — built when we hand the checkout off to the browser:
       SHA256(reference + amount_in_cents + currency + integrity_secret)
   Wompi validates it so the amount cannot be tampered with client-side.

2. Events (webhook) signature — Wompi POSTs transaction updates and signs them:
       SHA256(concat(values of signature.properties) + timestamp + events_secret)
   We recompute and compare before trusting the payload.
"""
import hashlib
from typing import Any, Optional

import requests

from . import config


def integrity_signature(reference: str, amount_in_cents: int, currency: str) -> str:
    raw = f"{reference}{amount_in_cents}{currency}{config.WOMPI_INTEGRITY_SECRET}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def checkout_url(reference: str, amount_in_cents: int, currency: str, redirect_url: str) -> str:
    """Wompi Web Checkout URL (redirect flow)."""
    signature = integrity_signature(reference, amount_in_cents, currency)
    params = (
        f"public-key={config.WOMPI_PUBLIC_KEY}"
        f"&currency={currency}"
        f"&amount-in-cents={amount_in_cents}"
        f"&reference={reference}"
        f"&signature:integrity={signature}"
        f"&redirect-url={redirect_url}"
    )
    return f"https://checkout.wompi.co/p/?{params}"


def verify_event_signature(payload: dict) -> bool:
    """Validate the checksum Wompi sends with each event."""
    events_secret = config.WOMPI_EVENTS_SECRET
    if not events_secret:
        # Without the secret configured we cannot verify — reject to be safe.
        return False
    try:
        sig = payload["signature"]
        properties = sig["properties"]
        timestamp = payload["timestamp"]
        data = payload["data"]
    except (KeyError, TypeError):
        return False

    concatenated = ""
    for prop in properties:
        # e.g. "transaction.amount_in_cents" -> data["transaction"]["amount_in_cents"]
        value: Any = data
        for part in prop.split("."):
            if not isinstance(value, dict):
                return False
            value = value.get(part)
        concatenated += str(value)

    concatenated += str(timestamp) + events_secret
    computed = hashlib.sha256(concatenated.encode("utf-8")).hexdigest()
    return computed == sig.get("checksum")


def fetch_transaction(transaction_id: str) -> Optional[dict]:
    """Server-side confirmation of a transaction's real status."""
    if not config.WOMPI_PRIVATE_KEY:
        return None
    try:
        resp = requests.get(
            f"{config.WOMPI_BASE_URL}/transactions/{transaction_id}",
            headers={"Authorization": f"Bearer {config.WOMPI_PRIVATE_KEY}"},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json().get("data")
    except requests.RequestException:
        return None
