from typing import List
from app.core.logger import logger

def chunk_text(text: str, chunk_size: int = 500, chunk_overlap: int = 50) -> List[str]:
    """Chunks text into sliding character segments.
    Placeholder for the future semantic chunker.
    """
    logger.info(f"Segmenting text (length {len(text)}) into chunks of size {chunk_size}")
    if not text:
        return []
        
    chunks = []
    start = 0
    text_len = len(text)
    
    while start < text_len:
        end = min(start + chunk_size, text_len)
        chunks.append(text[start:end])
        if end == text_len:
            break
        start += (chunk_size - chunk_overlap)
        
    return chunks
