# backend/app/services/document/chunker.py
import re
import numpy as np
from typing import List
from app.core.logger import logger
from app.services.embeddings.bge_m3 import get_bge_m3

def chunk_text(text: str, chunk_size: int = 500, chunk_overlap: int = 50) -> List[str]:
    """
    Intelligently splits text into semantic chunks based on sentence embedding similarities
    using BGE-M3, falling back to size-constrained chunk boundaries.
    """
    logger.info(f"Segmenting text (length {len(text)}) into semantic chunks with target size {chunk_size}")
    if not text or not text.strip():
        return []

    # 1. Split text into sentences using standard punctuation endings, keeping abbreviations intact
    sentence_split_regex = re.compile(
        r'(?<!\bMr)(?<!\bMrs)(?<!\bDr)(?<!\bRs)(?<!\bCo)(?<!\bNo)(?<!\bVol)(?<!\bvs)(?<!\bAnr)(?<!\bOrs)(?<!\bHon)(?<!\bHon\'ble)(?<!\b[A-Z][a-z]\.)(?<=\.|\?|!)\s+'
    )
    raw_sentences = sentence_split_regex.split(text)
    sentences = [s.strip() for s in raw_sentences if s.strip()]

    if not sentences:
        return []
    if len(sentences) == 1:
        if len(sentences[0]) <= chunk_size:
            return [sentences[0]]
        # Directly split single long sentence by words
        chunks = []
        words = sentences[0].split()
        temp_words = []
        temp_len = 0
        for w in words:
            if temp_len + len(w) + 1 <= chunk_size:
                temp_words.append(w)
                temp_len += len(w) + 1
            else:
                if temp_words:
                    chunks.append(" ".join(temp_words))
                temp_words = [w]
                temp_len = len(w)
        if temp_words:
            chunks.append(" ".join(temp_words))
        return chunks

    try:
        # 2. Get embeddings using BGE-M3
        model = get_bge_m3()
        # Encode all sentences at once
        output = model.encode(sentences, return_dense=True, return_sparse=False, return_colbert_vecs=False)
        embeddings = output['dense_vecs'] # shape: (num_sentences, 1024)

        # 3. Calculate cosine distances between consecutive sentences
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1.0, norms)
        normalized_embeddings = embeddings / norms

        similarities = [
            float(np.dot(normalized_embeddings[i], normalized_embeddings[i+1]))
            for i in range(len(sentences) - 1)
        ]
        distances = [1.0 - sim for sim in similarities]

        # 4. Compute dynamic distance threshold (mean + 1.2 * std)
        if distances:
            mean_dist = np.mean(distances)
            std_dist = np.std(distances)
            threshold = mean_dist + 1.2 * std_dist
            # Bound the threshold to reasonable limits
            threshold = max(0.2, min(threshold, 0.8))
        else:
            threshold = 0.5
    except Exception as e:
        logger.error(f"Semantic chunking embedding failed, falling back to threshold 0.5: {str(e)}")
        distances = []
        threshold = 0.5

    # 5. Group sentences into semantic chunks
    chunks = []
    current_chunk = []
    current_chunk_len = 0

    for idx, sentence in enumerate(sentences):
        # Sentence is larger than chunk_size: split it by word character limit fallback to avoid data loss
        if len(sentence) > chunk_size:
            if current_chunk:
                chunks.append(" ".join(current_chunk))
                current_chunk = []
                current_chunk_len = 0
            
            # Sub-split long sentence by words
            words = sentence.split()
            temp_words = []
            temp_len = 0
            for w in words:
                if temp_len + len(w) + 1 <= chunk_size:
                    temp_words.append(w)
                    temp_len += len(w) + 1
                else:
                    if temp_words:
                        chunks.append(" ".join(temp_words))
                    temp_words = [w]
                    temp_len = len(w)
            if temp_words:
                current_chunk = temp_words
                current_chunk_len = temp_len
            continue

        should_split = False
        if idx > 0 and distances:
            # Check semantic boundary
            dist = distances[idx - 1]
            if dist > threshold:
                should_split = True

        # Check hard chunk size constraint
        if current_chunk_len + len(sentence) + 1 > chunk_size:
            should_split = True

        if should_split and current_chunk:
            chunks.append(" ".join(current_chunk))
            
            # Apply chunk_overlap: pull last sentence(s) up to overlap threshold
            overlap_sentences = []
            overlap_len = 0
            for s in reversed(current_chunk):
                if overlap_len + len(s) + 1 <= chunk_overlap:
                    overlap_sentences.insert(0, s)
                    overlap_len += len(s) + 1
                else:
                    break
            current_chunk = overlap_sentences
            current_chunk_len = overlap_len

        current_chunk.append(sentence)
        current_chunk_len += len(sentence) + 1

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks
