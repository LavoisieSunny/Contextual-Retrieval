import os
import logging
import hashlib
import uuid
import time
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, SparseVector

from app.services.qdrant.client import get_qdrant_client as get_base_client
from app.core.settings import settings
from app.services.embeddings.bge_m3 import get_bge_m3, embed_dense, embed_both
from app.services.qdrant.collections import COLLECTION_NAME, create_dual_vector_collection

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VectorDB")

# Global lazy-initialized clients to prevent loading models during module imports
_qdrant_client = None
VECTOR_DB_INITIALIZED = False

def get_qdrant_client():
    global _qdrant_client, VECTOR_DB_INITIALIZED
    if _qdrant_client is None:
        try:
            logger.info(f"Initializing central Qdrant client via settings singleton...")
            _qdrant_client = get_base_client()
            if _qdrant_client is None:
                raise ValueError("Central get_qdrant_client returned None")
            
            # Create dual vector collection
            create_dual_vector_collection(_qdrant_client)
            
            VECTOR_DB_INITIALIZED = True
        except Exception as e:
            logger.error(f"Failed to initialize Qdrant client collection: {str(e)}")
            _qdrant_client = None
            VECTOR_DB_INITIALIZED = False
    return _qdrant_client

def get_bge_embedding(text: str) -> list:
    """
    Generates a 1024-dimension vector embedding locally
    using the 'BGE-M3' model via FlagEmbedding.
    """
    try:
        return embed_dense([text])[0]
    except Exception as e:
        logger.error(f"Failed to generate BGE-M3 embedding: {str(e)}")
        return None

def get_embedding_model():
    """Backwards compatibility helper."""
    return True

# ======================================================
# CHUNKING & INDEXING PIPELINE
# ======================================================

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list:
    """
    Intelligently chunks legal document text for optimal semantic retrieval.
    Guarantees that chunks:
    1. Do not slice raw characters or cut words in half.
    2. Prefer splitting on paragraph (\n\n) or sentence (. ! ?) boundaries.
    3. Keep complete legal facts and context intact.
    """
    import re
    # Normalize newlines
    text = text.replace("\r\n", "\n")
    
    # Split into paragraphs
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    
    # If there are no double newlines, fallback to single newlines
    if len(paragraphs) <= 1:
        paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
        
    chunks = []
    current_chunk = []
    current_length = 0
    
    for p in paragraphs:
        # If a single paragraph is larger than chunk_size, split it into sentences
        if len(p) > chunk_size:
            # Simple sentence splitting regex
            sentences = re.split(r'(?<=[.!?])\s+', p)
            for s in sentences:
                s = s.strip()
                if not s:
                    continue
                if current_length + len(s) <= chunk_size:
                    current_chunk.append(s)
                    current_length += len(s) + 1 # +1 for space
                else:
                    if current_chunk:
                        chunks.append(" ".join(current_chunk))
                    current_chunk = [s]
                    current_length = len(s)
        else:
            if current_length + len(p) <= chunk_size:
                current_chunk.append(p)
                current_length += len(p) + 2 # +2 for \n\n
            else:
                if current_chunk:
                    chunks.append("\n\n".join(current_chunk) if "\n\n" in text else "\n".join(current_chunk))
                current_chunk = [p]
                current_length = len(p)
                
    if current_chunk:
        chunks.append("\n\n".join(current_chunk) if "\n\n" in text else "\n".join(current_chunk))
        
    # If chunks are still empty or somehow sparse, fallback to a safe word-boundary window
    if not chunks:
        words = text.split()
        current_words = []
        current_len = 0
        for w in words:
            if current_len + len(w) <= chunk_size:
                current_words.append(w)
                current_len += len(w) + 1
            else:
                if current_words:
                    chunks.append(" ".join(current_words))
                # Add overlap of ~20 words if possible
                overlap_words = current_words[-20:] if len(current_words) > 20 else []
                current_words = overlap_words + [w]
                current_len = sum(len(x) + 1 for x in current_words)
        if current_words:
            chunks.append(" ".join(current_words))
            
    return chunks

