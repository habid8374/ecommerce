"""Idempotent seeding: bootstrap admin user and demo catalog."""
import logging

from . import config, security
from .database import get_db
from .models import Product, Role, _now, _uuid, slugify

logger = logging.getLogger(__name__)

# GRAFIBLESS: impresión DTF & estampados, sublimación, corte de vinilo,
# prendas personalizadas y diseño gráfico. Servicios se manejan con stock alto.
DEMO_PRODUCTS = [
    {
        "name": "Impresión DTF - Gran Formato (metro lineal)",
        "description": "Impresión DTF de gran formato por metro lineal. Colores vivos, alta "
        "durabilidad y excelente elasticidad. Ideal para producción en volumen.",
        "price": 45000,
        "stock": 999,
        "category": "dtf",
        "images": ["https://images.unsplash.com/photo-1611095564985-93f0f5f9f7e9?w=800"],
    },
    {
        "name": "Estampado DTF en Camiseta",
        "description": "Estampado DTF aplicado sobre tu camiseta o una nuestra. Diseño a todo "
        "color, tacto suave y resistente al lavado.",
        "price": 25000,
        "stock": 999,
        "category": "estampados",
        "images": ["https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=800"],
    },
    {
        "name": "Camiseta Personalizada (algodón premium)",
        "description": "Camiseta 100% algodón con tu diseño estampado en DTF. Varias tallas y "
        "colores disponibles.",
        "price": 55000,
        "stock": 150,
        "category": "prendas",
        "images": ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800"],
    },
    {
        "name": "Buzo / Hoodie Personalizado",
        "description": "Buzo con capucha personalizado con tu logo o arte. Tela de alta calidad, "
        "estampado DTF de larga duración.",
        "price": 95000,
        "stock": 80,
        "category": "prendas",
        "images": ["https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800"],
    },
    {
        "name": "Sublimación en Mug 11oz",
        "description": "Mug de cerámica sublimado a todo color con tu foto o diseño. Apto para "
        "uso diario.",
        "price": 22000,
        "stock": 200,
        "category": "sublimación",
        "images": ["https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800"],
    },
    {
        "name": "Corte de Vinilo Textil (m²)",
        "description": "Corte de vinilo textil de precisión para logos, números y letras. "
        "Aplicación en prendas por termofijado.",
        "price": 38000,
        "stock": 999,
        "category": "vinilo",
        "images": ["https://images.unsplash.com/photo-1633354931133-2b7a26f4c37f?w=800"],
    },
    {
        "name": "Impresión Gran Formato - Pendón / Banner",
        "description": "Impresión de pendones y banners publicitarios en gran formato. Material "
        "resistente para interior y exterior.",
        "price": 60000,
        "stock": 999,
        "category": "gran formato",
        "images": ["https://images.unsplash.com/photo-1588412079929-790b9f593d8e?w=800"],
    },
    {
        "name": "Diseño Gráfico Personalizado",
        "description": "Servicio de diseño gráfico profesional: logos, artes para estampado y "
        "piezas publicitarias listas para imprimir.",
        "price": 80000,
        "stock": 999,
        "category": "diseño",
        "images": ["https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800"],
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
    if config.RESEED_PRODUCTS:
        # Opt-in full refresh of the sample catalog (removes ALL products).
        deleted = (await db.products.delete_many({})).deleted_count
        logger.info("RESEED_PRODUCTS set: cleared %d existing products", deleted)
    elif await db.products.count_documents({}) > 0:
        return
    for data in DEMO_PRODUCTS:
        product = Product(**data)
        product.slug = slugify(product.name)
        await db.products.insert_one(product.model_dump())
    await ensure_categories()
    logger.info("Seeded %d demo products", len(DEMO_PRODUCTS))


async def ensure_categories() -> None:
    """Make sure every category used by a product exists in the categories list."""
    db = get_db()
    from .routers.categories import ensure_category

    names = await db.products.distinct("category")
    for name in names:
        await ensure_category(db, name)
