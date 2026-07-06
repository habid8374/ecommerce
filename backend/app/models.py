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


class UserPublic(BaseModel):
    # email is a plain str here (already validated at registration) so internal
    # domains like admin@company.local don't fail serialization.
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: Role
    created_at: datetime


class UserRegister(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
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


class CartItemIn(BaseModel):
    product_id: str
    quantity: int = Field(ge=1, le=999)


class OrderCreate(BaseModel):
    items: List[CartItemIn] = Field(min_length=1)
    shipping_address: ShippingAddress


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
    items: List[OrderItem] = Field(default_factory=list)
    subtotal: int = 0
    shipping_cost: int = 0
    total: int = 0
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
    created_at: datetime
    orders_count: int
    total_spent: int
