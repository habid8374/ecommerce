"""Integration tests covering the main customer + admin flows."""
from tests.conftest import auth


def register(client, email="user@example.com", password="secret123", name="User"):
    resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "name": name},
    )
    return resp


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


ADDRESS = {
    "full_name": "Juan Pérez",
    "phone": "3001234567",
    "address": "Calle 1 # 2-3",
    "city": "Bogotá",
}


def test_order_flow_with_simulated_payment(client, db, admin_token):
    product = _make_product(client, admin_token, price=100000, stock=10)
    token = register(client).json()["access_token"]

    order_resp = client.post(
        "/api/orders",
        headers=auth(token),
        json={
            "items": [{"product_id": product["id"], "quantity": 2}],
            "shipping_address": ADDRESS,
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
            "shipping_address": ADDRESS,
        },
    )
    assert resp.status_code == 409


def test_shipping_applied_below_threshold(client, db, admin_token):
    product = _make_product(client, admin_token, price=50000, stock=10)
    token = register(client).json()["access_token"]
    order = client.post(
        "/api/orders",
        headers=auth(token),
        json={
            "items": [{"product_id": product["id"], "quantity": 1}],
            "shipping_address": ADDRESS,
        },
    ).json()
    assert order["subtotal"] == 50000
    assert order["shipping_cost"] > 0
    assert order["total"] == 50000 + order["shipping_cost"]


def test_admin_stats_and_customers(client, db, admin_token):
    product = _make_product(client, admin_token, price=100000, stock=10)
    token = register(client).json()["access_token"]
    order = client.post(
        "/api/orders",
        headers=auth(token),
        json={
            "items": [{"product_id": product["id"], "quantity": 1}],
            "shipping_address": ADDRESS,
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


def test_admin_updates_order_status(client, db, admin_token):
    product = _make_product(client, admin_token)
    token = register(client).json()["access_token"]
    order = client.post(
        "/api/orders",
        headers=auth(token),
        json={
            "items": [{"product_id": product["id"], "quantity": 1}],
            "shipping_address": ADDRESS,
        },
    ).json()

    resp = client.patch(
        f"/api/admin/orders/{order['id']}/status",
        headers=auth(admin_token),
        json={"status": "shipped"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "shipped"
