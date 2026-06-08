# backend/app/services/qdrant/collections.py

from qdrant_client import QdrantClient
from qdrant_client.models import (
    VectorParams, Distance,
    SparseVectorParams, SparseIndexParams,
    HnswConfigDiff, QuantizationConfig,
    ScalarQuantizationConfig, ScalarType
)
import logging

logger = logging.getLogger("QdrantCollections")

COLLECTION_NAME = "legal_documents_v2"   # new name to avoid conflicts with old collection

def create_dual_vector_collection(client: QdrantClient):
    """
    Creates a Qdrant collection that stores:
    - dense vectors (BGE-M3, 1024-dim, HNSW + int8 quantization)
    - sparse vectors (BGE-M3 lexical weights)
    """
    try:
        client.get_collection(COLLECTION_NAME)
        logger.info(f"Collection '{COLLECTION_NAME}' already exists.")
        return
    except Exception:
        pass  # doesn't exist yet, create it

    logger.info(f"Creating dual-vector collection '{COLLECTION_NAME}'...")

    client.create_collection(
        collection_name=COLLECTION_NAME,

        # Dense vectors
        vectors_config={
            "dense": VectorParams(
                size=1024,              # BGE-M3 dense dimension
                distance=Distance.COSINE,
                hnsw_config=HnswConfigDiff(
                    m=16,               # HNSW graph connections
                    ef_construct=100    # build quality vs speed
                ),
                quantization_config=QuantizationConfig(
                    scalar=ScalarQuantizationConfig(
                        type=ScalarType.INT8,
                        quantile=0.99,
                        always_ram=True
                    )
                )
            )
        },

        # Sparse vectors
        sparse_vectors_config={
            "sparse": SparseVectorParams(
                index=SparseIndexParams(on_disk=False)
            )
        }
    )

    logger.info(f"Collection '{COLLECTION_NAME}' created with dense + sparse vectors.")
