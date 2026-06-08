# backend/app/services/contextual_rag/context_generator.py
import logging
from app.core.settings import settings
from app.services.contextual_rag.prompts import CONTEXT_PROMPT_TEMPLATE, DOCUMENT_SUMMARY_TEMPLATE

logger = logging.getLogger("ContextGenerator")

class ContextGenerator:
    def __init__(self):
        self.model_name = settings.CONTEXT_MODEL
        self.base_url = settings.OLLAMA_HOST
        self.max_words = settings.CONTEXT_MAX_WORDS
        self.llm = None
        self._initialize_llm()

    def _initialize_llm(self):
        """Initializes the LangChain ChatOllama client."""
        try:
            from langchain_ollama import ChatOllama
            logger.info(f"Initializing ChatOllama with base_url={self.base_url}, model={self.model_name}")
            self.llm = ChatOllama(
                base_url=self.base_url,
                model=self.model_name,
                temperature=0.2,
                num_predict=self.max_words * 4  # Limit token generation
            )
        except Exception as e:
            logger.error(f"Failed to initialize ChatOllama: {e}")
            self.llm = None

    def generate_document_summary(self, text: str) -> str:
        """
        Generates a concise document summary of the legal text using Qwen3.
        Provides a fallback if Ollama is offline or fails.
        """
        if not text:
            return ""
        
        # Limit text length passed to summary to avoid context blowup
        short_text = text[:12000]
        
        prompt = "/no_think\n\n" + DOCUMENT_SUMMARY_TEMPLATE.format(text=short_text)
        
        if not self.llm:
            logger.warning("LLM client not initialized for summary. Using fallback summary.")
            return "This is a motor accident claims tribunal legal document containing claimant details, accident facts, and compensation demands."
            
        try:
            response = self.llm.invoke(prompt)
            summary = response.content.strip()
            if not summary:
                raise ValueError("Received empty response content from LLM for summary")
            return summary
        except Exception as e:
            logger.warning(f"Failed to generate summary: {e}. Using fallback.")
            return "This is a motor accident claims tribunal legal document containing claimant details, accident facts, and compensation demands."

    def generate_context(self, current_chunk: str, prev_chunk: str = "", next_chunk: str = "", document_summary: str = "") -> str:
        """
        Generates context for a chunk using the nearby surrounding chunks and a document summary.
        Provides a fallback if Ollama is offline or fails.
        """
        # Clean chunks to avoid formatting issues
        current_chunk = current_chunk.strip()
        prev_chunk = prev_chunk.strip() if prev_chunk else "[No preceding content]"
        next_chunk = next_chunk.strip() if next_chunk else "[No succeeding content]"
        document_summary = document_summary.strip() if document_summary else "[No document summary available]"
        
        # Build prompt
        prompt = "/no_think\n\n" + CONTEXT_PROMPT_TEMPLATE.format(
            max_words=self.max_words,
            prev_chunk=prev_chunk,
            next_chunk=next_chunk,
            chunk_content=current_chunk,
            document_summary=document_summary
        )
        
        if not self.llm:
            logger.warning("LLM client not initialized. Using fallback context.")
            return self._get_fallback_context(current_chunk)
            
        try:
            response = self.llm.invoke(prompt)
            # Response in LangChain ChatModel has a .content attribute
            context = response.content.strip()
            if not context:
                raise ValueError("Received empty response content from LLM")
            return context
        except Exception as e:
            logger.warning(f"Failed to generate context using Ollama model {self.model_name}: {e}. Using fallback.")
            return self._get_fallback_context(current_chunk)

    def _get_fallback_context(self, chunk_text: str) -> str:
        """
        Generates a deterministic fallback context based on keywords in the chunk.
        """
        chunk_lower = chunk_text.lower()
        if "medical" in chunk_lower or "expense" in chunk_lower or "hospital" in chunk_lower or "medicine" in chunk_lower:
            return "This section discusses medical expenses, bills, and related treatment charges claimed by the petitioner."
        elif "income" in chunk_lower or "salary" in chunk_lower or "monthly" in chunk_lower or "occupation" in chunk_lower:
            return "This section describes the occupation, monthly income, and financial standing of the petitioner or deceased."
        elif "disability" in chunk_lower or "percent" in chunk_lower or "disable" in chunk_lower:
            return "This section addresses the physical disability percentage, assessment, and its impact on the earning capacity of the claimant."
        elif "accident" in chunk_lower or "date" in chunk_lower or "time" in chunk_lower or "place" in chunk_lower:
            return "This section details the circumstances, date, time, and location of the motor vehicle accident."
        elif "compensation" in chunk_lower or "award" in chunk_lower or "tribunal" in chunk_lower or "rs." in chunk_lower or "rupees" in chunk_lower:
            return "This section details the final compensation awards, calculations, and interest rates decided by the Tribunal."
        return "This section details key facts, evidence, or arguments from the legal petition or court judgment."
