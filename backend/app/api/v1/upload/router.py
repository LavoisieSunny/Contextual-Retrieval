from fastapi import APIRouter, UploadFile, File, HTTPException, status, BackgroundTasks
from app.schemas.upload import DocumentUploadResponse
from app.services.document.upload_service import save_uploaded_file, get_job_status, process_upload_background

router = APIRouter()

@router.post("", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
def upload_document(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Receives and validates documents uploaded to the API, initiating background ingestion."""
    result = save_uploaded_file(file)
    if result["status"] == "failed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["message"]
        )
    
    # Extract details for background task
    document_id = result["document_id"]
    file_path = result["file_path"]
    file_ext = result["file_ext"]
    filename = result["filename"]
    
    # Add to background tasks
    background_tasks.add_task(
        process_upload_background,
        document_id=document_id,
        file_path=file_path,
        file_ext=file_ext,
        filename=filename
    )
    
    # Return immediately with processing status
    return DocumentUploadResponse(
        filename=filename,
        content_type=result["content_type"],
        file_size_bytes=result["file_size_bytes"],
        status="processing",
        message="Document uploaded successfully. Processing started in background.",
        document_id=document_id
    )

@router.get("/status/{job_id}")
def get_upload_status(job_id: str):
    """Retrieves the current status of a background upload/ingestion job."""
    job_status = get_job_status(job_id)
    if job_status is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload job with ID '{job_id}' not found."
        )
    return job_status
