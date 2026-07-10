"""Admin-managed system settings (Wompi env/keys, Brevo email, company data)."""
from fastapi import APIRouter, Body, Depends

from ..deps import get_current_admin
from ..models import UserPublic
from ..services.settings_store import get_settings, resolve_wompi, update_settings

router = APIRouter(prefix="/api/admin/settings", tags=["admin"])

public_router = APIRouter(prefix="/api/settings", tags=["settings"])


@public_router.get("/public")
async def public_settings_view():
    """Non-secret settings (company + shipping) for the storefront/print."""
    settings = await get_settings()
    return {
        "company": settings.get("company", {}),
        "shipping": settings.get("shipping", {}),
    }


@router.get("")
async def read_settings(_: UserPublic = Depends(get_current_admin)):
    """Full settings for the admin editor (includes secrets — admin only)."""
    settings = await get_settings()
    settings.pop("_id", None)
    wompi = resolve_wompi(settings)
    settings["_effective"] = {
        "wompi_environment": wompi["environment"],
        "wompi_enabled": wompi["enabled"],
        "payments_mode": "wompi" if wompi["enabled"] else "simulado",
    }
    return settings


@router.put("")
async def write_settings(
    patch: dict = Body(...), _: UserPublic = Depends(get_current_admin)
):
    patch.pop("_id", None)
    patch.pop("_effective", None)
    updated = await update_settings(patch)
    updated.pop("_id", None)
    return updated


@router.post("/factus/test")
async def test_factus(_: UserPublic = Depends(get_current_admin)):
    """Validate the saved Factus credentials by authenticating against Factus."""
    from ..services.factus import test_connection

    return await test_connection()
