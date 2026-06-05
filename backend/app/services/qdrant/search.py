from app.services.qdrant.client import get_qdrant_client
from app.core.logger import logger
from typing import List, Dict, Any

def search_vectors(collection_name: str, query_vector: List[float], limit: int = 5) -> List[Dict[str, Any]]:
    """Performs a standard vector search against a Qdrant collection."""
    client = get_qdrant_client()
    if client is None:
        logger.warning("Qdrant client not initialized. Cannot search vectors.")
        return []
    try:
        results = client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=limit
        )
        return [
            {
                "id": r.id,
                "score": r.score,
                "payload": r.payload
            }
            for r in results
        ]
    except Exception as e:
        logger.error(f"Error during vector search in collection {collection_name}: {e}")
        return []
