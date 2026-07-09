"""Integration tests covering the main customer + admin flows."""
from tests.conftest import auth


PROFILE = {
    "first_name": "Juan",
    "last_name": "Pérez",
    "doc_type": "CC",
    "doc_number": "1234567890",
    "phone": "3001234567",
    "address": "Calle 1 # 2-3",
    "city": "Bogotá",
    "region": "Cundinamarca",
    "address_notes": "Apto 101",
    "postal_code": "110111",
}


def register(client, email="user@example.com", password="secret123", **overrides):
    body = {**PROFILE, "email": email, "password": password, **overrides}
    return client.post("/api/auth/register", json=body)


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["payments"] == "simulated"


def test_register_and_login(client, db):
    resp = register(client)
    assert resp.status_code == 201
    body = resp.json()
    assert body["user"]["email"] == "user@example.com"
    assert body["user"]["role"] == "customer"
    assert body["access_token"]

    # Duplicate email is rejected.
    assert register(client).status_code == 409

    login = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "secret123"},
    )
    assert login.status_code == 200

    bad = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "wrong"},
    )
    assert bad.status_code == 401


def test_product_admin_crud_and_public_listing(client, db, admin_token):
    # Customers cannot create products.
    reg = register(client)
    customer_token = reg.json()["access_token"]
    forbidden = client.post(
        "/api/admin/products",
        headers=auth(customer_token),
        json={"name": "X", "price": 1000},
    )
    assert forbidden.status_code == 403

    created = client.post(
        "/api/admin/products",
        headers=auth(admin_token),
        json={"name": "Laptop Gamer", "price": 3500000, "stock": 5, "category": "Electrónica"},
    )
    assert created.status_code == 201
    product = created.json()
    assert product["slug"] == "laptop-gamer"
    assert product["category"] == "electrónica"

    # Public listing shows the active product.
    listing = client.get("/api/products")
    assert listing.status_code == 200
    assert listing.json()["total"] == 1

    # Update and delete.
    upd = client.put(
        f"/api/admin/products/{product['id']}",
        headers=auth(admin_token),
        json={"price": 3000000},
    )
    assert upd.status_code == 200
    assert upd.json()["price"] == 3000000

    delete = client.delete(
        f"/api/admin/products/{product['id']}", headers=auth(admin_token)
    )
    assert delete.status_code == 204
    assert client.get("/api/products").json()["total"] == 0


def _make_product(client, admin_token, price=100000, stock=10):
    return client.post(
        "/api/admin/products",
        headers=auth(admin_token),
        json={"name": "Widget", "price": price, "stock": stock},
    ).json()




def test_order_flow_with_simulated_payment(client, db, admin_token):
    product = _make_product(client, admin_token, price=100000, stock=10)
    token = register(client).json()["access_token"]

    order_resp = client.post(
        "/api/orders",
        headers=auth(token),
        json={
            "items": [{"product_id": product["id"], "quantity": 2}],
        },
    )
    assert order_resp.status_code == 201
    order = order_resp.json()
    assert order["subtotal"] == 200000
    assert order["shipping_cost"] == 0  # above free-shipping threshold
    assert order["total"] == 200000
    assert order["status"] == "pending"

    # Simulate payment approval.
    paid = client.post(
        f"/api/payments/orders/{order['id']}/simulate", headers=auth(token)
    )
    assert paid.status_code == 200
    assert paid.json()["status"] == "paid"
    assert paid.json()["payment_status"] == "approved"

    # Stock was decremented.
    refreshed = client.get(f"/api/products/{product['id']}").json()
    assert refreshed["stock"] == 8

    # Customer sees the order.
    mine = client.get("/api/orders/mine", headers=auth(token))
    assert len(mine.json()) == 1


def test_order_rejects_insufficient_stock(client, db, admin_token):
    product = _make_product(client, admin_token, price=100000, stock=1)
    token = register(client).json()["access_token"]
    resp = client.post(
        "/api/orders",
        headers=auth(token),
        json={
            "items": [{"product_id": product["id"], "quantity": 5}],
        },
    )
    assert resp.status_code == 409


def test_local_delivery_zone_pricing(client, db, admin_token):
    product = _make_product(client, admin_token, price=50000, stock=10)
    token = register(client).json()["access_token"]
    order = client.post(
        "/api/orders",
        headers=auth(token),
        json={
            "items": [{"product_id": product["id"], "quantity": 1}],
            "shipping_method": "local",
            "shipping_zone": "Barranquilla",
        },
    ).json()
    assert order["shipping_method"] == "local"
    assert order["shipping_zone"] == "Barranquilla"
    assert order["shipping_cost"] == 8000  # default zone price
    assert order["total"] == 58000


