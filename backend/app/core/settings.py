import os
from pathlib import Path
from pydantic_settings import BaseSettings
from app.core.ports import FRONTEND_PORT, BACKEND_PORT, QDRANT_PORT

# Locate project root folder containing the .env file
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent

class Settings(BaseSettings):
    APP_NAME: str = "Contextual_RAG_CC"
    ENVIRONMENT: str = "development"
    
    # Service Ports mapped directly from ports.py
    FRONTEND_PORT: int = FRONTEND_PORT
    BACKEND_PORT: int = BACKEND_PORT
    QDRANT_PORT: int = QDRANT_PORT
    
    # Qdrant Configs
    QDRANT_HOST: str = "localhost"
    QDRANT_API_KEY: str | None = None
    
    # Storage Configs
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 50
    STORAGE_DIR: str | None = None

    # LLM Settings
    LLM_PROVIDER: str = "ollama"
    LLM_MODEL_NAME: str = "qwen2.5:14b"
    LLM_API_KEY: str = ""
    LLM_API_ENDPOINT: str = "http://localhost:11434"

    # Contextual RAG Settings
    OLLAMA_HOST: str = "http://localhost:11434"
    CONTEXT_MODEL: str = "qwen3:4b"
    CONTEXT_MAX_WORDS: int = 80
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200


    @property
    def storage_path(self) -> Path:
        """Returns the absolute path to backend/app/storage or configured STORAGE_DIR."""
        if self.STORAGE_DIR:
            return Path(self.STORAGE_DIR).resolve()
        return Path(__file__).resolve().parent.parent / "storage"

    class Config:
        env_file = str(BASE_DIR / ".env")
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"

settings = Settings()
