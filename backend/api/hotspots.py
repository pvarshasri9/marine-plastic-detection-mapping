"""
Hotspot Intelligence API routes.
"""

from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from models.database import get_db
from models.models import User
from api.dependencies import get_current_user
from services.hotspot_service import compute_hotspots, update_cleanup_status

router = APIRouter(prefix="/api/hotspots", tags=["hotspots"])


class UpdateCleanupStatusRequest(BaseModel):
    hotspot_key: Optional[str] = None
    location_name: str
    center_lat: Optional[float] = None
    center_lon: Optional[float] = None
    status: str
    notes: Optional[str] = None


@router.get("")
def get_hotspots(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns Hotspot Intelligence analysis:
    - Ranked hotspots with transparent priority scores & explanations
    - Summary metrics & status breakdown
    - Scoring methodology documentation
    """
    return compute_hotspots(db, current_user.id)


@router.post("/cleanup-status")
def set_cleanup_status(
    payload: UpdateCleanupStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Updates the cleanup status of a hotspot without modifying detection records.
    Records previous status, new status, and timestamp in cleanup_status_history.
    """
    try:
        key = payload.hotspot_key or f"loc_{payload.location_name.strip().lower()}"
        updated = update_cleanup_status(
            db=db,
            user_id=current_user.id,
            hotspot_key=key,
            location_name=payload.location_name,
            center_lat=payload.center_lat,
            center_lon=payload.center_lon,
            new_status=payload.status,
            notes=payload.notes,
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
