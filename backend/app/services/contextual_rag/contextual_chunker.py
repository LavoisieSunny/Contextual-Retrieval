# backend/app/services/contextual_rag/contextual_chunker.py
from typing import List
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.core.settings import settings

class ContextualChunker:
    def __init__(self, chunk_size: int = None, chunk_overlap: int = None):
        self.chunk_size = chunk_size or settings.CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len
        )

    def split_text(self, text: str) -> List[str]:
        """Splits raw text into character chunks using RecursiveCharacterTextSplitter."""
        if not text:
            return []
        return self.splitter.split_text(text)

    @staticmethod
    def create_contextual_chunk(content: str, context: str) -> dict:
        """
        Creates a structured contextual chunk object with:
        - context: the generated context situating the chunk
        - content: the raw text content of the chunk
        - combined_text: the formatted combination of context and content
        """
        combined_text = f"[Document Context] {context.strip()}\n\n[Content] {content.strip()}"
        return {
            "context": context.strip(),
            "content": content.strip(),
            "combined_text": combined_text
        }
