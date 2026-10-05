"""
Detection Provider Architecture for Marine Plastic Detection.

Defines a clean interface for computer-vision inference:
DetectionProvider
    ├── DemoDetectionProvider
    └── RealDetectionProvider

No fake detections, random object counts, or fabricated confidence values.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import os
from ai.config import MODEL_PATH, CONFIDENCE_THRESHOLD, PLASTIC_CLASSES


class DetectionResult:
    """Standardized result returned by all DetectionProvider implementations."""

    def __init__(
        self,
        source: str,  # "AI" | "DEMO"
        engine_name: str,  # "REAL MODEL" | "DEMO MODE"
        is_real_model: bool,
        status_message: str,
        detections: List[Dict[str, Any]],
        total_objects: int,
        model_error: Optional[str] = None,
    ):
        self.source = source
        self.engine_name = engine_name
        self.is_real_model = is_real_model
        self.status_message = status_message
        self.detections = detections
        self.total_objects = total_objects
        self.model_error = model_error

    def to_dict(self) -> dict:
        return {
            "source": self.source,
            "engine_name": self.engine_name,
            "is_real_model": self.is_real_model,
            "status_message": self.status_message,
            "detections": self.detections,
            "total_objects": self.total_objects,
            "model_error": self.model_error,
        }


class DetectionProvider(ABC):
    """Abstract base provider for detection engines."""

    @abstractmethod
    def detect(self, image_path: str) -> DetectionResult:
        """Run detection on the given image path and return DetectionResult."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Return True only if a real computer vision model is installed and configured."""
        pass

    @abstractmethod
    def get_info(self) -> dict:
        """Return metadata about the provider."""
        pass


class RealDetectionProvider(DetectionProvider):
    """
    Executes actual YOLO computer vision model inference when configured.
    Requires MODEL_PATH pointing to existing weights and ultralytics installed.
    """

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or MODEL_PATH
        self._model = None
        self._load_error: Optional[str] = None
        self._attempted_load = False

    def is_available(self) -> bool:
        if not self.model_path or not os.path.isfile(self.model_path):
            return False
        try:
            import ultralytics  # noqa: F401
            return True
        except ImportError:
            return False

    def _ensure_model(self):
        if self._attempted_load:
            return self._model, self._load_error
        self._attempted_load = True

        if not self.model_path:
            self._load_error = "MODEL_PATH is not configured in environment."
            return None, self._load_error

        if not os.path.isfile(self.model_path):
            self._load_error = f"Model weights file not found at: {self.model_path}"
            return None, self._load_error

        try:
            from ultralytics import YOLO
            self._model = YOLO(self.model_path)
            self._load_error = None
            return self._model, None
        except ImportError:
            self._load_error = "ultralytics package is not installed."
            return None, self._load_error
        except Exception as exc:
            self._load_error = f"Error loading model: {exc}"
            return None, self._load_error

    def detect(self, image_path: str) -> DetectionResult:
        model, error = self._ensure_model()
        if model is None:
            return DetectionResult(
                source="AI",
                engine_name="REAL MODEL",
                is_real_model=False,
                status_message=f"Model execution failed: {error}",
                detections=[],
                total_objects=0,
                model_error=error,
            )

        try:
            results = model(image_path, conf=CONFIDENCE_THRESHOLD)
            detections = []
            for result in results:
                boxes = result.boxes
                if boxes is None:
                    continue
                for box in boxes:
                    cls_idx = int(box.cls[0])
                    conf = float(box.conf[0])
                    x1, y1, x2, y2 = box.xyxy[0].tolist()

                    if cls_idx < len(PLASTIC_CLASSES):
                        plastic_type = PLASTIC_CLASSES[cls_idx]
                    else:
                        plastic_type = f"class_{cls_idx}"

                    detections.append({
                        "plastic_type": plastic_type,
                        "confidence": round(conf, 4),
                        "bbox": {
                            "x_min": round(x1, 2),
                            "y_min": round(y1, 2),
                            "x_max": round(x2, 2),
                            "y_max": round(y2, 2),
                        },
                    })

            return DetectionResult(
                source="AI",
                engine_name="REAL MODEL",
                is_real_model=True,
                status_message="Real model inference completed.",
                detections=detections,
                total_objects=len(detections),
                model_error=None,
            )
        except Exception as exc:
            return DetectionResult(
                source="AI",
                engine_name="REAL MODEL",
                is_real_model=False,
                status_message=f"Inference runtime error: {exc}",
                detections=[],
                total_objects=0,
                model_error=str(exc),
            )

    def get_info(self) -> dict:
        avail = self.is_available()
        return {
            "provider": "RealDetectionProvider",
            "available": avail,
            "engine_name": "REAL MODEL" if avail else "DEMO MODE",
            "model_path": self.model_path or "(not configured)",
            "details": (
                "Ultralytics YOLO marine plastic model."
                if avail
                else "No trained model weights configured in environment."
            ),
        }


class DemoDetectionProvider(DetectionProvider):
    """
    Transparent Demonstration Provider.
    Used when no trained computer-vision model is configured in the environment.
    Does NOT generate fake AI detections, random counts, or fabricated confidence values.
    """

    def is_available(self) -> bool:
        return True

    def detect(self, image_path: str) -> DetectionResult:
        # Factual, non-fabricated demo output:
        # 0 objects detected, explicitly reporting that no trained model is configured.
        return DetectionResult(
            source="DEMO",
            engine_name="DEMO MODE",
            is_real_model=False,
            status_message="Simulated demonstration result — no trained model configured.",
            detections=[],
            total_objects=0,
            model_error="No trained model configured. Demonstrating system workflow without fake inference.",
        )

    def get_info(self) -> dict:
        return {
            "provider": "DemoDetectionProvider",
            "available": True,
            "engine_name": "DEMO MODE",
            "model_path": None,
            "details": "Simulated demonstration result — no trained model configured.",
        }


def get_detection_provider() -> DetectionProvider:
    """Factory: returns RealDetectionProvider if trained model is available, otherwise DemoDetectionProvider."""
    real_provider = RealDetectionProvider()
    if real_provider.is_available():
        return real_provider
    return DemoDetectionProvider()
