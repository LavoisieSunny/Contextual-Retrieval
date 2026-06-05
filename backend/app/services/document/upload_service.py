import os
import uuid
from pathlib import Path
from fastapi import UploadFile
from app.core.settings import settings
from app.core.logger import logger
from app.services.document.parser import extract_text
from app.services.document.chunker import chunk_text

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}

def save_uploaded_file(file: UploadFile) -> dict:
    """Saves file to backend/app/storage/uploads, validates headers, and runs parsing/chunking mock-pipeline."""
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
        
        # Parse text (placeholder)
        raw_text = extract_text(file_path)
        
        # Chunk text (placeholder)
        chunks = chunk_text(raw_text)
        
        return {
            "filename": filename,
            "content_type": file.content_type or "unknown",
            "file_size_bytes": file_size,
            "status": "success",
            "message": f"File uploaded and indexed successfully. Extracted {len(raw_text)} characters, split into {len(chunks)} chunks.",
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
