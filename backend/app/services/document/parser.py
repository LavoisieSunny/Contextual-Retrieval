from pathlib import Path
from app.core.logger import logger

def extract_text(file_path: Path) -> str:
    """Extracts raw string text from documents.
    Placeholder for future OCR / PDF parsing modules.
    """
    logger.info(f"Extracting text from {file_path}")
    ext = file_path.suffix.lower()
    
    if ext == ".txt":
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            logger.error(f"Failed to read text file: {e}")
            return ""
            
    # Return descriptive placeholder text for PDF/Word files in Phase 1
    return (
        f"Mocked text content parsed from {file_path.name}.\n"
        "Contextual RAG pipeline will ingest, run OCR, and extract structured document text in future phases. "
        "For now, this content acts as a placeholder text for validation."
    )
