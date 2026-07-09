"""Wompi payment-gateway integration.

Docs: https://docs.wompi.co/

Credentials are passed in explicitly (resolved from system settings, which fall
back to env vars) so the active environment (test/production) can be switched
from the admin panel.

1. Integrity signature — SHA256(reference + amount_in_cents + currency + integrity_secret)
2. Events (webhook) signature — SHA256(concat(signature.properties values) + timestamp + events_secret)
"""
import hashlib
from typing import Any, Optional

import requests


def integrity_signature(reference: str, amount_in_cents: int, currency: str, integrity_secret: str) -> str:
    raw = f"{reference}{amount_in_cents}{currency}{integrity_secret}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def checkout_url(
    reference: str,
    amount_in_cents: int,
    currency: str,
    redirect_url: str,
    public_key: str,
    integrity_secret: str,
) -> str:
    """Wompi Web Checkout URL (redirect flow). The public key prefix
    (pub_test_ / pub_prod_) determines the sandbox vs production environment."""
    signature = integrity_signature(reference, amount_in_cents, currency, integrity_secret)
    params = (
        f"public-key={public_key}"
        f"&currency={currency}"
        f"&amount-in-cents={amount_in_cents}"
        f"&reference={reference}"
        f"&signature:integrity={signature}"
        f"&redirect-url={redirect_url}"
    )
    return f"https://checkout.wompi.co/p/?{params}"


def verify_event_signature(payload: dict, events_secret: str) -> bool:
    """Validate the checksum Wompi sends with each event."""
    if not events_secret:
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
        value: Any = data
        for part in prop.split("."):
            if not isinstance(value, dict):
                return False
            value = value.get(part)
        concatenated += str(value)

    concatenated += str(timestamp) + events_secret
    computed = hashlib.sha256(concatenated.encode("utf-8")).hexdigest()
    return computed == sig.get("checksum")


def fetch_transaction(transaction_id: str, private_key: str, base_url: str) -> Optional[dict]:
    """Server-side confirmation of a transaction's real status."""
    if not private_key:
        return None
    try:
        resp = requests.get(
            f"{base_url}/transactions/{transaction_id}",
            headers={"Authorization": f"Bearer {private_key}"},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json().get("data")
    except requests.RequestException:
        return None
