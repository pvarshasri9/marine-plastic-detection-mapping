"""
Demo dataset API — clearly labelled sample data for demonstration.

Creates ~10 sample detection records with source='DEMO'.
The UI must display 'DEMO DATA — NOT REAL-WORLD OBSERVATION' wherever these appear.
"""

import os
import random
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models.database import get_db
from models.models import Detection, DetectedObject, User
from api.dependencies import get_current_user
from config import UPLOAD_DIR

router = APIRouter(prefix="/api/demo", tags=["demo"])

# Sample coastal locations with realistic coordinates
DEMO_LOCATIONS = [
    {"name": "Marina Beach, Chennai", "lat": 13.0500, "lon": 80.2824},
    {"name": "Juhu Beach, Mumbai", "lat": 19.0990, "lon": 72.8266},
    {"name": "Kovalam Beach, Kerala", "lat": 8.4004, "lon": 76.9784},
    {"name": "Puri Beach, Odisha", "lat": 19.8134, "lon": 85.8315},
    {"name": "Calangute Beach, Goa", "lat": 15.5438, "lon": 73.7545},
    {"name": "Varkala Beach, Kerala", "lat": 8.7336, "lon": 76.7147},
    {"name": "Rushikonda Beach, Vizag", "lat": 17.7822, "lon": 83.3858},
    {"name": "Mandarmani Beach, WB", "lat": 21.6696, "lon": 87.5081},
    {"name": "Diveagar Beach, Maharashtra", "lat": 18.1812, "lon": 73.0478},
    {"name": "Tarkarli Beach, Sindhudurg", "lat": 16.0321, "lon": 73.4727},
]

DEMO_PLASTIC_TYPES = [
    "plastic_bottle",
    "plastic_bag",
    "fishing_net",
    "plastic_container",
    "foam",
    "other_plastic",
]

# Confidence ranges per type (realistic-looking demo values)
CONFIDENCE_RANGES = {
    "plastic_bottle": (0.78, 0.95),
    "plastic_bag": (0.65, 0.89),
    "fishing_net": (0.70, 0.92),
    "plastic_container": (0.72, 0.90),
    "foam": (0.60, 0.85),
    "other_plastic": (0.55, 0.80),
}

# A placeholder 1x1 pixel placeholder image we can write so image paths exist
def _ensure_demo_image(filename: str) -> str:
    """Create a sample demonstration image for demo records if not present."""
    orig_dir = os.path.join(UPLOAD_DIR, "original")
    os.makedirs(orig_dir, exist_ok=True)
    path = os.path.abspath(os.path.join(orig_dir, filename))
    if not os.path.isfile(path):
        try:
            from PIL import Image as PILImage, ImageDraw
            img = PILImage.new("RGB", (640, 480), color=(14, 52, 85))
            draw = ImageDraw.Draw(img)
            for y in range(0, 480, 20):
                draw.line([(0, y), (640, y)], fill=(20, 65, 105), width=1)
            draw.rectangle([20, 20, 620, 460], outline=(40, 110, 160), width=2)
            draw.rectangle([40, 40, 600, 90], fill=(220, 53, 69))
            draw.text((55, 55), "DEMO DATASET SAMPLE - MARINE DEBRIS SIMULATION", fill=(255, 255, 255))
            draw.text((55, 130), f"File: {filename}", fill=(200, 230, 255))
            draw.text((55, 160), "Generated as reference baseline for geographic & trend analytics.", fill=(160, 200, 230))
            draw.text((55, 220), "To inspect real detection on uploaded photographs, use the 'Detect Plastic' tab.", fill=(255, 255, 255))
            img.save(path, "JPEG")
        except Exception:
            with open(path, "wb") as f:
                f.write(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9")
    return path


@router.post("/load")
def load_demo_dataset(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create ~10 sample detection records with source=DEMO.
    Idempotent: clears existing DEMO records for this user first, then inserts fresh ones.
    """
    # Remove existing demo records for this user (clean slate)
    existing_demos = db.query(Detection).filter(
        Detection.user_id == current_user.id,
        Detection.detection_source == "DEMO",
    ).all()
    for det in existing_demos:
        db.delete(det)
    db.flush()

    created_count = 0
    base_date = datetime.utcnow() - timedelta(days=30)

    for i, location in enumerate(DEMO_LOCATIONS):
        # Vary the date across the past 30 days
        detection_date = base_date + timedelta(days=i * 3, hours=random.randint(6, 18))

        # Pick 2–5 plastic types for this detection
        num_types = random.randint(2, 5)
        plastic_types = random.sample(DEMO_PLASTIC_TYPES, num_types)

        img_filename = f"demo_{current_user.id}_{i:02d}.jpg"
        _ensure_demo_image(img_filename)
        rel_img_path = f"uploads/original/{img_filename}"

        det = Detection(
            user_id=current_user.id,
            image_filename=img_filename,
            original_image_path=rel_img_path,
            annotated_image_path=None,
            latitude=location["lat"],
            longitude=location["lon"],
            location_name=location["name"],
            total_objects=num_types,
            detection_source="DEMO",
        )
        # Override the server_default timestamp for realistic spread
        det.created_at = detection_date
        db.add(det)
        db.flush()

        # Add detected object rows
        for ptype in plastic_types:
            lo, hi = CONFIDENCE_RANGES.get(ptype, (0.60, 0.85))
            conf = round(random.uniform(lo, hi), 4)
            obj = DetectedObject(
                detection_id=det.id,
                plastic_type=ptype,
                confidence=conf,
                x_min=random.randint(20, 80),
                y_min=random.randint(20, 80),
                x_max=random.randint(150, 380),
                y_max=random.randint(150, 280),
            )
            db.add(obj)

        created_count += 1

    db.commit()

    return {
        "message": f"Demo dataset loaded: {created_count} sample detection records created.",
        "count": created_count,
        "warning": "DEMO DATA — NOT REAL-WORLD OBSERVATIONS. All records have detection_source='DEMO'.",
    }


@router.delete("/clear")
def clear_demo_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove all DEMO records for the current user."""
    demos = db.query(Detection).filter(
        Detection.user_id == current_user.id,
        Detection.detection_source == "DEMO",
    ).all()
    count = len(demos)
    for det in demos:
        db.delete(det)
    db.commit()
    return {"message": f"Removed {count} demo records.", "count": count}
