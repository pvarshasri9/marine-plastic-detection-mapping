"""Report and CSV export routes."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from models.database import get_db
from models.models import User
from api.dependencies import get_current_user
from services.report_service import generate_pdf, generate_csv
import io

router = APIRouter(prefix="/api", tags=["reports"])


@router.post("/reports/{detection_id}")
def create_report(
    detection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pdf_bytes = generate_pdf(db, detection_id, current_user.id)
    except ValueError as exc:
        raise HTTPException(404, str(exc))
    except Exception as exc:
        raise HTTPException(500, f"Report generation failed: {exc}")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=detection_{detection_id}_report.pdf"
        },
    )


@router.get("/reports/{detection_id}")
def get_report(
    detection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pdf_bytes = generate_pdf(db, detection_id, current_user.id)
    except ValueError as exc:
        raise HTTPException(404, str(exc))
    except Exception as exc:
        raise HTTPException(500, f"Report generation failed: {exc}")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=detection_{detection_id}_report.pdf"
        },
    )


@router.get("/export/detections.csv")
def export_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    csv_data = generate_csv(db, current_user.id)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=detections.csv"},
    )
