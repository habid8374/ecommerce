"""Idempotent seeding: bootstrap admin user and demo catalog."""
import logging

from . import config, security
from .database import get_db
from .models import Product, Role, _now, _uuid, slugify

logger = logging.getLogger(__name__)

DEMO_PRODUCTS = [
    {
        "name": "Audífonos Inalámbricos Pro",
        "description": "Cancelación activa de ruido, 30h de batería y estuche de carga rápida.",
        "price": 289000,
        "stock": 40,
        "category": "electrónica",
        "images": ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800"],
    },
    {
        "name": "Smartwatch Serie 7",
        "description": "Monitor de ritmo cardíaco, GPS y resistencia al agua.",
        "price": 459000,
        "stock": 25,
        "category": "electrónica",
        "images": ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800"],
    },
    {
        "name": "Zapatillas Running Cloud",
        "description": "Amortiguación ligera para largas distancias.",
        "price": 219000,
        "stock": 60,
        "category": "deportes",
        "images": ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800"],
    },
    {
        "name": "Cafetera Espresso Compacta",
        "description": "Prepara espresso de calidad barista en casa.",
        "price": 349000,
        "stock": 18,
        "category": "hogar",
        "images": ["https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800"],
    },
    {
        "name": "Mochila Antirrobo Urbana",
        "description": "Compartimento para laptop de 15\", puerto USB y tela impermeable.",
        "price": 129000,
        "stock": 3,
        "category": "accesorios",
        "images": ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800"],
    },
    {
        "name": "Teclado Mecánico RGB",
        "description": "Switches táctiles, retroiluminación personalizable y construcción en aluminio.",
        "price": 199000,
        "stock": 32,
        "category": "electrónica",
        "images": ["https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800"],
    },
]


async def ensure_admin() -> None:
    db = get_db()
    existing = await db.users.find_one({"email": config.ADMIN_EMAIL.lower()})
    if existing:
        if existing.get("role") != Role.admin.value:
            await db.users.update_one(
                {"id": existing["id"]}, {"$set": {"role": Role.admin.value}}
            )
        return
    await db.users.insert_one(
        {
            "id": _uuid(),
            "email": config.ADMIN_EMAIL.lower(),
            "name": config.ADMIN_NAME,
            "password": security.hash_password(config.ADMIN_PASSWORD),
            "role": Role.admin.value,
            "created_at": _now(),
        }
    )
    logger.info("Bootstrapped admin user %s", config.ADMIN_EMAIL)


async def ensure_demo_products() -> None:
    db = get_db()
    if await db.products.count_documents({}) > 0:
        return
    for data in DEMO_PRODUCTS:
        product = Product(**data)
        product.slug = slugify(product.name)
        await db.products.insert_one(product.model_dump())
    logger.info("Seeded %d demo products", len(DEMO_PRODUCTS))
