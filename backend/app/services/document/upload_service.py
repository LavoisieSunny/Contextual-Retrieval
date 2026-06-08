# backend/app/services/document/upload_service.py
import os
import uuid
import docx
from pathlib import Path
from fastapi import UploadFile

from app.core.settings import settings
from app.core.logger import logger
from app.services.document.pipeline import SmartOCRPipeline
from app.services.contextual_rag.ingestion_pipeline import ContextualIngestionPipeline

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}

# Global job status tracker
# {job_id: {"status": "processing" | "success" | "failed", "message": str, "filename": str, "document_id": str}}
jobs_tracker = {}

def get_job_status(job_id: str) -> dict:
    """Retrieves the status of a background upload/ingestion job."""
    return jobs_tracker.get(job_id)

def save_uploaded_file(file: UploadFile) -> dict:
    """
    Saves an uploaded file synchronously, validates it, and returns details
    needed to run processing in the background.
    """
    filename = file.filename or "unknown"
    file_ext = Path(filename).suffix.lower()
    
    if file_ext not in ALLOWED_EXTENSIONS:
        return {
            "status": "failed",
            "message": f"Unsupported extension {file_ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        }

    # Ensure storage paths exist
    uploads_dir = settings.storage_path / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    
    document_id = str(uuid.uuid4())
    save_filename = f"{document_id}_{filename}"
    file_path = uploads_dir / save_filename

    try:
        # Read and check size
        content = file.file.read()
        file_size = len(content)
        max_size_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
        
        if file_size > max_size_bytes:
            return {
                "status": "failed",
                "message": f"File size exceeds maximum threshold of {settings.MAX_FILE_SIZE_MB}MB"
            }
            
        with open(file_path, "wb") as f:
            f.write(content)
            
        logger.info(f"File stored successfully at {file_path}")
        
        # Initialize job in tracker
        jobs_tracker[document_id] = {
            "status": "processing",
            "message": "File saved on disk. Starting text extraction and ingestion...",
            "filename": filename,
            "content_type": file.content_type,
            "file_size_bytes": file_size,
            "document_id": document_id
        }

        return {
            "status": "success",
            "document_id": document_id,
            "file_path": str(file_path),
            "file_ext": file_ext,
            "filename": filename,
            "content_type": file.content_type or "unknown",
            "file_size_bytes": file_size
        }
        
    except Exception as e:
        logger.error(f"Error saving file {filename}: {e}")
        return {
            "status": "failed",
            "message": f"Server upload failure: {e}"
        }

def process_upload_background(document_id: str, file_path: str, file_ext: str, filename: str):
    """Heavy text extraction and Contextual RAG ingestion run in a background task."""
    logger.info(f"Starting background processing for document {document_id} ({filename})...")
    try:
        # 1. Parse/Extract Text based on file type
        raw_text = ""
        suggestions = {}
        if file_ext == ".pdf":
            logger.info("Routing PDF to SmartOCRPipeline for text extraction/OCR...")
            pipeline = SmartOCRPipeline()
            pipeline_res = pipeline.process_pdf(Path(file_path))
            raw_text = "\n".join(pipeline_res.get("raw_text", []))
            suggestions = pipeline_res.get("suggestions", {})
        elif file_ext == ".docx":
            logger.info("Extracting text from DOCX file...")
            doc = docx.Document(file_path)
            raw_text = "\n".join([p.text for p in doc.paragraphs])
        else:  # .txt
            logger.info("Extracting text from TXT file...")
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                raw_text = f.read()

        # Ensure filename is in suggestions for Qdrant payload
        suggestions["filename"] = filename

        if not raw_text.strip():
            jobs_tracker[document_id].update({
                "status": "failed",
                "message": "No text could be extracted from the file."
            })
            return

        # 2. Run Contextual Ingestion Pipeline (Cleaning, Chinking, Context Generation, Storing)
        ingestion_pipeline = ContextualIngestionPipeline()
        contextual_chunks = ingestion_pipeline.process_document(document_id, raw_text, suggestions=suggestions)
        
        jobs_tracker[document_id].update({
            "status": "success",
            "message": f"File indexed successfully. Split into {len(contextual_chunks)} contextual chunks."
        })
        logger.info(f"Background processing succeeded for document {document_id}")
        
    except Exception as e:
        logger.error(f"Error during background processing of document {document_id}: {e}")
        jobs_tracker[document_id].update({
            "status": "failed",
            "message": f"Processing failed: {str(e)}"
        })
