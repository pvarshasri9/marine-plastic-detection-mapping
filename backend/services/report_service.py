"""
Report service — generates PDF and CSV from real detection records.
No fabricated environmental claims.
"""

import csv
import io
import os
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, HRFlowable
)
from sqlalchemy.orm import Session
from models.models import Detection, DetectedObject
from services.file_service import resolve_image_path


def _pollution_indicator(total_objects: int) -> tuple[str, str]:
    """
    Project-defined indicator based on detected object count.
    NOT an official environmental standard.
    """
    if total_objects <= 3:
        return "Low", "#27AE60"
    elif total_objects <= 10:
        return "Medium", "#F39C12"
    else:
        return "High", "#E74C3C"


def generate_pdf(db: Session, detection_id: int, user_id: int) -> bytes:
    det = (
        db.query(Detection)
        .filter(Detection.id == detection_id, Detection.user_id == user_id)
        .first()
    )
    if not det:
        raise ValueError(f"Detection {detection_id} not found.")

    objects = db.query(DetectedObject).filter(DetectedObject.detection_id == detection_id).all()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
    )
    styles = getSampleStyleSheet()
    story = []

    # Header
    header_style = ParagraphStyle("header", fontSize=18, textColor=colors.HexColor("#1A237E"),
                                   spaceAfter=6, fontName="Helvetica-Bold")
    sub_style = ParagraphStyle("sub", fontSize=10, textColor=colors.HexColor("#546E7A"),
                                spaceAfter=12)
    story.append(Paragraph("Marine Plastic Detection & Mapping", header_style))
    story.append(Paragraph("B.Tech Mini Project — Detection Report", sub_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1A237E")))
    story.append(Spacer(1, 0.4*cm))

    # Source badge
    source_color = "#E74C3C" if det.detection_source == "DEMO" else "#27AE60"
    source_label = "⚠ DEMO DATA — NOT REAL AI INFERENCE" if det.detection_source == "DEMO" else "AI INFERENCE RESULT"
    badge_style = ParagraphStyle("badge", fontSize=9, textColor=colors.white,
                                  backColor=colors.HexColor(source_color),
                                  borderPadding=4, spaceAfter=10)
    story.append(Paragraph(f"  {source_label}  ", badge_style))
    story.append(Spacer(1, 0.2*cm))

    # Detection metadata table
    indicator, _ = _pollution_indicator(det.total_objects)
    mode_label = "Demo Mode" if det.detection_source == "DEMO" else "AI Inference"
    meta_data = [
        ["Detection ID", str(det.id), "Date", det.created_at.strftime("%Y-%m-%d %H:%M") if det.created_at else "N/A"],
        ["Location", det.location_name or "Not specified", "Source / Mode", f"{det.detection_source} ({mode_label})"],
        ["Latitude", str(det.latitude or "N/A"), "Longitude", str(det.longitude or "N/A")],
        ["Total Objects", str(det.total_objects), "Indicator*", indicator],
    ]
    meta_table = Table(meta_data, colWidths=[3.5*cm, 5.5*cm, 3.5*cm, 5.5*cm])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#E8EAF6")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#E8EAF6")),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#B0BEC5")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        "* Project-defined indicator based on detected object count. "
        "Not an official environmental classification.",
        ParagraphStyle("note", fontSize=7, textColor=colors.HexColor("#78909C"))
    ))
    story.append(Spacer(1, 0.4*cm))

    # Original image
    orig_path = resolve_image_path(det.original_image_path)
    if orig_path and os.path.isfile(orig_path):
        story.append(Paragraph("Original Image", styles["Heading2"]))
        story.append(RLImage(orig_path, width=10*cm, height=7*cm, kind="proportional"))
        story.append(Spacer(1, 0.3*cm))

    # Annotated image
    ann_path = resolve_image_path(det.annotated_image_path)
    if ann_path and os.path.isfile(ann_path):
        story.append(Paragraph("Annotated Image", styles["Heading2"]))
        story.append(RLImage(ann_path, width=10*cm, height=7*cm, kind="proportional"))
        story.append(Spacer(1, 0.3*cm))

    # Detected objects table
    story.append(Paragraph("Detected Objects", styles["Heading2"]))
    if objects:
        obj_data = [["#", "Plastic Type", "Confidence", "BBox (x1,y1,x2,y2)"]]
        for i, obj in enumerate(objects, 1):
            obj_data.append([
                str(i),
                obj.plastic_type.replace("_", " ").title(),
                f"{obj.confidence * 100:.1f}%",
                f"({obj.x_min:.0f},{obj.y_min:.0f},{obj.x_max:.0f},{obj.y_max:.0f})",
            ])
        obj_table = Table(obj_data, colWidths=[1*cm, 5*cm, 3*cm, 8*cm])
        obj_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1A237E")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#B0BEC5")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F5F5")]),
            ("PADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(obj_table)
    else:
        story.append(Paragraph("No objects detected.", styles["Normal"]))

    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#B0BEC5")))
    story.append(Paragraph(
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')} | Marine Plastic Detection & Mapping",
        ParagraphStyle("footer", fontSize=7, textColor=colors.HexColor("#90A4AE"))
    ))

    doc.build(story)
    return buf.getvalue()


def generate_csv(db: Session, user_id: int) -> str:
    detections = (
        db.query(Detection)
        .filter(Detection.user_id == user_id)
        .order_by(Detection.created_at.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "detection_id", "date", "location", "latitude", "longitude",
        "total_objects", "category", "confidence", "source", "mode"
    ])

    for det in detections:
        mode_val = "Demo Mode" if det.detection_source == "DEMO" else "AI Inference"
        objects = db.query(DetectedObject).filter(DetectedObject.detection_id == det.id).all()
        if objects:
            for obj in objects:
                writer.writerow([
                    det.id,
                    det.created_at.strftime("%Y-%m-%d %H:%M") if det.created_at else "",
                    det.location_name or "",
                    det.latitude or "",
                    det.longitude or "",
                    det.total_objects,
                    obj.plastic_type,
                    f"{obj.confidence:.4f}",
                    det.detection_source,
                    mode_val,
                ])
        else:
            writer.writerow([
                det.id,
                det.created_at.strftime("%Y-%m-%d %H:%M") if det.created_at else "",
                det.location_name or "",
                det.latitude or "",
                det.longitude or "",
                det.total_objects,
                "",
                "",
                det.detection_source,
                mode_val,
            ])

    return output.getvalue()
