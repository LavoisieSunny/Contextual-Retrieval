from qdrant_client import QdrantClient
from app.core.settings import settings
from app.core.logger import logger

_client = None

def get_qdrant_client() -> QdrantClient | None:
    """Lazy initialization — retries every call if previous attempt failed."""
    global _client
    if _client is not None:
        return _client
    try:
        logger.info(f"Initializing QdrantClient at {settings.QDRANT_HOST}:{settings.QDRANT_PORT}")
        client = QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT,
            api_key=settings.QDRANT_API_KEY,
            timeout=5.0
        )
        # Verify connection is actually alive before caching
        client.get_collections()
        _client = client
        logger.info("QdrantClient connected successfully.")
    except Exception as e:
        logger.error(f"Failed to connect to Qdrant at {settings.QDRANT_HOST}:{settings.QDRANT_PORT} — {e}")
        # Fall back to local file-based storage
        try:
            local_db_path = str(settings.storage_path / "qdrant_local")
            logger.info(f"Falling back to local file-based Qdrant client at: {local_db_path}")
            client = QdrantClient(path=local_db_path)
            client.get_collections()
            _client = client
            logger.info("Local file-based QdrantClient connected successfully.")
        except Exception as local_err:
            logger.critical(f"Failed to initialize local fallback Qdrant client: {local_err}")
            _client = None
    return _client


def reset_qdrant_client():
    """Force a reconnection attempt on next call. Useful after Qdrant restarts."""
    global _client
    _client = None


def check_qdrant_health() -> bool:
    """Verifies Qdrant service connection status."""
    try:
        client = get_qdrant_client()
        if client is None:
            return False
        client.get_collections()
        return True
    except Exception as e:
        logger.warning(f"Qdrant health check failed: {e}")
        # Reset so next health check retries the connection
        reset_qdrant_client()
        return False