def test_local_delivery_requires_valid_zone(client, db, admin_token):
    product = _make_product(client, admin_token, price=50000, stock=10)
    token = register(client).json()["access_token"]
    resp = client.post(
        "/api/orders",
        headers=auth(token),
        json={
            "items": [{"product_id": product["id"], "quantity": 1}],
            "shipping_method": "local",
            "shipping_zone": "Ciudad Inexistente",
        },
    )
    assert resp.status_code == 400


def test_admin_sets_carrier_and_guide(client, db, admin_token):
    product = _make_product(client, admin_token)
    token = register(client).json()["access_token"]
    order = client.post(
        "/api/orders",
        headers=auth(token),
        json={"items": [{"product_id": product["id"], "quantity": 1}], "shipping_method": "carrier"},
    ).json()
    resp = client.patch(
        f"/api/admin/orders/{order['id']}/shipping",
        headers=auth(admin_token),
        json={"carrier_name": "Servientrega", "tracking_number": "SE123456"},
    )
    assert resp.status_code == 200
    assert resp.json()["carrier_name"] == "Servientrega"
    assert resp.json()["tracking_number"] == "SE123456"


def test_admin_stats_and_customers(client, db, admin_token):
    product = _make_product(client, admin_token, price=100000, stock=10)
    token = register(client).json()["access_token"]
    order = client.post(
        "/api/orders",
        headers=auth(token),
        json={
            "items": [{"product_id": product["id"], "quantity": 1}],
        },
    ).json()
    client.post(f"/api/payments/orders/{order['id']}/simulate", headers=auth(token))

    stats = client.get("/api/admin/stats", headers=auth(admin_token)).json()
    assert stats["orders_total"] == 1
    assert stats["orders_paid"] == 1
    assert stats["revenue"] == order["total"]
    assert stats["customers_total"] == 1

    customers = client.get("/api/admin/customers", headers=auth(admin_token)).json()
    assert len(customers) == 1
    assert customers[0]["orders_count"] == 1
    assert customers[0]["total_spent"] == order["total"]


def test_category_management(client, db, admin_token):
    # Create a category explicitly.
    created = client.post(
        "/api/admin/categories", headers=auth(admin_token), json={"name": "DTF"}
    )
    assert created.status_code == 201
    assert created.json()["name"] == "dtf"  # normalized

    # Duplicate rejected.
    assert client.post(
        "/api/admin/categories", headers=auth(admin_token), json={"name": "dtf"}
    ).status_code == 409

    # Creating a product with a new category auto-registers it.
    client.post(
        "/api/admin/products",
        headers=auth(admin_token),
        json={"name": "Mug", "price": 20000, "category": "Sublimación"},
    )
    names = client.get("/api/categories").json()
    assert "dtf" in names
    assert "sublimación" in names


def test_customer_export_xlsx(client, db, admin_token):
    product = _make_product(client, admin_token)
    token = register(client).json()["access_token"]
    order = client.post(
        "/api/orders",
        headers=auth(token),
        json={
            "items": [{"product_id": product["id"], "quantity": 1}],
        },
    ).json()
    client.post(f"/api/payments/orders/{order['id']}/simulate", headers=auth(token))

    resp = client.get("/api/admin/customers/export", headers=auth(admin_token))
    assert resp.status_code == 200
    assert "spreadsheetml" in resp.headers["content-type"]
    # xlsx files are zip archives -> start with "PK"
    assert resp.content[:2] == b"PK"


def test_register_captures_full_profile(client, db):
    resp = register(client, email="ana@example.com", phone="3001112233")
    assert resp.status_code == 201
    user = resp.json()["user"]
    assert user["phone"] == "3001112233"
    assert user["name"] == "Juan Pérez"
    assert user["doc_type"] == "CC"
    assert user["doc_number"] == "1234567890"
    assert user["city"] == "Bogotá"


def test_order_requires_complete_profile(client, db, admin_token):
    product = _make_product(client, admin_token)
    # Register missing address/doc → profile incomplete.
    resp = client.post(
        "/api/auth/register",
        json={
            "first_name": "Sin", "last_name": "Perfil", "doc_type": "CC",
            "doc_number": "999", "phone": "3000000000", "address": "",
            "city": "", "region": "", "email": "incompleto@example.com",
            "password": "secret123",
        },
    )
    # Missing required address/city/region -> validation error at registration.
    assert resp.status_code == 422


def test_customer_deletes_unpaid_order(client, db, admin_token):
    product = _make_product(client, admin_token)
    token = register(client).json()["access_token"]
    order = client.post(
        "/api/orders", headers=auth(token),
        json={"items": [{"product_id": product["id"], "quantity": 1}]},
    ).json()

    # Delete own pending order (e.g. payment failed).
    resp = client.delete(f"/api/orders/{order['id']}", headers=auth(token))
    assert resp.status_code == 204
    assert client.get(f"/api/orders/{order['id']}", headers=auth(token)).status_code == 404