def extract_paragraphs_with_page_info(text_lines: list) -> list:
    """
    Groups OCR lines into paragraph blocks and tracks their starting page numbers.
    Returns list of dict: [{"page": int, "text": str}]
    """
    import re
    from app.services.document.parser_heuristics import clean_noisy_text
    
    current_page = 1
    page_paragraphs = []
    
    cleaned_items = []
    
    boilerplate_patterns = [
        r'^\s*presented\s+on\s*[:\-]',
        r'^\s*presented\s+by\s*[:\-]',
        r'^\s*registry\s+notice',
        r'^\s*in\s+the\s+court\s+of\b',
        r'^\s*adjudication\s+sheet\b',
        r'^\s*advocates?\s+for\b',
        r'^\s*date\s+of\s+stamping\b',
        r'^\s*stamps?\b',
        r'^\s*office\s+use\s+only\b',
        r'^\s*certified\s+copy\b',
        r'^\s*read\s+by\s*:',
        r'^\s*compared\s+by\s*:',
        r'^\s*typed\s+by\s*:'
    ]
    
    for line in text_lines:
        # Detect page separator
        page_match = re.match(r'^---\s*PAGE\s+(\d+)\s*---', line, re.IGNORECASE)
        if page_match:
            current_page = int(page_match.group(1))
            continue
            
        cleaned = clean_noisy_text(line)
        if not cleaned:
            continue
            
        # Ignore obvious procedural boilerplate lines
        if any(re.search(pat, cleaned.lower()) for pat in boilerplate_patterns):
            continue
            
        cleaned_items.append({"page": current_page, "text": cleaned})
        
    # Paragraph reconstruction while retaining page info
    merged_blocks = []
    current_block = []
    block_start_page = 1
    
    for item in cleaned_items:
        line = item["text"]
        p_num = item["page"]
        
        if not current_block:
            current_block = [line]
            block_start_page = p_num
            continue
            
        # Continuation heuristic
        last_line = current_block[-1]
        ends_with_terminal = last_line[-1] in ['.', '?', '!', ':']
        starts_with_heading = line.isupper() and len(line) > 5
        starts_with_bullet = bool(re.match(r'^\s*(?:\d+|[a-zA-Z])[\.\)\-\]]', line))
        
        if not ends_with_terminal and not starts_with_heading and not starts_with_bullet:
            if last_line.endswith('-'):
                current_block[-1] = last_line[:-1] + line
            else:
                current_block.append(line)
        else:
            merged_blocks.append({
                "page": block_start_page,
                "text": "\n".join(current_block) if "\n" in "\n".join(current_block) else " ".join(current_block)
            })
            current_block = [line]
            block_start_page = p_num
            
    if current_block:
        merged_blocks.append({
            "page": block_start_page,
            "text": "\n".join(current_block) if "\n" in "\n".join(current_block) else " ".join(current_block)
        })
        
    return merged_blocks

def chunk_paragraphs_with_page_info(page_paragraphs: list, chunk_size: int = 1000, overlap: int = 200) -> list:
    """
    Intelligently chunks paragraphs into 1000-char blocks while retaining starting page numbers.
    Returns list of dict: [{"page": int, "text": str}]
    """
    chunks_with_page = []
    
    current_chunk_text = []
    current_chunk_len = 0
    current_chunk_page = None
    
    for item in page_paragraphs:
        para_text = item["text"]
        para_page = item["page"]
        
        if current_chunk_page is None:
            current_chunk_page = para_page
            
        if current_chunk_len + len(para_text) <= chunk_size:
            current_chunk_text.append(para_text)
            current_chunk_len += len(para_text) + 2 # +2 for newline
        else:
            if current_chunk_text:
                chunks_with_page.append({
                    "page": current_chunk_page,
                    "text": "\n\n".join(current_chunk_text)
                })
            # Start new chunk with current paragraph
            current_chunk_text = [para_text]
            current_chunk_len = len(para_text)
            current_chunk_page = para_page
            
    if current_chunk_text:
        chunks_with_page.append({
            "page": current_chunk_page,
            "text": "\n\n".join(current_chunk_text)
        })
        
    return chunks_with_page

