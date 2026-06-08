import sys
from pathlib import Path
from unittest.mock import patch, MagicMock
import numpy as np
import pytest

from app.services.qdrant.vector_db import index_contextual_chunks

@patch("app.services.qdrant.vector_db.get_qdrant_client")
@patch("app.services.qdrant.vector_db.embed_both")
def test_index_contextual_chunks(mock_embed_both, mock_get_qdrant_client):
    # Setup mocks
    mock_client = MagicMock()
    mock_get_qdrant_client.return_value = mock_client
    
    # 2 chunks
    chunks = [
        {
            "chunk_id": "chunk_1",
            "combined_text": "combined text 1",
            "content": "content 1",
            "context": "context 1",
            "metadata": {"page": 1}
        },
        {
            "chunk_id": "chunk_2",
            "combined_text": "combined text 2",
            "content": "content 2",
            "context": "context 2",
            "metadata": {"page": 2}
        }
    ]
    
    # Mock embed_both return values: (dense_vecs, sparse_vecs)
    # dense_vecs: list of list of float
    # sparse_vecs: list of dict of {token_id: weight}
    dense_vecs = [[0.1, 0.2], [0.3, 0.4]]
    sparse_vecs = [{"101": 0.5, "102": 0.6}, {"201": 0.7, "202": 0.8}]
    mock_embed_both.return_value = (dense_vecs, sparse_vecs)
    
    # Run target function
    result = index_contextual_chunks("doc_123", chunks)
    
    # Assert result and client calls
    assert result is True
    mock_get_qdrant_client.assert_called_once()
    mock_embed_both.assert_called_once_with(["combined text 1", "combined text 2"])
    
    mock_client.upsert.assert_called_once()
    upsert_kwargs = mock_client.upsert.call_args[1]
    assert "collection_name" in upsert_kwargs
    assert "points" in upsert_kwargs
    
    points = upsert_kwargs["points"]
    assert len(points) == 2
    
    # Verify first point
    p1 = points[0]
    assert p1.vector["dense"] == [0.1, 0.2]
    assert p1.vector["sparse"].indices == [101, 102]
    assert p1.vector["sparse"].values == [0.5, 0.6]
    assert p1.payload["document_id"] == "doc_123"
    assert p1.payload["chunk_id"] == "chunk_1"
    assert p1.payload["content"] == "content 1"
    assert p1.payload["context"] == "context 1"
    assert p1.payload["combined_text"] == "combined text 1"
    assert p1.payload["page"] == 1
    
    # Verify second point
    p2 = points[1]
    assert p2.vector["dense"] == [0.3, 0.4]
    assert p2.vector["sparse"].indices == [201, 202]
    assert p2.vector["sparse"].values == [0.7, 0.8]
    assert p2.payload["document_id"] == "doc_123"
    assert p2.payload["chunk_id"] == "chunk_2"
    assert p2.payload["content"] == "content 2"
    assert p2.payload["context"] == "context 2"
    assert p2.payload["combined_text"] == "combined text 2"
    assert p2.payload["page"] == 2

@patch("app.services.qdrant.vector_db.get_qdrant_client")
def test_index_contextual_chunks_no_client(mock_get_qdrant_client):
    mock_get_qdrant_client.return_value = None
    result = index_contextual_chunks("doc_123", [])
    assert result is False
