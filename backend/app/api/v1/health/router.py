from fastapi import APIRouter
from app.schemas.health import HealthResponse
from app.services.qdrant.client import check_qdrant_health
from app.core.settings import settings

router = APIRouter()

@router.get("", response_model=HealthResponse)
def get_health():
    """Runs connectivity checks on the API, Qdrant client, and local disk storage."""
    # Check storage health by attempting to write/delete a mock file
    storage_healthy = "healthy"
    try:
        storage_path = settings.storage_path
        storage_path.mkdir(parents=True, exist_ok=True)
        temp_file = storage_path / ".healthcheck"
        temp_file.write_text("healthcheck")
        temp_file.unlink()
    except Exception:
        storage_healthy = "unhealthy"
        
    # Check Qdrant health via the lazy connection utility
    qdrant_healthy = "healthy" if check_qdrant_health() else "unhealthy"
    
    return HealthResponse(
        api="healthy",
        qdrant=qdrant_healthy,
        storage=storage_healthy
    )
