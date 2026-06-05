from app.services.qdrant.client import get_qdrant_client
from app.core.logger import logger

def list_collections():
    """Lists all active Qdrant collections."""
    client = get_qdrant_client()
    if client is None:
        logger.warning("Qdrant client not initialized. Cannot list collections.")
        return []
    try:
        collections = client.get_collections()
        return [c.name for c in collections.collections]
    except Exception as e:
        logger.error(f"Failed to list Qdrant collections: {e}")
        return []

def create_collection_if_not_exists(collection_name: str, vector_size: int = 1024):
    """Creates a vector collection in Qdrant if it does not already exist."""
    client = get_qdrant_client()
    if client is None:
        logger.warning("Qdrant client not initialized. Cannot create collection.")
        return False
    try:
        existing = list_collections()
        if collection_name not in existing:
            from qdrant_client.http import models
            client.create_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(
                    size=vector_size,  # BGE-M3 defaults to 1024 dimensions
                    distance=models.Distance.COSINE
                )
            )
            logger.info(f"Created Qdrant collection: {collection_name}")
            return True
        return True
    except Exception as e:
        logger.error(f"Failed to create Qdrant collection {collection_name}: {e}")
        return False
