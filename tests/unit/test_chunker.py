import sys
from pathlib import Path
from unittest.mock import patch, MagicMock
import numpy as np

# Dynamically append backend to python path for pytest execution
sys.path.append(str(Path(__file__).resolve().parent.parent.parent / "backend"))

from app.services.document.chunker import chunk_text

@patch("app.services.document.chunker.get_bge_m3")
def test_chunk_text(mock_get_bge_m3):
    # Setup mock BGE-M3 model
    mock_model = MagicMock()
    mock_model.encode.side_effect = lambda sentences, **kwargs: {
        'dense_vecs': [np.random.rand(1024) for _ in sentences]
    }
    mock_get_bge_m3.return_value = mock_model

    text = "This is a sentence to validate that our chunker works as intended."
    chunks = chunk_text(text, chunk_size=20, chunk_overlap=5)
    assert len(chunks) > 0
    assert len(chunks[0]) <= 20
