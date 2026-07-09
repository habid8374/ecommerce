"""Pydantic models: persisted documents and request/response DTOs.

Money is stored as an integer number of whole COP pesos (Colombian pesos have
no cents in practice). Wompi expects `amount_in_cents`, so multiply by 100 only
at the payment boundary.
"""
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


def slugify(value: str) -> str:
    # Strip accents so slugs are clean ASCII URLs (café -> cafe).
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^\w\s-]", "", value.lower()).strip()
    return re.sub(r"[\s_-]+", "-", value) or _uuid()[:8]


# --------------------------------------------------------------------------
# Users
# --------------------------------------------------------------------------
class Role(str, Enum):
    customer = "customer"
    admin = "admin"


class DocType(str, Enum):
    CC = "CC"    # Cédula de ciudadanía
    CE = "CE"    # Cédula de extranjería
    NIT = "NIT"  # NIT (empresas)
    PP = "PP"    # Pasaporte
    TI = "TI"    # Tarjeta de identidad


class Profile(BaseModel):
    """Full customer profile — captured at registration, reused at checkout
    (including data required for the electronic invoice)."""
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    doc_type: DocType = DocType.CC
    doc_number: str = Field(min_length=3, max_length=40)
    phone: str = Field(min_length=3, max_length=40)
    address: str = Field(min_length=3, max_length=300)
    city: str = Field(min_length=1, max_length=120)
    region: str = Field(min_length=1, max_length=120)  # Departamento
    address_notes: str = Field(default="", max_length=300)
    postal_code: str = Field(default="", max_length=20)


class ProfileUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, max_length=80)
    last_name: Optional[str] = Field(default=None, max_length=80)
    doc_type: Optional[DocType] = None
    doc_number: Optional[str] = Field(default=None, max_length=40)
    phone: Optional[str] = Field(default=None, max_length=40)
    address: Optional[str] = Field(default=None, max_length=300)
    city: Optional[str] = Field(default=None, max_length=120)
    region: Optional[str] = Field(default=None, max_length=120)
    address_notes: Optional[str] = Field(default=None, max_length=300)
    postal_code: Optional[str] = Field(default=None, max_length=20)


class UserPublic(BaseModel):
    # email is a plain str here (already validated at registration) so internal
    # domains like admin@company.local don't fail serialization.
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    first_name: str = ""
    last_name: str = ""
    doc_type: Optional[DocType] = None
    doc_number: str = ""
    phone: str = ""
    address: str = ""
    city: str = ""
    region: str = ""
    address_notes: str = ""
    postal_code: str = ""
    role: Role
    created_at: datetime

    @property
    def profile_complete(self) -> bool:
        return all([
            self.first_name, self.last_name, self.doc_number,
            self.phone, self.address, self.city, self.region,
        ])


class UserRegister(Profile):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


# --------------------------------------------------------------------------
# Products
# --------------------------------------------------------------------------
class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uuid)
    name: str
    slug: str = ""
    created_at: datetime = Field(default_factory=_now)


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    price: int = Field(ge=0, description="Price in whole COP pesos")
    stock: int = Field(default=0, ge=0)
    category: str = "general"
    images: List[str] = Field(default_factory=list)
    active: bool = True

    @field_validator("category")
    @classmethod
    def _norm_category(cls, v: str) -> str:
        return (v or "general").strip().lower() or "general"


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = None
    price: Optional[int] = Field(default=None, ge=0)
    stock: Optional[int] = Field(default=None, ge=0)
    category: Optional[str] = None
    images: Optional[List[str]] = None
    active: Optional[bool] = None


class Product(ProductBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uuid)
    slug: str = ""
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


# --------------------------------------------------------------------------
# Orders
# --------------------------------------------------------------------------
class OrderStatus(str, Enum):
    pending = "pending"        # created, awaiting payment
    paid = "paid"              # payment approved
    processing = "processing"  # being prepared
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"


class PaymentStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    declined = "declined"
    error = "error"
    voided = "voided"


class ShippingAddress(BaseModel):
    full_name: str = Field(min_length=1, max_length=160)
    phone: str = Field(min_length=1, max_length=40)
    address: str = Field(min_length=1, max_length=300)
    city: str = Field(min_length=1, max_length=120)
    region: str = Field(default="", max_length=120)
    notes: str = Field(default="", max_length=500)
    postal_code: str = Field(default="", max_length=20)


class CartItemIn(BaseModel):
    product_id: str
    quantity: int = Field(ge=1, le=999)


class ShippingMethod(str, Enum):
    carrier = "carrier"  # Transportadora (nacional)
    local = "local"      # Domicilio local (área metropolitana)


class OrderCreate(BaseModel):
    # Shipping/invoice data comes from the customer's saved profile, so the
    # checkout only needs the cart items and the chosen shipping method.
    items: List[CartItemIn] = Field(min_length=1)
    shipping_method: ShippingMethod = ShippingMethod.carrier
    shipping_zone: str = ""  # required when shipping_method == local


class OrderShippingUpdate(BaseModel):
    carrier_name: str = Field(default="", max_length=120)
    tracking_number: str = Field(default="", max_length=120)


class OrderItem(BaseModel):
    product_id: str
    name: str
    price: int
    quantity: int
    subtotal: int


class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uuid)
    reference: str = Field(default_factory=lambda: _uuid().replace("-", ""))
    user_id: Optional[str] = None
    customer_email: str = ""
    customer_name: str = ""
    # Invoice identity (from the profile).
    doc_type: Optional[DocType] = None
    doc_number: str = ""
    items: List[OrderItem] = Field(default_factory=list)
    subtotal: int = 0
    shipping_cost: int = 0
    total: int = 0
    # Shipping method + fulfillment tracking.
    shipping_method: ShippingMethod = ShippingMethod.carrier
    shipping_zone: str = ""
    carrier_name: str = ""
    tracking_number: str = ""
    status: OrderStatus = OrderStatus.pending
    payment_status: PaymentStatus = PaymentStatus.pending
    payment_provider: str = "wompi"
    wompi_transaction_id: Optional[str] = None
    shipping_address: Optional[ShippingAddress] = None
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


# --------------------------------------------------------------------------
# Payments
# --------------------------------------------------------------------------
class PaymentIntent(BaseModel):
    enabled: bool                      # True when real Wompi checkout is available
    simulate: bool                     # True when the dev "simulate" endpoint is live
    reference: str
    amount_in_cents: int
    currency: str
    public_key: str = ""
    integrity_signature: str = ""
    redirect_url: str = ""
    checkout_url: str = ""


# --------------------------------------------------------------------------
# Admin dashboard
# --------------------------------------------------------------------------
class DashboardStats(BaseModel):
    revenue: int
    orders_total: int
    orders_pending: int
    orders_paid: int
    customers_total: int
    products_total: int
    low_stock: int
    recent_orders: List[Order]


class CustomerSummary(BaseModel):
    id: str
    name: str
    email: str
    phone: str = ""
    city: str = ""
    created_at: datetime
    orders_count: int
    total_spent: int
