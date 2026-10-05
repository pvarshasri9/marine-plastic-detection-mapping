"""Analytics service — all stats computed from actual DB records."""

from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from models.models import Detection, DetectedObject


def get_summary(db: Session, user_id: int) -> dict:
    total_images = db.query(Detection).filter(Detection.user_id == user_id).count()
    total_objects = (
        db.query(func.sum(Detection.total_objects))
        .filter(Detection.user_id == user_id)
        .scalar() or 0
    )
    locations = (
        db.query(Detection.location_name)
        .filter(Detection.user_id == user_id, Detection.location_name.isnot(None))
        .distinct()
        .count()
    )
    categories = (
        db.query(DetectedObject.plastic_type)
        .join(Detection)
        .filter(Detection.user_id == user_id)
        .distinct()
        .count()
    )
    return {
        "total_images": total_images,
        "total_objects": int(total_objects),
        "detection_locations": locations,
        "plastic_categories": categories,
    }


def get_category_distribution(db: Session, user_id: int) -> list:
    rows = (
        db.query(
            DetectedObject.plastic_type,
            func.count(DetectedObject.id).label("count"),
        )
        .join(Detection)
        .filter(Detection.user_id == user_id)
        .group_by(DetectedObject.plastic_type)
        .order_by(func.count(DetectedObject.id).desc())
        .all()
    )
    return [{"plastic_type": r.plastic_type, "count": r.count} for r in rows]


def get_trends(db: Session, user_id: int) -> list:
    rows = (
        db.query(
            func.date(Detection.created_at).label("date"),
            func.count(Detection.id).label("detections"),
            func.sum(Detection.total_objects).label("objects"),
        )
        .filter(Detection.user_id == user_id)
        .group_by(func.date(Detection.created_at))
        .order_by(func.date(Detection.created_at))
        .all()
    )
    return [
        {
            "date": str(r.date),
            "detections": r.detections,
            "objects": int(r.objects or 0),
        }
        for r in rows
    ]


def get_location_distribution(db: Session, user_id: int) -> list:
    rows = (
        db.query(
            Detection.location_name,
            func.count(Detection.id).label("count"),
        )
        .filter(Detection.user_id == user_id, Detection.location_name.isnot(None))
        .group_by(Detection.location_name)
        .order_by(func.count(Detection.id).desc())
        .all()
    )
    return [{"location": r.location_name, "count": r.count} for r in rows]
