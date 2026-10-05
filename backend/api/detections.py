"""Detection routes — analyze, save, list, get, delete."""

import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from models.database import get_db
from models.models import Detection, DetectedObject, User
from services.file_service import save_original, annotated_path_for, delete_files, resolve_image_path
from services.auth_service import decode_token
from ai.detector import run_detection, draw_bounding_boxes
from ai.model_loader import get_model_status
from api.dependencies import get_current_user
from config import UPLOAD_DIR

router = APIRouter(prefix="/api/detections", tags=["detections"])


def _clean_rel_path(path: Optional[str], default_folder: str = "original") -> Optional[str]:
    if not path:
        return None
    normalized = path.replace("\\", "/")
    idx = normalized.find("/uploads/")
    if idx != -1:
        return normalized[idx + 1:]  # 'uploads/...'
    if normalized.startswith("uploads/"):
        return normalized
    # Fallback to filename inside default folder
    base = os.path.basename(path)
    return f"uploads/{default_folder}/{base}"


def _detection_dict(det: Detection) -> dict:
    rel_original = _clean_rel_path(det.original_image_path, "original")
    rel_annotated = _clean_rel_path(det.annotated_image_path, "annotated") if det.annotated_image_path else None
    is_real = det.detection_source == "AI"
    return {
        "id": det.id,
        "image_filename": det.image_filename,
        "original_image_path": rel_original,
        "annotated_image_path": rel_annotated,
        "image_url": f"/api/detections/{det.id}/image",
        "annotated_image_url": f"/api/detections/{det.id}/annotated-image" if det.annotated_image_path else None,
        "latitude": det.latitude,
        "longitude": det.longitude,
        "location_name": det.location_name,
        "total_objects": det.total_objects,
        "detection_source": det.detection_source,
        "engine_name": "REAL MODEL" if is_real else "DEMO MODE",
        "is_real_model": is_real,
        "status_message": (
            "Real model inference completed."
            if is_real
            else "Simulated demonstration result — no trained model configured."
        ),
        "created_at": det.created_at.isoformat() if det.created_at else None,
        "detected_objects": [
            {
                "id": obj.id,
                "plastic_type": obj.plastic_type,
                "confidence": obj.confidence,
                "x_min": obj.x_min,
                "y_min": obj.y_min,
                "x_max": obj.x_max,
                "y_max": obj.y_max,
            }
            for obj in det.detected_objects
        ],
    }


@router.get("/model-status")
def model_status():
    return get_model_status()


@router.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload image and run detection using active DetectionProvider."""
    filename, rel_path, abs_path = await save_original(file)
    result = run_detection(abs_path)

    # Generate annotated image
    ann_filename, ann_rel_path, ann_abs_path = annotated_path_for(filename)
    draw_bounding_boxes(abs_path, result["detections"], ann_abs_path, result["source"])

    return {
        "filename": filename,
        "original_path": rel_path,
        "annotated_path": ann_rel_path if os.path.isfile(ann_abs_path) else None,
        "source": result["source"],
        "engine_name": result.get("engine_name", "DEMO MODE"),
        "is_real_model": result.get("is_real_model", False),
        "status_message": result.get("status_message", "Simulated demonstration result — no trained model configured."),
        "model_error": result.get("model_error"),
        "detections": result["detections"],
        "total_objects": len(result["detections"]),
    }


class SaveDetectionRequest(BaseModel):
    filename: str
    original_path: str
    annotated_path: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    source: str
    detections: list


@router.post("", status_code=201)
def save_detection(
    body: SaveDetectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save a previously-analyzed detection to the database."""
    # Validate coordinates
    if body.latitude is not None and not (-90 <= body.latitude <= 90):
        raise HTTPException(400, "Latitude must be between -90 and 90.")
    if body.longitude is not None and not (-180 <= body.longitude <= 180):
        raise HTTPException(400, "Longitude must be between -180 and 180.")
    if body.source not in ("AI", "DEMO"):
        raise HTTPException(400, "Source must be 'AI' or 'DEMO'.")

    det = Detection(
        user_id=current_user.id,
        image_filename=body.filename,
        original_image_path=body.original_path,
        annotated_image_path=body.annotated_path,
        latitude=body.latitude,
        longitude=body.longitude,
        location_name=body.location_name,
        total_objects=len(body.detections),
        detection_source=body.source,
    )
    db.add(det)
    db.flush()

    for d in body.detections:
        bbox = d.get("bbox", {})
        obj = DetectedObject(
            detection_id=det.id,
            plastic_type=d["plastic_type"],
            confidence=float(d["confidence"]),
            x_min=float(bbox.get("x_min", 0)),
            y_min=float(bbox.get("y_min", 0)),
            x_max=float(bbox.get("x_max", 0)),
            y_max=float(bbox.get("y_max", 0)),
        )
        db.add(obj)

    db.commit()
    db.refresh(det)
    return _detection_dict(det)


@router.get("")
def list_detections(
    search: Optional[str] = Query(None),
    plastic_type: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Detection).filter(Detection.user_id == current_user.id)

    if search:
        query = query.filter(Detection.location_name.contains(search))
    if source and source in ("AI", "DEMO"):
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
    return [_detection_dict(d) for d in dets]


@router.get("/{detection_id}")
def get_detection(
    detection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    det = (
        db.query(Detection)
        .filter(Detection.id == detection_id, Detection.user_id == current_user.id)
        .first()
    )
    if not det:
        raise HTTPException(404, f"Detection {detection_id} not found.")
    return _detection_dict(det)


@router.get("/{detection_id}/image")
def get_detection_image(
    detection_id: int,
    db: Session = Depends(get_db),
):
    """
    Find detection, verify physical image exists on disk, and return image file with correct MIME type.
    Returns 404 JSON error if not found.
    """
    det = db.query(Detection).filter(Detection.id == detection_id).first()
    if not det:
        raise HTTPException(status_code=404, detail=f"Detection {detection_id} not found.")

    file_path = resolve_image_path(det.original_image_path)
    if not file_path or not os.path.isfile(file_path):
        raise HTTPException(
            status_code=404,
            detail="Original image file not found on disk. Check whether the uploaded file still exists.",
        )

    ext = Path(file_path).suffix.lower()
    media_type = "image/png" if ext == ".png" else "image/jpeg"
    return FileResponse(file_path, media_type=media_type)


@router.get("/{detection_id}/annotated-image")
def get_detection_annotated_image(
    detection_id: int,
    db: Session = Depends(get_db),
):
    """
    Find detection, verify physical annotated image exists on disk, and return annotated image file.
    """
    det = db.query(Detection).filter(Detection.id == detection_id).first()
    if not det:
        raise HTTPException(status_code=404, detail=f"Detection {detection_id} not found.")

    file_path = resolve_image_path(det.annotated_image_path)
    if not file_path or not os.path.isfile(file_path):
        raise HTTPException(
            status_code=404,
            detail="Annotated image file not found on disk.",
        )

    ext = Path(file_path).suffix.lower()
    media_type = "image/png" if ext == ".png" else "image/jpeg"
    return FileResponse(file_path, media_type=media_type)



@router.delete("/{detection_id}", status_code=204)
def delete_detection(
    detection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    det = (
        db.query(Detection)
        .filter(Detection.id == detection_id, Detection.user_id == current_user.id)
        .first()
    )
    if not det:
        raise HTTPException(404, f"Detection {detection_id} not found.")

    orig = det.original_image_path
    ann = det.annotated_image_path
    db.delete(det)
    db.commit()
    delete_files(orig, ann)
