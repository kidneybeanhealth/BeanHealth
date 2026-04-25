"""Backend tests for NephroTrack clinical app"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


@pytest.fixture(scope="module")
def auth_token():
    """Get JWT token for MR001"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"mr_id": "MR001", "password": "demo123"})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ── Auth Tests ────────────────────────────────────────────────────────────────

class TestAuth:
    def test_login_success(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"mr_id": "MR001", "password": "demo123"})
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["mr_id"] == "MR001"
        assert data["name"] == "Ramesh Kumar"

    def test_login_invalid(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"mr_id": "MR001", "password": "wrong"})
        assert resp.status_code == 401

    def test_me_endpoint(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["mr_id"] == "MR001"

    def test_register_new_patient(self):
        # Clean up first if exists
        resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "mr_id": "TEST_MR999",
            "name": "Test Patient",
            "father_name": "Test Father",
            "dob": "1990-01-01",
            "diagnosis": "CKD Stage 5",
            "password": "test123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["mr_id"] == "TEST_MR999"
        assert "token" in data

    def test_register_duplicate_mr_id(self):
        resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "mr_id": "MR001", "name": "Dup", "father_name": "Dup",
            "dob": "1990-01-01", "diagnosis": "CKD", "password": "abc123"
        })
        assert resp.status_code == 400


# ── Vitals Tests ──────────────────────────────────────────────────────────────

class TestVitals:
    def test_get_vitals(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/vitals", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_create_bp_vital(self, auth_headers):
        resp = requests.post(f"{BASE_URL}/api/vitals", headers=auth_headers, json={
            "vital_type": "bp", "systolic": 130, "diastolic": 82, "unit": "mmHg"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["systolic"] == 130
        assert data["diastolic"] == 82
        assert "id" in data
        return data["id"]

    def test_create_weight_vital(self, auth_headers):
        resp = requests.post(f"{BASE_URL}/api/vitals", headers=auth_headers, json={
            "vital_type": "weight", "value": 72.5, "unit": "kg"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["value"] == 72.5

    def test_update_vital(self, auth_headers):
        # Create first
        create = requests.post(f"{BASE_URL}/api/vitals", headers=auth_headers, json={
            "vital_type": "glucose", "value": 110.0, "unit": "mg/dL"
        })
        vital_id = create.json()["id"]
        # Update
        update = requests.put(f"{BASE_URL}/api/vitals/{vital_id}", headers=auth_headers, json={"value": 115.0})
        assert update.status_code == 200
        assert update.json()["value"] == 115.0
        # Verify persistence
        get = requests.get(f"{BASE_URL}/api/vitals", headers=auth_headers, params={"vital_type": "glucose"})
        ids = [v["id"] for v in get.json()]
        assert vital_id in ids

    def test_delete_vital(self, auth_headers):
        create = requests.post(f"{BASE_URL}/api/vitals", headers=auth_headers, json={
            "vital_type": "urine", "value": 1500.0, "unit": "mL/24h"
        })
        vital_id = create.json()["id"]
        delete = requests.delete(f"{BASE_URL}/api/vitals/{vital_id}", headers=auth_headers)
        assert delete.status_code == 200

    def test_get_today_vitals(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/vitals/today", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


# ── Prescriptions Tests ───────────────────────────────────────────────────────

class TestPrescriptions:
    def test_get_prescriptions(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/prescriptions", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 2
        # Check structure
        presc = data[0]
        assert "medications" in presc
        assert len(presc["medications"]) >= 4

    def test_get_medication_today(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/medication/today", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "prescription" in data
        assert "checklist" in data
        assert len(data["checklist"]) == 5  # 5 medications in latest prescription

    def test_medication_check(self, auth_headers):
        # Get today's checklist first
        today_resp = requests.get(f"{BASE_URL}/api/medication/today", headers=auth_headers)
        presc_id = today_resp.json()["prescription"]["id"]
        from datetime import date
        today = date.today().isoformat()
        resp = requests.post(f"{BASE_URL}/api/medication/check", headers=auth_headers, json={
            "prescription_id": presc_id,
            "medication_name": "Tacrolimus 1mg",
            "date": today,
            "taken": True,
        })
        assert resp.status_code == 200


# ── Profile Tests ─────────────────────────────────────────────────────────────

class TestProfile:
    def test_get_profile(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/profile", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["mr_id"] == "MR001"
        assert data["name"] == "Ramesh Kumar"
        assert data["father_name"] == "Suresh Kumar"
        assert "dob" in data
        assert "diagnosis" in data
