from pydantic import BaseModel
from typing import Optional

class DocumentUploadResponse(BaseModel):
    filename: str
    content_type: str
    file_size_bytes: int
    status: str
    message: str
    document_id: Optional[str] = None