def index_document(filename: str, text_lines: list, suggestions: dict) -> bool:
    """
    Chunks document text, generates vector embeddings using Ollama nomic-embed-text, 
    and inserts them into Qdrant collection with rich metadata.
    Prevents duplicate uploads by matching file hashes.
    """
    client = get_qdrant_client()
    
    if client is None:
        logger.warning("Vector DB is offline. Skipping indexing.")
        return False
        
    # Calculate file MD5 hash of raw OCR text for duplicate protection
    full_raw_text = "\n".join(text_lines)
    file_hash = hashlib.md5(full_raw_text.encode("utf-8")).hexdigest()
    
    # Check for duplicate indexing
    try:
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        scroll_res, _ = client.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=Filter(must=[
                FieldCondition(key="file_hash", match=MatchValue(value=file_hash))
            ]),
            limit=1
        )
        if scroll_res:
            logger.info(f"Duplicate Upload Protection: Document '{filename}' with hash '{file_hash}' is already indexed. Skipping indexing.")
            return True
    except Exception as e:
        logger.warning(f"Error checking duplicate indexing in Qdrant: {str(e)}")

    # Pre-merge OCR text lines into clean coherent paragraphs while tracking page numbers
    page_paragraphs = extract_paragraphs_with_page_info(text_lines)
    chunks_with_page = chunk_paragraphs_with_page_info(page_paragraphs, chunk_size=1000, overlap=200)
    
    if not chunks_with_page:
        logger.warning(f"No text extracted to index for {filename}")
        return False

    try:
        logger.info(f"Generating BGE-M3 embeddings for {len(chunks_with_page)} chunks of: {filename}")
        
        chunk_texts = [item["text"] for item in chunks_with_page]
        dense_vectors, sparse_weights = embed_both(chunk_texts)
        
        points = []
        for idx, chunk_item in enumerate(chunks_with_page):
            chunk = chunk_item["text"]
            p_num = chunk_item["page"]
            
            dense_vector = dense_vectors[idx]
            sparse_vector = sparse_weights[idx]
            
            # Convert sparse lexical weights {token_id: weight} to Qdrant SparseVector format
            indices = []
            values = []
            for token_id, weight in sparse_vector.items():
                indices.append(int(token_id))
                values.append(float(weight))
            
            # Sort by index
            sorted_pairs = sorted(zip(indices, values))
            indices = [p[0] for p in sorted_pairs]
            values = [p[1] for p in sorted_pairs]
            
            qdrant_sparse = SparseVector(indices=indices, values=values)
            
            # MD5 hex of filename + chunk_index, converted to UUID string for stable point ID across restarts
            unique_str = f"{filename}_{idx}"
            point_id = str(uuid.UUID(hex=hashlib.md5(unique_str.encode("utf-8")).hexdigest()))
            
            # Rich metadata payload
            payload = {
                "filename": filename,
                "chunk_id": idx,
                "chunk_index": idx,
                "page_number": p_num,
                "file_hash": file_hash,
                "text": chunk,
                "case_type": suggestions.get("case_type", "injury"),
                "claimant": suggestions.get("name") or suggestions.get("claimant") or "",
                "respondent": suggestions.get("respondent", "Insurance Company / Respondent"),
                "document_type": suggestions.get("document_type", "Judgment"),
                "upload_date": suggestions.get("upload_date") or time.strftime("%d-%m-%Y"),
                # For backwards compatibility with evaluation models
                "name": suggestions.get("name", ""),
                "father_name": suggestions.get("father_name", ""),
                "age": suggestions.get("age", ""),
                "monthly_income": suggestions.get("monthly_income", ""),
                "disability": suggestions.get("disability", ""),
                "dependents": suggestions.get("dependents", ""),
                "marital_status": suggestions.get("marital_status", "married"),
                "award_amount": suggestions.get("award_amount", "")
            }
            
            points.append(PointStruct(
                id=point_id,
                vector={
                    "dense": dense_vector,
                    "sparse": qdrant_sparse
                },
                payload=payload
            ))
            
        # Upsert batch into Qdrant
        client.upsert(
            collection_name=COLLECTION_NAME,
            points=points
        )
        logger.info(f"Indexed {len(chunks_with_page)} points for document '{filename}' in Qdrant successfully!")
        return True
    except Exception as e:
        logger.error(f"Error during Qdrant indexing: {str(e)}")
        return False

# ======================================================
# SEMANTIC QUERY SEARCH
# ======================================================

