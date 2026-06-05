from qdrant_client import QdrantClient
from app.core.settings import settings
from app.core.logger import logger

_client = None

def get_qdrant_client() -> QdrantClient | None:
    """Lazy initialization pattern for the Qdrant client singleton."""
    global _client
    if _client is None:
        try:
            logger.info(f"Initializing QdrantClient connecting to {settings.QDRANT_HOST}:{settings.QDRANT_PORT}")
            _client = QdrantClient(
                host=settings.QDRANT_HOST,
                port=settings.QDRANT_PORT,
                api_key=settings.QDRANT_API_KEY,
                timeout=5.0
            )
        except Exception as e:
            logger.error(f"Failed to initialize QdrantClient: {e}")
            _client = None
    return _client

def check_qdrant_health() -> bool:
    """Verifies Qdrant service connection status."""
    client = get_qdrant_client()
    if client is None:
        return False
    try:
        client.get_collections()
        return True
    except Exception as e:
        logger.warning(f"Qdrant connection health check failed: {e}")
        return False
