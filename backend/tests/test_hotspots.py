import pytest
from fastapi.testclient import TestClient
from main import app
from models.database import init_db

init_db()
client = TestClient(app)

def test_hotspot_intelligence():
    # Login to get valid token
    login_res = client.post("/api/auth/login", json={
        "email": "scientist_test@ocean.org",
        "password": "SecurePassword123"
    })
    if login_res.status_code != 200:
        # Register first if needed
        client.post("/api/auth/register", json={
            "name": "Test Marine Scientist",
            "email": "scientist_test@ocean.org",
            "password": "SecurePassword123",
            "confirm_password": "SecurePassword123"
        })
        login_res = client.post("/api/auth/login", json={
            "email": "scientist_test@ocean.org",
            "password": "SecurePassword123"
        })

    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Fetch hotspots
    res = client.get("/api/hotspots", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "hotspots" in data
    assert "summary" in data
    assert "scoring_methodology" in data
    assert "disclaimer" in data
    assert "all_demo" in data["summary"]
    assert "demo_records_count" in data["summary"]

    hotspots = data["hotspots"]
    assert len(hotspots) > 0

    first = hotspots[0]
    assert "location_name" in first
    assert "priority_score" in first
    assert "priority_level" in first
    assert first["priority_level"] in ["HIGH", "MEDIUM", "LOW"]
    assert "explanation" in first
    assert "trend" in first
    assert "cleanup_status" in first
    assert "observations" in first

    # 2. Update cleanup status
    loc_name = first["location_name"]
    update_res = client.post(
        "/api/hotspots/cleanup-status",
        headers=headers,
        json={
            "hotspot_key": first["hotspot_key"],
            "location_name": loc_name,
            "status": "Inspection",
            "notes": "Field inspection dispatched."
        }
    )
    assert update_res.status_code == 200
    update_data = update_res.json()
    assert update_data["status"] == "Inspection"
    assert len(update_data["history"]) >= 1

    # 3. Verify status persisted in GET
    res2 = client.get("/api/hotspots", headers=headers)
    assert res2.status_code == 200
    updated_first = next(h for h in res2.json()["hotspots"] if h["location_name"] == loc_name)
    assert updated_first["cleanup_status"] == "Inspection"
    assert len(updated_first["cleanup_history"]) >= 1
