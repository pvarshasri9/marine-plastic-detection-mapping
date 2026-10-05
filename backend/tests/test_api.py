import pytest
from fastapi.testclient import TestClient
from main import app
from models.database import init_db

init_db()
client = TestClient(app)

def test_root_and_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}

def test_full_api_workflow():
    # 1. Register User
    user_data = {
        "name": "Test Marine Scientist",
        "email": "scientist_test@ocean.org",
        "password": "SecurePassword123",
        "confirm_password": "SecurePassword123"
    }
    reg_res = client.post("/api/auth/register", json=user_data)
    assert reg_res.status_code in (200, 201, 400)

    # 2. Login User
    login_data = {
        "email": "scientist_test@ocean.org",
        "password": "SecurePassword123"
    }
    login_res = client.post("/api/auth/login", json=login_data)
    assert login_res.status_code == 200
    data = login_res.json()
    assert "access_token" in data
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Get Auth Profile
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "scientist_test@ocean.org"

    # 4. Fetch Model Status
    status_res = client.get("/api/detections/model-status", headers=headers)
    assert status_res.status_code == 200

    # 5. Fetch Map Detections
    map_res = client.get("/api/map/detections", headers=headers)
    assert map_res.status_code == 200
    assert isinstance(map_res.json(), list)

    # 6. Fetch Heatmap
    heat_res = client.get("/api/map/heatmap", headers=headers)
    assert heat_res.status_code == 200
    assert isinstance(heat_res.json(), list)

    # 7. Fetch Analytics Summary
    sum_res = client.get("/api/analytics/summary", headers=headers)
    assert sum_res.status_code == 200

    # 8. Fetch Hotspots
    hotspot_res = client.get("/api/hotspots", headers=headers)
    assert hotspot_res.status_code == 200
    assert "hotspots" in hotspot_res.json()

    # 9. Export CSV Dataset
    csv_res = client.get("/api/export/detections.csv", headers=headers)
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]

    # 10. Test Image Upload & Dedicated Image Endpoint
    import io
    from PIL import Image as PILImage
    img_byte_arr = io.BytesIO()
    test_img = PILImage.new("RGB", (100, 100), color=(0, 120, 200))
    test_img.save(img_byte_arr, format="JPEG")
    img_bytes = img_byte_arr.getvalue()

    upload_res = client.post(
        "/api/detections/analyze",
        files={"file": ("test_ocean.jpg", img_bytes, "image/jpeg")},
        headers=headers,
    )
    assert upload_res.status_code == 200
    upload_data = upload_res.json()
    assert "filename" in upload_data
    assert upload_data["original_path"].startswith("uploads/original/")

    # Save the analyzed detection
    save_res = client.post(
        "/api/detections",
        json={
            "filename": upload_data["filename"],
            "original_path": upload_data["original_path"],
            "annotated_path": upload_data["annotated_path"],
            "latitude": 15.49,
            "longitude": 73.82,
            "location_name": "Goa Beach Test",
            "source": upload_data["source"],
            "detections": upload_data["detections"],
        },
        headers=headers,
    )
    assert save_res.status_code == 201
    saved_det = save_res.json()
    new_det_id = saved_det["id"]
    assert "image_url" in saved_det

    # Verify dedicated image endpoint GET /api/detections/{id}/image
    img_get_res = client.get(f"/api/detections/{new_det_id}/image")
    assert img_get_res.status_code == 200
    assert "image/jpeg" in img_get_res.headers["content-type"]
    assert len(img_get_res.content) > 0

    # 11. Verify GET detection list
    list_res = client.get("/api/detections", headers=headers)
    assert list_res.status_code == 200
    all_dets = list_res.json()
    assert any(d["id"] == new_det_id for d in all_dets)

    # 12. Verify GET detection by ID
    get_res = client.get(f"/api/detections/{new_det_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == new_det_id
    assert get_res.json()["location_name"] == "Goa Beach Test"

    # 13. Verify PDF generation endpoint
    pdf_res = client.get(f"/api/reports/{new_det_id}", headers=headers)
    assert pdf_res.status_code == 200
    assert "application/pdf" in pdf_res.headers["content-type"]
    assert len(pdf_res.content) > 100

    # 14. Verify CSV export contents
    csv_text = csv_res.content.decode("utf-8")
    assert "detection_id" in csv_text
    assert "category" in csv_text
    assert "source" in csv_text
    assert "mode" in csv_text
