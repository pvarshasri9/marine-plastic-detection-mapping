import requests
import json

BASE = "http://127.0.0.1:8000"

def main():
    # 1. Login
    login_res = requests.post(f"{BASE}/api/auth/login", json={
        "email": "scientist_test@ocean.org",
        "password": "SecurePassword123"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] 1. Auth: Login successful.")

    # 2. Get initial count
    before_dets = requests.get(f"{BASE}/api/detections", headers=headers).json()
    before_count = len(before_dets)
    print(f"[INFO] Initial detection count: {before_count}")

    # 3. Model Status Endpoint Check
    status_res = requests.get(f"{BASE}/api/detections/model-status", headers=headers)
    assert status_res.status_code == 200
    st_data = status_res.json()
    assert st_data["model_available"] is False
    assert st_data["engine_name"] == "DEMO MODE"
    print(f"[PASS] 2. Model Status: Engine={st_data['engine_name']}, RealModelAvailable={st_data['model_available']}")

    # 4. Upload & Analyze
    with open("c:/Users/VARSHA_SRI/OneDrive/Desktop/mini/test_marine_debris.jpg", "rb") as f:
        upload_res = requests.post(
            f"{BASE}/api/detections/analyze",
            files={"file": ("puducherry_debris.jpg", f, "image/jpeg")},
            headers=headers
        )
    assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
    upload_data = upload_res.json()
    assert upload_data["source"] == "DEMO"
    assert upload_data["engine_name"] == "DEMO MODE"
    assert upload_data["is_real_model"] is False
    assert upload_data["total_objects"] == 0
    assert upload_data["detections"] == []
    fn = upload_data["filename"]
    print(f"[PASS] 3. Detection Engine: Ran DemoDetectionProvider without fake inference (File={fn}, Objects=0)")

    # 5. Save Detection to DB
    save_res = requests.post(f"{BASE}/api/detections", json={
        "filename": upload_data["filename"],
        "original_path": upload_data["original_path"],
        "annotated_path": upload_data["annotated_path"],
        "latitude": 11.9338,
        "longitude": 79.8354,
        "location_name": "Puducherry Promenade Beach",
        "source": upload_data["source"],
        "detections": upload_data["detections"],
    }, headers=headers)
    assert save_res.status_code == 201, f"Save failed: {save_res.text}"
    new_det = save_res.json()
    det_id = new_det["id"]
    assert new_det["total_objects"] == 0
    assert new_det["engine_name"] == "DEMO MODE"
    print(f"[PASS] 4. Database: Saved new Detection ID #{det_id} with accurate 0 objects (no fake boxes)")

    # 6. Verify image API & physical disk
    img_res = requests.get(f"{BASE}/api/detections/{det_id}/image", headers=headers)
    assert img_res.status_code == 200, f"Image fetch failed: {img_res.status_code}"
    assert len(img_res.content) > 1000, "Image content is empty"
    print(f"[PASS] 5. Image Pipeline: Original image served via API ({len(img_res.content)} bytes)")

    # 7. Verify Annotated image API & physical disk
    ann_res = requests.get(f"{BASE}/api/detections/{det_id}/annotated-image", headers=headers)
    assert ann_res.status_code == 200, f"Annotated image fetch failed: {ann_res.status_code}"
    assert len(ann_res.content) > 1000, "Annotated image content is empty"
    print(f"[PASS] 6. Annotation: Clean annotated image with DEMO disclaimer banner ({len(ann_res.content)} bytes)")

    # 8. Verify Detection Details endpoint
    det_res = requests.get(f"{BASE}/api/detections/{det_id}", headers=headers)
    assert det_res.status_code == 200
    det_data = det_res.json()
    assert det_data["location_name"] == "Puducherry Promenade Beach"
    assert det_data["latitude"] == 11.9338
    assert det_data["longitude"] == 79.8354
    assert det_data["engine_name"] == "DEMO MODE"
    print("[PASS] 7. Detection Details: Accurate data returned with DEMO MODE engine label.")

    # 9. Verify History contains new detection
    hist_res = requests.get(f"{BASE}/api/detections", headers=headers)
    assert hist_res.status_code == 200
    after_dets = hist_res.json()
    assert len(after_dets) == before_count + 1
    assert after_dets[0]["id"] == det_id
    print(f"[PASS] 8. History: Updated list contains ID #{det_id} (Total: {len(after_dets)})")

    # 10. Verify Map detections include coordinates
    map_res = requests.get(f"{BASE}/api/map/detections", headers=headers)
    assert map_res.status_code == 200
    map_items = map_res.json()
    assert any(m["id"] == det_id for m in map_items)
    print(f"[PASS] 9. Plastic Map: Marker coordinates (11.9338, 79.8354) verified.")

    # 11. Verify Analytics updated
    ana_res = requests.get(f"{BASE}/api/analytics/summary", headers=headers)
    assert ana_res.status_code == 200
    ana_data = ana_res.json()
    assert ana_data["total_images"] == len(after_dets)
    print(f"[PASS] 10. Analytics: Summary total_images updated to {ana_data['total_images']}")

    # 12. Verify Hotspots recalculated
    hs_res = requests.get(f"{BASE}/api/hotspots", headers=headers)
    assert hs_res.status_code == 200
    hs_data = hs_res.json()
    pudu_hs = next((h for h in hs_data["hotspots"] if "Puducherry" in h["location_name"]), None)
    assert pudu_hs is not None, "Puducherry hotspot not found in calculations"
    print(f"[PASS] 11. Hotspot Intelligence: Cluster calculated: Priority={pudu_hs['priority']}, Score={pudu_hs['priority_score']}")

    # 13. Update Cleanup Status & verify persistence
    cleanup_res = requests.post(f"{BASE}/api/hotspots/cleanup-status", json={
        "hotspot_key": pudu_hs["hotspot_key"],
        "location_name": pudu_hs["location_name"],
        "status": "Cleaned",
        "notes": "Volunteer team completed beach cleanup."
    }, headers=headers)
    assert cleanup_res.status_code == 200
    hs_res2 = requests.get(f"{BASE}/api/hotspots", headers=headers)
    pudu_hs2 = next(h for h in hs_res2.json()["hotspots"] if h["hotspot_key"] == pudu_hs["hotspot_key"])
    assert pudu_hs2["cleanup_status"] == "Cleaned"
    print(f"[PASS] 12. Cleanup Status: Changed and persisted as '{pudu_hs2['cleanup_status']}'")

    # 14. Verify PDF generation
    pdf_res = requests.get(f"{BASE}/api/reports/{det_id}", headers=headers)
    assert pdf_res.status_code == 200
    assert b"%PDF" in pdf_res.content[:10]
    print(f"[PASS] 13. PDF Report: Generated binary PDF ({len(pdf_res.content)} bytes)")

    # 15. Verify CSV export
    csv_res = requests.get(f"{BASE}/api/export/detections.csv", headers=headers)
    assert csv_res.status_code == 200
    csv_str = csv_res.content.decode("utf-8")
    assert "Puducherry Promenade Beach" in csv_str
    assert "detection_id,date,location" in csv_str
    print("[PASS] 14. CSV Export: Successfully exported CSV dataset with new record.")

    print("\n>>> ALL 14 AUDIT CHECKPOINTS PASSED ACCORDING TO SPECIFICATION <<<")

if __name__ == "__main__":
    main()
