from fastapi import APIRouter, UploadFile, File, HTTPException, status
from app.schemas.upload import DocumentUploadResponse
from app.services.document.upload_service import save_uploaded_file

router = APIRouter()

@router.post("", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
def upload_document(file: UploadFile = File(...)):
    """Receives and validates documents uploaded to the API."""
    result = save_uploaded_file(file)
    if result["status"] == "failed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["message"]
        )
    return DocumentUploadResponse(**result)
