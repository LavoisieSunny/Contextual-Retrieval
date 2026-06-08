# backend/app/services/contextual_rag/reranker.py
import logging
from typing import List, Dict, Any
from app.services.embeddings.bge_m3 import get_bge_m3

logger = logging.getLogger("Reranker")

class BGEReranker:
    def __init__(self):
        # Lazy loading via get_bge_m3()
        pass

    def rerank(self, query: str, chunks: List[Dict[str, Any]], top_n: int = 5) -> List[Dict[str, Any]]:
        """
        Reranks a list of retrieved chunks against a query using BGE-M3's ColBERT score.
        Each chunk is a dictionary containing at least 'text' or 'combined_text'.
        """
        if not chunks:
            return []
            
        logger.info(f"Reranking {len(chunks)} chunks using BGE-M3 ColBERT scoring...")
        try:
            model = get_bge_m3()
            
            # Prepare pairs of (query, chunk_content)
            # Use 'combined_text' if present (contains context + content), otherwise fallback to 'text'
            sentence_pairs = []
            for chunk in chunks:
                passage = chunk.get("combined_text") or chunk.get("text") or ""
                sentence_pairs.append((query, passage))
                
            # Compute scores
            scores_dict = model.compute_score(
                sentence_pairs,
                max_query_length=512,
                max_passage_length=1024
            )
            
            # Extract colbert scores
            colbert_scores = scores_dict.get("colbert", [0.0] * len(chunks))
            
            # Attach scores to chunks
            scored_chunks = []
            for idx, chunk in enumerate(chunks):
                chunk_copy = dict(chunk)
                chunk_copy["rerank_score"] = float(colbert_scores[idx])
                scored_chunks.append(chunk_copy)
                
            # Sort descending by rerank score
            scored_chunks.sort(key=lambda x: x["rerank_score"], reverse=True)
            
            final_chunks = scored_chunks[:top_n]
            logger.info(f"Reranking complete. Top score: {final_chunks[0]['rerank_score'] if final_chunks else 'N/A'}")
            return final_chunks
            
        except Exception as e:
            logger.error(f"Error during reranking: {e}. Returning original order.")
            return chunks[:top_n]
