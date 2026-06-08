# backend/app/services/contextual_rag/contextual_chunker.py

import logging
from typing import List
from app.core.settings import settings

logger = logging.getLogger("ContextualChunker")


class ContextualChunker:
    def __init__(self, chunk_size: int = None, chunk_overlap: int = None):
        self.chunk_size = chunk_size or settings.CHUNK_SIZE       # keep as fallback
        self.chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP
        self._splitter = None                        # lazy init

    def _get_splitter(self):
        """Lazy-load SemanticChunker with BGE-M3 embeddings."""
        if self._splitter is None:
            try:
                from langchain_experimental.text_splitter import SemanticChunker
                from langchain_community.embeddings import HuggingFaceBgeEmbeddings

                logger.info("Initializing SemanticChunker with BGE-M3...")
                embeddings = HuggingFaceBgeEmbeddings(
                    model_name="BAAI/bge-m3",
                    model_kwargs={"device": "cpu"},
                    encode_kwargs={"normalize_embeddings": True}
                )
                self._splitter = SemanticChunker(
                    embeddings=embeddings,
                    breakpoint_threshold_type="percentile",  
                    breakpoint_threshold_amount=85           
                )
                logger.info("SemanticChunker ready.")
            except Exception as e:
                # Fallback to RecursiveCharacterTextSplitter if SemanticChunker fails
                logger.warning(f"SemanticChunker init failed: {e}. Falling back to RecursiveCharacterTextSplitter.")
                from langchain_text_splitters import RecursiveCharacterTextSplitter
                self._splitter = RecursiveCharacterTextSplitter(
                    chunk_size=self.chunk_size,
                    chunk_overlap=self.chunk_overlap
                )
        return self._splitter

    def split_text(self, text: str) -> List[str]:
        if not text:
            return []
        try:
            splitter = self._get_splitter()
            return splitter.split_text(text)
        except Exception as e:
            logger.error(f"Chunking failed: {e}")
            return []

    @staticmethod
    def create_contextual_chunk(content: str, context: str) -> dict:
        combined_text = f"[Document Context] {context.strip()}\n\n[Content] {content.strip()}"
        return {
            "context": context.strip(),
            "content": content.strip(),
            "combined_text": combined_text
        }
