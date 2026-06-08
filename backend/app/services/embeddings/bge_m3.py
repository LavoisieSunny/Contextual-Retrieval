# backend/app/services/embeddings/bge_m3.py

import logging
import torch
from FlagEmbedding import BGEM3FlagModel

logger = logging.getLogger("BGEM3")

_model = None

def get_bge_m3():
    """Lazy singleton — loads once, reused everywhere."""
    global _model
    if _model is None:
        logger.info("Loading BGE-M3 model (first time, takes ~30s)...")
        use_gpu = torch.cuda.is_available()
        logger.info(f"CUDA available: {use_gpu}. Loading model with use_fp16={use_gpu}")
        _model = BGEM3FlagModel(
            'BAAI/bge-m3',
            use_fp16=use_gpu
        )
        logger.info("BGE-M3 ready.")
    return _model


def embed_dense(texts: list[str]) -> list[list[float]]:
    """Returns dense vectors for a list of texts."""
    model = get_bge_m3()
    output = model.encode(
        texts,
        batch_size=4,
        max_length=512,
        return_dense=True,
        return_sparse=False,
        return_colbert_vecs=False
    )
    return output['dense_vecs'].tolist()


def embed_sparse(texts: list[str]) -> list[dict]:
    """Returns sparse (lexical weight) vectors for a list of texts."""
    model = get_bge_m3()
    output = model.encode(
        texts,
        batch_size=4,
        max_length=512,
        return_dense=False,
        return_sparse=True,
        return_colbert_vecs=False
    )
    # Convert to {token_id: weight} dict format Qdrant expects
    return output['lexical_weights']


def embed_both(texts: list[str]) -> tuple[list, list]:
    """Returns (dense_vecs, sparse_vecs) in one model call — more efficient."""
    model = get_bge_m3()
    output = model.encode(
        texts,
        batch_size=4,
        max_length=512,
        return_dense=True,
        return_sparse=True,
        return_colbert_vecs=False
    )
    return output['dense_vecs'].tolist(), output['lexical_weights']