def semantic_search(query: str, limit: int = 5, case_type_filter: str = None, filename_filter: str = None) -> list:
    """
    Performs semantic vector search across all indexed PDFs.
    Optionally filters by case type ('injury' or 'death') and/or filename.
    """
    client = get_qdrant_client()
    
    if client is None:
        logger.warning("Vector DB is offline. Returning empty search results.")
        return []
        
    # Embed query text using BGE-M3
    query_vector = get_bge_embedding(query)
    if query_vector is None:
        logger.warning(f"Failed to generate embedding for search query: '{query}'. Returning empty results.")
        return []
        
    try:
        # Build filter conditions
        must_conditions = []
        
        if case_type_filter:
            from qdrant_client.models import FieldCondition, MatchValue
            must_conditions.append(
                FieldCondition(
                    key="case_type",
                    match=MatchValue(value=case_type_filter)
                )
            )
            
        if filename_filter:
            from qdrant_client.models import FieldCondition, MatchValue
            must_conditions.append(
                FieldCondition(
                    key="filename",
                    match=MatchValue(value=filename_filter)
                )
            )
            
        search_filter = None
        if must_conditions:
            from qdrant_client.models import Filter
            search_filter = Filter(must=must_conditions)
            
        # Execute vector search
        search_results = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            using="dense",
            query_filter=search_filter,
            limit=limit
        ).points
        
        # Format results
        formatted_results = []
        for res in search_results:
            formatted_results.append({
                "id": res.id,
                "score": round(res.score, 4),
                "text": res.payload.get("text", ""),
                "filename": res.payload.get("filename", ""),
                "metadata": {
                    "case_type": res.payload.get("case_type", ""),
                    "claimant": res.payload.get("claimant", ""),
                    "respondent": res.payload.get("respondent", ""),
                    "document_type": res.payload.get("document_type", ""),
                    "upload_date": res.payload.get("upload_date", ""),
                    "name": res.payload.get("name", ""),
                    "age": res.payload.get("age", ""),
                    "monthly_income": res.payload.get("monthly_income", ""),
                    "disability": res.payload.get("disability", ""),
                    "award_amount": res.payload.get("award_amount", ""),
                    "page_number": res.payload.get("page_number", 1),
                    "chunk_index": res.payload.get("chunk_index", 0),
                    "file_hash": res.payload.get("file_hash", "")
                }
            })
            
        return formatted_results
    except Exception as e:
        logger.error(f"Error during semantic vector search: {str(e)}")
        return []

def semantic_search_rag(query: str, limit: int = 5, filename_filter: str = None) -> list:
    """
    Retrieves relevant text chunks from the vector database.
    If filename_filter exists: search only that PDF
    Else: search entire library
    """
    logger.info(f"RAG search query='{query}', limit={limit}, filename_filter='{filename_filter}'")
    return semantic_search(query, limit=limit, filename_filter=filename_filter)

def index_contextual_chunks(document_id: str, chunks: list[dict], suggestions: dict = None) -> bool:
    """
    Indexes contextual chunks into Qdrant with both dense + sparse vectors.
    Each chunk dict has: chunk_id, combined_text, content, context, metadata.page
    """
    client = get_qdrant_client()
    if not client:
        return False

    if suggestions is None:
        suggestions = {}

    # Extract combined texts for embedding
    texts = [c["combined_text"] for c in chunks]

    # One call → both dense and sparse
    dense_vecs, sparse_vecs = embed_both(texts)

    points = []
    for i, chunk in enumerate(chunks):
        # Stable unique ID
        uid = str(uuid.UUID(hex=hashlib.md5(
            f"{document_id}_{chunk['chunk_id']}".encode()
        ).hexdigest()))

        # Convert sparse dict {token_id: weight} → Qdrant SparseVector
        sparse = sparse_vecs[i]
        sparse_indices = [int(k) for k in sparse.keys()]
        sparse_values  = [float(v) for v in sparse.values()]

        points.append(PointStruct(
            id=uid,
            vector={
                "dense":  dense_vecs[i],
                "sparse": SparseVector(
                    indices=sparse_indices,
                    values=sparse_values
                )
            },
            payload={
                "document_id": document_id,
                "chunk_id":    chunk["chunk_id"],
                "content":     chunk["content"],
                "context":     chunk["context"],
                "combined_text": chunk["combined_text"],
                "page":        chunk["metadata"]["page"],
                # Suggestions / Metadata
                "filename":    suggestions.get("filename", ""),
                "case_type":   suggestions.get("case_type", "injury"),
                "claimant":    suggestions.get("name") or suggestions.get("claimant") or "",
                "respondent":  suggestions.get("respondent", "Insurance Company / Respondent"),
                "document_type": suggestions.get("document_type", "Judgment"),
                "upload_date": suggestions.get("upload_date") or time.strftime("%d-%m-%Y"),
                "name":        suggestions.get("name", ""),
                "father_name": suggestions.get("father_name", ""),
                "age":         suggestions.get("age", ""),
                "monthly_income": suggestions.get("monthly_income", ""),
                "disability":  suggestions.get("disability", ""),
                "dependents":  suggestions.get("dependents", ""),
                "marital_status": suggestions.get("marital_status", "married"),
                "award_amount": suggestions.get("award_amount", "")
            }
        ))

    client.upsert(collection_name=COLLECTION_NAME, points=points)
    logger.info(f"Indexed {len(points)} chunks for document {document_id}")
    return True
