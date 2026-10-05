"""
Detector interface for marine plastic detection.

Delegates to DetectionProvider:
- RealDetectionProvider if trained YOLO model is configured.
- DemoDetectionProvider if no model is configured.
Never invents AI accuracy, fake counts, or fabricated confidence values.
"""

import os
from PIL import Image, ImageDraw
from ai.provider import get_detection_provider


def run_detection(image_path: str) -> dict:
    """
    Run detection on the given image file using the active DetectionProvider.

    Returns:
        {
            "source": "AI" | "DEMO",
            "engine_name": "REAL MODEL" | "DEMO MODE",
            "is_real_model": bool,
            "status_message": str,
            "detections": [ { plastic_type, confidence, bbox } ],
            "total_objects": int,
            "model_error": str | None
        }
    """
    provider = get_detection_provider()
    result = provider.detect(image_path)
    return result.to_dict()


def draw_bounding_boxes(
    original_path: str, detections: list, annotated_path: str, source: str
) -> str:
    """
    Draw bounding boxes on the image and save to annotated_path.
    If no objects are detected, leaves the image clean without arbitrary lines.
    Adds a prominent, transparent banner when source == DEMO.
    Returns the annotated_path.
    """
    try:
        img = Image.open(original_path).convert("RGB")
        draw = ImageDraw.Draw(img)

        colors = {
            "plastic_bottle": "#FF6B6B",
            "plastic_bag": "#4ECDC4",
            "plastic_container": "#45B7D1",
            "plastic_film": "#96CEB4",
            "fishing_net": "#FFEAA7",
            "foam": "#DDA0DD",
            "rope": "#98D8C8",
            "other_plastic": "#F7DC6F",
        }
        default_color = "#FF9500"

        # Only draw bounding boxes for actual detections
        for det in detections:
            bbox = det.get("bbox", {})
            if not bbox:
                continue
            color = colors.get(det.get("plastic_type"), default_color)
            x1, y1, x2, y2 = (
                bbox.get("x_min", 0),
                bbox.get("y_min", 0),
                bbox.get("x_max", 0),
                bbox.get("y_max", 0),
            )
            draw.rectangle([x1, y1, x2, y2], outline=color, width=3)
            conf = det.get("confidence", 0.0)
            label = f"{det.get('plastic_type', 'debris')} {conf * 100:.0f}%"
            draw.rectangle([x1, max(0, y1 - 20), x1 + len(label) * 8, y1], fill=color)
            draw.text((x1 + 3, max(2, y1 - 18)), label, fill="white")

        # In DEMO mode, render a transparent disclaimer banner on the annotated image
        if source == "DEMO":
            w, h = img.size
            banner_h = 28
            draw.rectangle([0, 0, w, banner_h], fill=(220, 38, 38))  # Red banner
            banner_text = "⚠ DEMO MODE — SIMULATED DEMONSTRATION RESULT (NO TRAINED MODEL CONFIGURED)"
            draw.text((10, 7), banner_text, fill="white")

        os.makedirs(os.path.dirname(annotated_path), exist_ok=True)
        img.save(annotated_path)
        return annotated_path
    except Exception as exc:
        return original_path
