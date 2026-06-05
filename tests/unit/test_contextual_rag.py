# tests/unit/test_contextual_rag.py
import json
import unittest
from unittest.mock import MagicMock, patch
from pathlib import Path
import tempfile
import shutil

from app.core.settings import settings
from app.services.contextual_rag.context_generator import ContextGenerator
from app.services.contextual_rag.contextual_chunker import ContextualChunker
from app.services.contextual_rag.ingestion_pipeline import ContextualIngestionPipeline


class TestContextualRAG(unittest.TestCase):
    
    def test_settings_loading(self):
        """Verify settings retrieve configured environment variables or defaults."""
        self.assertEqual(settings.CONTEXT_MODEL, "qwen3:4b")
        self.assertEqual(settings.CONTEXT_MAX_WORDS, 50)
        self.assertEqual(settings.CHUNK_SIZE, 1000)
        self.assertEqual(settings.CHUNK_OVERLAP, 200)

    @patch("langchain_ollama.ChatOllama")
    def test_ollama_model_loading(self, mock_chat_ollama):
        """Verify ContextGenerator initializes ChatOllama with configured parameters."""
        generator = ContextGenerator()
        
        # Verify ChatOllama was instantiated with correctly mapped host and model
        mock_chat_ollama.assert_called_once()
        called_kwargs = mock_chat_ollama.call_args[1]
        self.assertEqual(called_kwargs["model"], "qwen3:4b")
        self.assertEqual(called_kwargs["base_url"], "http://localhost:11434")

    @patch("langchain_ollama.ChatOllama")
    def test_context_generation_success(self, mock_chat_ollama):
        """Verify prompt execution and formatting when Ollama returns a valid context."""
        mock_llm_instance = MagicMock()
        mock_response = MagicMock()
        mock_response.content = "This chunk discusses medical expenses for rehabilitation."
        mock_llm_instance.invoke.return_value = mock_response
        mock_chat_ollama.return_value = mock_llm_instance

        generator = ContextGenerator()
        context = generator.generate_context(
            current_chunk="Medical bills amounted to Rs. 45,000.",
            prev_chunk="Claimant suffered fractures.",
            next_chunk="Disability was evaluated at 20%."
        )

        self.assertEqual(context, "This chunk discusses medical expenses for rehabilitation.")
        mock_llm_instance.invoke.assert_called_once()
        prompt_arg = mock_llm_instance.invoke.call_args[0][0]
        
        # Assert prompt includes instructions, rules, and all surrounding chunks
        self.assertIn("Nearby Surrounding Chunks:", prompt_arg)
        self.assertIn("fractures", prompt_arg)

        self.assertIn("rehabilitation", context)

    def test_context_generation_fallback(self):
        """Verify deterministic keyword fallback when Ollama is offline or raises an error."""
        # Use context generator without initializing a mocked LLM (will raise/fail to load or self.llm is None)
        with patch("langchain_ollama.ChatOllama", side_effect=Exception("Connection refused")):
            generator = ContextGenerator()
            
            # Test medical fallback
            medical_context = generator.generate_context("Medical bills were Rs. 5,000.")
            self.assertIn("medical expenses", medical_context.lower())
            
            # Test income fallback
            income_context = generator.generate_context("The petitioner was earning monthly Rs. 15,000 as a driver.")
            self.assertIn("monthly income", income_context.lower())
            
            # Test default fallback
            default_context = generator.generate_context("The witness stated that the traffic light was green.")
            self.assertIn("key facts", default_context.lower())

    def test_contextual_chunk_creation(self):
        """Verify correct structure and formatting of the combined contextual chunk payload."""
        content = "Claimant was age 25."
        context = "This section specifies the age of the claimant."
        
        chunk_obj = ContextualChunker.create_contextual_chunk(content, context)
        
        self.assertEqual(chunk_obj["content"], content)
        self.assertEqual(chunk_obj["context"], context)
        self.assertEqual(
            chunk_obj["combined_text"],
            f"[Document Context] {context}\n\n[Content] {content}"
        )

    def test_recursive_character_splitter_integration(self):
        """Verify text splitting logic using RecursiveCharacterTextSplitter with configured dimensions."""
        chunker = ContextualChunker(chunk_size=50, chunk_overlap=10)
        text = "This is a long sentence that should definitely exceed the fifty character limit and trigger a split."
        
        chunks = chunker.split_text(text)
        
        self.assertTrue(len(chunks) > 1)
        for chunk in chunks:
            self.assertTrue(len(chunk) <= 50)

    @patch("langchain_ollama.ChatOllama")
    def test_contextual_ingestion_pipeline_end_to_end(self, mock_chat_ollama):
        """Verify complete ingestion pipeline: OCR text -> cleaned text -> page matching -> json storage."""
        # Setup temporary directories for testing output storage to prevent polluting workspace
        temp_dir = Path(tempfile.mkdtemp())
        
        mock_llm_instance = MagicMock()
        mock_response = MagicMock()
        mock_response.content = "Mocked LLM context description."
        mock_llm_instance.invoke.return_value = mock_response
        mock_chat_ollama.return_value = mock_llm_instance

        # Patch storage directory in pipeline
        with patch.object(settings, "STORAGE_DIR", str(temp_dir)):
            pipeline = ContextualIngestionPipeline()
            # Explicitly force pipeline's storage dir to temp
            pipeline.storage_dir = temp_dir / "contextual_chunks"
            pipeline.storage_dir.mkdir(parents=True, exist_ok=True)

            raw_document_text = (
                "--- PAGE 1 ---\n"
                "In the High Court of Karnataka.\n"
                "Amit Kumar, Petitioner, versus State of Karnataka.\n\n"
                "--- PAGE 2 ---\n"
                "The accident occurred on 12-05-2025 in Bengaluru.\n"
                "The petitioner sustained critical injuries and was treated at St. Johns hospital.\n"
            )

            document_id = "test_doc_123"
            chunks = pipeline.process_document(document_id, raw_document_text)

            # Assertions
            self.assertTrue(len(chunks) > 0)
            
            # Check page numbers are correctly mapped from --- PAGE X --- boundaries
            page_1_chunk = chunks[0]
            self.assertEqual(page_1_chunk["metadata"]["page"], 1)
            
            # Check JSON storage files were written correctly
            stored_doc_dir = pipeline.storage_dir / document_id
            self.assertTrue(stored_doc_dir.exists())
            
            individual_chunk_file = stored_doc_dir / "chunk_1.json"
            self.assertTrue(individual_chunk_file.exists())
            
            with open(individual_chunk_file, "r", encoding="utf-8") as f:
                chunk_data = json.load(f)
                self.assertEqual(chunk_data["chunk_id"], 1)
                self.assertEqual(chunk_data["page"], 1)
                self.assertEqual(chunk_data["context"], "Mocked LLM context description.")
                self.assertTrue("combined_text" in chunk_data)

            # Clean up temp files
            shutil.rmtree(temp_dir)


if __name__ == "__main__":
    unittest.main()
