import pytest
from fastapi.testclient import TestClient
from main import app
from ai.provider import (
    get_detection_provider,
    DemoDetectionProvider,
    RealDetectionProvider,
)
from services.auth_service import create_access_token
import io
from PIL import Image

client = TestClient(app)

def test_provider_architecture():
    # 1. Test DemoDetectionProvider interface
    demo_provider = DemoDetectionProvider()
    assert demo_provider.is_available() is True
    info = demo_provider.get_info()
    assert info["provider"] == "DemoDetectionProvider"
    assert info["engine_name"] == "DEMO MODE"

    # 2. Test RealDetectionProvider interface when no model exists
    real_provider = RealDetectionProvider(model_path="/nonexistent/model.pt")
    assert real_provider.is_available() is False

    # 3. Factory returns DemoDetectionProvider in current environment
    active_provider = get_detection_provider()
    assert isinstance(active_provider, DemoDetectionProvider)

    # 4. Test detect() produces no fake boxes and no fake confidence
    img_byte_arr = io.BytesIO()
    test_img = Image.new("RGB", (100, 100), color=(10, 50, 90))
    test_img.save(img_byte_arr, format="JPEG")
    img_bytes = img_byte_arr.getvalue()

    token = create_access_token({"sub": "1"})
    headers = {"Authorization": f"Bearer {token}"}

    # 5. Check model status endpoint
    status_res = client.get("/api/detections/model-status", headers=headers)
    assert status_res.status_code == 200
    st_data = status_res.json()
    assert st_data["model_available"] is False
    assert st_data["engine_name"] == "DEMO MODE"
    assert st_data["demo_mode_active"] is True

    # 6. Upload & Analyze endpoint
    upload_res = client.post(
        "/api/detections/analyze",
        files={"file": ("test_clean.jpg", img_bytes, "image/jpeg")},
        headers=headers,
    )
    assert upload_res.status_code == 200
    up_data = upload_res.json()
    assert up_data["source"] == "DEMO"
    assert up_data["engine_name"] == "DEMO MODE"
    assert up_data["is_real_model"] is False
    assert up_data["total_objects"] == 0
    assert up_data["detections"] == []