def test_customer_cannot_delete_paid_order(client, db, admin_token):
    product = _make_product(client, admin_token)
    token = register(client).json()["access_token"]
    order = client.post(
        "/api/orders", headers=auth(token),
        json={"items": [{"product_id": product["id"], "quantity": 1}]},
    ).json()
    client.post(f"/api/payments/orders/{order['id']}/simulate", headers=auth(token))
    assert client.delete(f"/api/orders/{order['id']}", headers=auth(token)).status_code == 403


def test_admin_delete_order_restores_stock(client, db, admin_token):
    product = _make_product(client, admin_token, stock=10)
    token = register(client).json()["access_token"]
    order = client.post(
        "/api/orders", headers=auth(token),
        json={"items": [{"product_id": product["id"], "quantity": 3}]},
    ).json()
    client.post(f"/api/payments/orders/{order['id']}/simulate", headers=auth(token))
    assert client.get(f"/api/products/{product['id']}").json()["stock"] == 7

    resp = client.delete(f"/api/admin/orders/{order['id']}", headers=auth(admin_token))
    assert resp.status_code == 204
    assert client.get(f"/api/products/{product['id']}").json()["stock"] == 10  # restored


def test_category_edit_renames_products(client, db, admin_token):
    client.post(
        "/api/admin/products", headers=auth(admin_token),
        json={"name": "Mug", "price": 20000, "category": "sublimacion"},
    )
    cats = client.get("/api/admin/categories", headers=auth(admin_token)).json()
    cat = next(c for c in cats if c["name"] == "sublimacion")

    resp = client.put(
        f"/api/admin/categories/{cat['id']}", headers=auth(admin_token),
        json={"name": "Sublimación DTF"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "sublimación dtf"

    # Products with the old category were updated.
    items = client.get("/api/products", params={"category": "sublimación dtf"}).json()["items"]
    assert len(items) == 1


def test_invoices_empty_and_emit_disabled(client, db, admin_token):
    # No invoices yet.
    assert client.get("/api/admin/invoices", headers=auth(admin_token)).json() == []

    product = _make_product(client, admin_token)
    token = register(client).json()["access_token"]
    order = client.post(
        "/api/orders", headers=auth(token),
        json={"items": [{"product_id": product["id"], "quantity": 1}]},
    ).json()

    # Factus disabled by default -> manual emit is rejected.
    resp = client.post(f"/api/admin/orders/{order['id']}/invoice", headers=auth(admin_token))
    assert resp.status_code == 400


def test_settings_read_and_update(client, db, admin_token):
    settings = client.get("/api/admin/settings", headers=auth(admin_token)).json()
    assert settings["wompi"]["environment"] == "test"

    upd = client.put(
        "/api/admin/settings",
        headers=auth(admin_token),
        json={"wompi": {"environment": "production"}, "company": {"nit": "900123"}},
    )
    assert upd.status_code == 200
    again = client.get("/api/admin/settings", headers=auth(admin_token)).json()
    assert again["wompi"]["environment"] == "production"
    assert again["company"]["nit"] == "900123"


def test_analytics_shape(client, db, admin_token):
    product = _make_product(client, admin_token, price=100000)
    token = register(client).json()["access_token"]
    order = client.post(
        "/api/orders", headers=auth(token),
        json={"items": [{"product_id": product["id"], "quantity": 2}]},
    ).json()
    client.post(f"/api/payments/orders/{order['id']}/simulate", headers=auth(token))

    data = client.get("/api/admin/analytics", headers=auth(admin_token)).json()
    assert "sales_series" in data
    assert data["period_orders"] == 1
    assert data["top_products"][0]["qty"] == 2


def test_admin_confirm_payment(client, db, admin_token):
    product = _make_product(client, admin_token)
    token = register(client).json()["access_token"]
    order = client.post(
        "/api/orders",
        headers=auth(token),
        json={"items": [{"product_id": product["id"], "quantity": 1}]},
    ).json()

    confirmed = client.patch(
        f"/api/admin/orders/{order['id']}/confirm-payment", headers=auth(admin_token)
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["payment_status"] == "approved"
    assert confirmed.json()["status"] == "paid"


def test_admin_updates_order_status(client, db, admin_token):
    product = _make_product(client, admin_token)
    token = register(client).json()["access_token"]
    order = client.post(
        "/api/orders",
        headers=auth(token),
        json={
            "items": [{"product_id": product["id"], "quantity": 1}],
        },
    ).json()

    resp = client.patch(
        f"/api/admin/orders/{order['id']}/status",
        headers=auth(admin_token),
        json={"status": "shipped"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "shipped"
