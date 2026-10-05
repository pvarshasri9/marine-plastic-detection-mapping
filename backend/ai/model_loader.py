"""
Model loader interface for marine plastic detection.

Delegates to provider architecture.
Never pretends a model is loaded when it isn't.
"""

from ai.provider import get_detection_provider, RealDetectionProvider


def load_model():
    """
    Attempt to load the YOLO model if available.
    Returns (model_or_None, error_string).
    """
    real = RealDetectionProvider()
    return real._ensure_model()


def get_model_status() -> dict:
    """Return human-readable status of the detection engine and model configuration."""
    provider = get_detection_provider()
    info = provider.get_info()
    is_real = info.get("provider") == "RealDetectionProvider" and info.get("available", False)

    return {
        "model_available": is_real,
        "engine_name": "REAL MODEL" if is_real else "DEMO MODE",
        "provider": info.get("provider"),
        "model_path": info.get("model_path") or "(not configured)",
        "status_message": info.get("details"),
        "error": None if is_real else "No trained model weights configured in environment (MODEL_PATH unset).",
        "demo_mode_active": not is_real,
    }
