from pydantic import BaseModel

class HealthResponse(BaseModel):
    api: str
    qdrant: str
    storage: str
