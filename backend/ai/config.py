"""
AI Module Configuration.

Marine-Plastic-specific YOLO model integration point.
If no model file is available, the system transparently switches to DEMO MODE.
"""

import os

# Path to the YOLO weights file trained for marine plastic detection.
# Set MODEL_PATH in .env to enable real AI inference.
MODEL_PATH = os.getenv("MODEL_PATH", "")

# Confidence threshold for reporting a detection (0–1)
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.25"))

# Known plastic classes that a marine-plastic detector should produce.
# Update this list to match your specific model's class names.
PLASTIC_CLASSES = [
    "plastic_bottle",
    "plastic_bag",
    "plastic_container",
    "plastic_film",
    "fishing_net",
    "foam",
    "rope",
    "other_plastic",
]

# Demo samples used ONLY when MODEL_PATH is not set.
# These are labelled DEMO at every display point.
DEMO_DETECTIONS = [
    {
        "plastic_type": "plastic_bottle",
        "confidence": 0.87,
        "bbox": {"x_min": 120, "y_min": 80, "x_max": 220, "y_max": 280},
    },
    {
        "plastic_type": "plastic_bag",
        "confidence": 0.72,
        "bbox": {"x_min": 300, "y_min": 150, "x_max": 420, "y_max": 320},
    },
    {
        "plastic_type": "foam",
        "confidence": 0.65,
        "bbox": {"x_min": 50, "y_min": 200, "x_max": 160, "y_max": 350},
    },
]
