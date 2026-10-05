"""Map routes — geolocated detections and heatmap data."""

from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.orm import Session
from models.database import get_db
from models.models import Detection
from api.dependencies import get_current_user
from models.models import User

router = APIRouter(prefix="/api/map", tags=["map"])


@router.get("/detections")
def map_detections(
    source: Optional[str] = Query(None),
    plastic_type: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return detections with valid coordinates for map markers."""
    from models.models import DetectedObject

    query = db.query(Detection).filter(
        Detection.user_id == current_user.id,
        Detection.latitude.isnot(None),
        Detection.longitude.isnot(None),
    )
    if source in ("AI", "DEMO"):
        query = query.filter(Detection.detection_source == source)
    if date_from:
        query = query.filter(Detection.created_at >= date_from)
    if date_to:
        query = query.filter(Detection.created_at <= date_to + " 23:59:59")
    if plastic_type:
        query = query.join(DetectedObject).filter(
            DetectedObject.plastic_type == plastic_type
        )

    dets = query.order_by(Detection.created_at.desc()).all()
    return [
        {
            "id": d.id,
            "latitude": d.latitude,
            "longitude": d.longitude,
            "location_name": d.location_name,
            "total_objects": d.total_objects,
            "detection_source": d.detection_source,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "plastic_types": [
                obj.plastic_type for obj in d.detected_objects
            ],
        }
        for d in dets
    ]


@router.get("/heatmap")
def heatmap_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return coordinate points for heatmap layer (actual observations only)."""
    dets = db.query(Detection).filter(
        Detection.user_id == current_user.id,
        Detection.latitude.isnot(None),
        Detection.longitude.isnot(None),
    ).all()

    return [
        {
            "lat": d.latitude,
            "lng": d.longitude,
            "intensity": max(1, d.total_objects),
        }
        for d in dets
    ]
