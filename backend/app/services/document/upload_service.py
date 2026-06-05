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

def save_uploaded_file(file: UploadFile) -> dict:
    """
    Saves an uploaded file, extracts text depending on its extension 
    (running SmartOCRPipeline for PDFs, using python-docx for Word files, 
    and direct read for text files), cleans and chunks the text, generates 
    context using Ollama, and stores the contextual chunks as JSON.
    """
    filename = file.filename or "unknown"
    file_ext = Path(filename).suffix.lower()
    
    if file_ext not in ALLOWED_EXTENSIONS:
        return {
            "filename": filename,
            "content_type": file.content_type or "unknown",
            "file_size_bytes": 0,
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
                "filename": filename,
                "content_type": file.content_type or "unknown",
                "file_size_bytes": file_size,
                "status": "failed",
                "message": f"File size exceeds maximum threshold of {settings.MAX_FILE_SIZE_MB}MB"
            }
            
        with open(file_path, "wb") as f:
            f.write(content)
            
        logger.info(f"File stored successfully at {file_path}")
        
        # 1. Parse/Extract Text based on file type
        raw_text = ""
        if file_ext == ".pdf":
            logger.info("Routing PDF to SmartOCRPipeline for text extraction/OCR...")
            pipeline = SmartOCRPipeline()
            pipeline_res = pipeline.process_pdf(file_path)
            raw_text = "\n".join(pipeline_res.get("raw_text", []))
        elif file_ext == ".docx":
            logger.info("Extracting text from DOCX file...")
            doc = docx.Document(file_path)
            raw_text = "\n".join([p.text for p in doc.paragraphs])
        else:  # .txt
            logger.info("Extracting text from TXT file...")
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                raw_text = f.read()

        if not raw_text.strip():
            return {
                "filename": filename,
                "content_type": file.content_type or "unknown",
                "file_size_bytes": file_size,
                "status": "failed",
                "message": "File was successfully stored but no text could be extracted.",
                "document_id": document_id
            }

        # 2. Run Contextual Ingestion Pipeline (Cleaning, Chinking, Context Generation, Storing)
        ingestion_pipeline = ContextualIngestionPipeline()
        contextual_chunks = ingestion_pipeline.process_document(document_id, raw_text)
        
        return {
            "filename": filename,
            "content_type": file.content_type or "unknown",
            "file_size_bytes": file_size,
            "status": "success",
            "message": f"File uploaded, OCR/Text extracted, and indexed successfully. Split into {len(contextual_chunks)} contextual chunks.",
            "document_id": document_id
        }
        
    except Exception as e:
        logger.error(f"Error handling file upload {filename}: {e}")
        return {
            "filename": filename,
            "content_type": file.content_type or "unknown",
            "file_size_bytes": 0,
            "status": "failed",
            "message": f"Server upload pipeline failure: {e}"
        }
