from pydantic import BaseModel
from typing import List, Optional

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatQueryRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []

class Citation(BaseModel):
    document_name: str
    snippet: str
    page: Optional[int] = None

class ChatQueryResponse(BaseModel):
    answer: str
    citations: List[Citation] = []
