# backend/app/services/contextual_rag/ingestion_pipeline.py
import json
import logging
import re
from pathlib import Path
from typing import List, Dict, Any, Optional

from app.core.settings import settings
from app.services.contextual_rag.context_generator import ContextGenerator
from app.services.contextual_rag.contextual_chunker import ContextualChunker

logger = logging.getLogger("ContextualIngestionPipeline")

class ContextualIngestionPipeline:
    def __init__(self):
        self.context_generator = ContextGenerator()
        self.chunker = ContextualChunker()
        self.storage_dir = settings.storage_path / "contextual_chunks"
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def _clean_text(self, text: str) -> str:
        """Cleans excessive whitespace and newlines but preserves PAGE markers."""
        if not text:
            return ""
        # Normalize carriage returns
        cleaned = re.sub(r'\r\n', '\n', text)
        # Normalize excessive empty lines to double newlines
        cleaned = re.sub(r'\n\s*\n', '\n\n', cleaned)
        return cleaned.strip()

    async def _generate_context_with_sem(self, sem, current_chunk, prev_chunk, next_chunk, doc_summary):
        import asyncio
        async with sem:
            return await asyncio.to_thread(
                self.context_generator.generate_context,
                current_chunk,
                prev_chunk,
                next_chunk,
                doc_summary
            )

    async def _generate_all_contexts(self, chunks: List[str], doc_summary: str) -> List[str]:
        import asyncio
        sem = asyncio.Semaphore(4)
        tasks = []
        for i, current_chunk in enumerate(chunks):
            prev_chunk = chunks[i - 1] if i > 0 else ""
            next_chunk = chunks[i + 1] if i < len(chunks) - 1 else ""
            
            tasks.append(
                self._generate_context_with_sem(
                    sem,
                    current_chunk,
                    prev_chunk,
                    next_chunk,
                    doc_summary
                )
            )
        return await asyncio.gather(*tasks)

    def process_document(
        self, 
        document_id: str, 
        raw_text: str, 
        chunks: Optional[List[str]] = None,
        suggestions: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Processes a document end-to-end:
        1. Cleans raw_text.
        2. Takes raw_text and chunks it if chunks are not pre-provided.
        3. Generates context for each chunk concurrently.
        4. Creates structured contextual chunks.
        5. Saves each contextual chunk as JSON and returns the list of chunks.
        """
        logger.info(f"Processing document {document_id} through contextual RAG ingestion...")
        
        cleaned_text = self._clean_text(raw_text)
        
        # Step 1 — Generate document summary ONCE (cheap, reused)
        doc_summary = self.context_generator.generate_document_summary(cleaned_text)
        logger.info(f"Document summary: {doc_summary}")
        
        # Step 2 — Chunking text if not provided
        if not chunks:
            logger.info("No pre-generated chunks provided. Chunking raw text...")
            chunks = self.chunker.split_text(cleaned_text)
        
        if not chunks:
            logger.warning(f"No chunks found for document {document_id}")
            return []
 
        logger.info(f"Generating contexts for {len(chunks)} chunks concurrently...")
        
        # Parallel generation of contexts using asyncio loop
        import asyncio
        try:
            contexts = asyncio.run(self._generate_all_contexts(chunks, doc_summary))
        except RuntimeError:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                from concurrent.futures import ThreadPoolExecutor
                with ThreadPoolExecutor() as executor:
                    future = executor.submit(lambda: asyncio.run(self._generate_all_contexts(chunks, doc_summary)))
                    contexts = future.result()
            else:
                contexts = loop.run_until_complete(self._generate_all_contexts(chunks, doc_summary))

        contextual_chunks = []
        last_found_idx = 0
 
        # Step 3 — Build contextual chunk records
        for i, current_chunk in enumerate(chunks):
            context = contexts[i]
 
            # Map chunk to page number from cleaned_text
            page_num = self._find_page_number(cleaned_text, current_chunk, last_found_idx)
            
            # Update last index for efficiency in next search
            pos = cleaned_text.find(current_chunk, last_found_idx)
            if pos != -1:
                last_found_idx = pos + len(current_chunk)
 
            # Create contextual chunk payload
            chunk_data = self.chunker.create_contextual_chunk(
                content=current_chunk,
                context=context
            )
            
            # Build structured record
            chunk_record = {
                "chunk_id": i + 1,
                "context": chunk_data["context"],
                "content": chunk_data["content"],
                "combined_text": chunk_data["combined_text"],
                "metadata": {
                    "page": page_num
                }
            }
            contextual_chunks.append(chunk_record)
 
        # 3. Store the contextual chunks in the storage directory
        self._store_chunks(document_id, contextual_chunks)
 
        # Index the contextual chunks in Qdrant with dense + sparse vectors
        from app.services.qdrant.vector_db import index_contextual_chunks
        index_contextual_chunks(document_id, contextual_chunks, suggestions)
 
        logger.info(f"Successfully processed and stored {len(contextual_chunks)} chunks for document {document_id}")
        return contextual_chunks

    def _find_page_number(self, full_text: str, chunk_content: str, last_index: int) -> int:
        """
        Deterministically finds the page number of a chunk by looking for standard '--- PAGE X ---'
        markers in the text preceding or inside the chunk.
        """
        # Clean whitespaces for robust matching
        pos = full_text.find(chunk_content, last_index)
        if pos == -1:
            pos = full_text.find(chunk_content)
        
        if pos == -1:
            # Fallback to scanning the chunk itself for page indicators
            match = re.search(r"--- PAGE (\d+) ---", chunk_content)
            if match:
                return int(match.group(1))
            return 1

        preceding_text = full_text[:pos]
        page_markers = list(re.finditer(r"--- PAGE (\d+) ---", preceding_text))
        if page_markers:
            return int(page_markers[-1].group(1))

        # Check chunk text itself if no preceding marker
        match = re.search(r"--- PAGE (\d+) ---", chunk_content)
        if match:
            return int(match.group(1))

        return 1

    def _store_chunks(self, document_id: str, contextual_chunks: List[Dict[str, Any]]) -> None:
        """Saves generated contextual chunks to backend/app/storage/contextual_chunks/."""
        # Folder for this specific document
        doc_storage_dir = self.storage_dir / document_id
        doc_storage_dir.mkdir(parents=True, exist_ok=True)

        # Store individual chunk JSONs
        for chunk in contextual_chunks:
            chunk_file = doc_storage_dir / f"chunk_{chunk['chunk_id']}.json"
            # Format required: {"chunk_id": X, "page": Y, "context": "...", "content": "...", "combined_text": "..."}
            output_format = {
                "chunk_id": chunk["chunk_id"],
                "page": chunk["metadata"]["page"],
                "context": chunk["context"],
                "content": chunk["content"],
                "combined_text": chunk["combined_text"]
            }
            try:
                with open(chunk_file, "w", encoding="utf-8") as f:
                    json.dump(output_format, f, indent=2, ensure_ascii=False)
            except Exception as e:
                logger.error(f"Failed to save chunk file {chunk_file}: {e}")

        # Also store a consolidated list for quick retrieval
        consolidated_file = self.storage_dir / f"{document_id}.json"
        try:
            with open(consolidated_file, "w", encoding="utf-8") as f:
                json.dump(contextual_chunks, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Failed to save consolidated document chunks {consolidated_file}: {e}")
