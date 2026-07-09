"""Unit tests for pure logic (no database)."""
import hashlib

from app import config, wompi
from app.models import slugify
from app.routers.orders import compute_shipping


def test_slugify():
    assert slugify("Audífonos Inalámbricos Pro") == "audifonos-inalambricos-pro"
    assert slugify("Hello World!!") == "hello-world"
    assert slugify("  multiple   spaces ") == "multiple-spaces"


def test_compute_shipping_free_over_threshold():
    assert compute_shipping(config.FREE_SHIPPING_OVER) == 0
    assert compute_shipping(config.FREE_SHIPPING_OVER + 1) == 0


def test_compute_shipping_charges_below_threshold():
    assert compute_shipping(1000) == config.SHIPPING_COST


def test_compute_shipping_empty_cart():
    assert compute_shipping(0) == 0


def test_integrity_signature_matches_spec():
    ref, amount, currency, secret = "ref123", 5000000, "COP", "test_integrity"
    expected = hashlib.sha256(f"{ref}{amount}{currency}{secret}".encode()).hexdigest()
    assert wompi.integrity_signature(ref, amount, currency, secret) == expected


def test_event_signature_verification():
    secret = "test_events"
    data = {"transaction": {"id": "tx1", "status": "APPROVED", "amount_in_cents": 5000000}}
    properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"]
    timestamp = 1700000000
    concat = "tx1APPROVED5000000" + str(timestamp) + secret
    checksum = hashlib.sha256(concat.encode()).hexdigest()
    payload = {
        "data": data,
        "timestamp": timestamp,
        "signature": {"properties": properties, "checksum": checksum},
    }
    assert wompi.verify_event_signature(payload, secret) is True

    payload["signature"]["checksum"] = "deadbeef"
    assert wompi.verify_event_signature(payload, secret) is False
