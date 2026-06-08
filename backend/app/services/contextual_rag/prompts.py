# backend/app/services/contextual_rag/prompts.py

DOCUMENT_SUMMARY_TEMPLATE = """You are summarizing a legal document.
Generate a high-level summary of the case (who is the claimant, who is the respondent, what is the claim about) in maximum 100 words.

Document Content:
{text}
"""

CONTEXT_PROMPT_TEMPLATE = """You are generating retrieval context.

Here is a high-level summary of the document:
<document_summary>
{document_summary}
</document_summary>

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
