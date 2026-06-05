# backend/app/services/contextual_rag/prompts.py

CONTEXT_PROMPT_TEMPLATE = """You are generating retrieval context.

Given a document chunk and nearby surrounding chunks, generate a short explanation describing the role of the chunk within the document.

Rules:
* Maximum {max_words} words
* Do not summarize the whole document
* Explain only the relevance of the chunk
* Return plain text only
* No markdown
* No bullet points

Nearby Surrounding Chunks:
<previous_chunk>
{prev_chunk}
</previous_chunk>

<next_chunk>
{next_chunk}
</next_chunk>

Here is the chunk we want to situate:
<chunk>
{chunk_content}
</chunk>
"""
