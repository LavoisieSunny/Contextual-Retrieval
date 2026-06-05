import sys
from pathlib import Path

# Dynamically append backend to python path for pytest execution
sys.path.append(str(Path(__file__).resolve().parent.parent.parent / "backend"))

from app.services.document.chunker import chunk_text

def test_chunk_text():
    text = "This is a sentence to validate that our chunker works as intended."
    chunks = chunk_text(text, chunk_size=20, chunk_overlap=5)
    assert len(chunks) > 0
    assert len(chunks[0]) <= 20
