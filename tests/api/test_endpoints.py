import sys
from pathlib import Path

# Dynamically append backend to python path for pytest execution
sys.path.append(str(Path(__file__).resolve().parent.parent.parent / "backend"))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "documentation" in response.json()

def test_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["api"] == "healthy"
    assert "qdrant" in data
    assert "storage" in data

def test_chatbot_endpoint():
    payload = {
        "message": "Hello validation query",
        "history": []
    }
    response = client.post("/api/v1/chatbot", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert len(data["citations"]) > 0
