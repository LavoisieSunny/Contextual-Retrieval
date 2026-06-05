from fastapi import APIRouter
from app.schemas.chat import ChatQueryRequest, ChatQueryResponse
from app.services.chatbot.chat_service import generate_chat_response

router = APIRouter()

@router.post("", response_model=ChatQueryResponse)
def post_chat_query(request: ChatQueryRequest):
    """Processes conversational chatbot messages and query history."""
    return generate_chat_response(request)
