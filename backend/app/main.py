import os
import sys
import asyncio
import logging
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.core.settings import settings
from app.core.ports import FRONTEND_PORT

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MainApp")

# Import existing V1 routers
from app.api.v1.health.router import router as health_router
from app.api.v1.upload.router import router as upload_router
from app.api.v1.chatbot.router import router as chatbot_router

# Import new compensation routers
from app.services.compensation.calculator import router as calculator_router
from app.services.document.ocr import router as ocr_router

# Import database and client helpers
from app.services.qdrant.vector_db import (
    semantic_search, 
    get_qdrant_client, 
    VECTOR_DB_INITIALIZED,
    COLLECTION_NAME
)
from app.services.compensation.evaluator import evaluate_compensation_precedents

app = FastAPI(
    title=settings.APP_NAME,
    description="Enterprise motor claims compensation dashboard with local Qdrant database indexing, batch PDF processing, and AI Legal Precedents Assistant.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

@app.on_event("startup")
async def startup_event():
    logger.info("Initializing Compensation Calculator API startup sequence...")
    try:
        # Validate Ollama setup and model availability
        from app.services.chatbot.llm_client import validate_ollama_setup
        validate_ollama_setup()
        
        # Initialize Qdrant Client and collection safety dynamically
        get_qdrant_client()
    except Exception as e:
        logger.error(f"Startup check failed: {str(e)}")

    # Warm up PaddleOCR — isolated so failure never blocks Ollama/Qdrant
    try:
        logger.info("Warming up PaddleOCR singleton...")
        from app.services.document.ocr import get_ocr_instance
        await asyncio.to_thread(get_ocr_instance)
        logger.info("PaddleOCR warm-up complete.")
    except Exception as e:
        logger.error(f"PaddleOCR warm-up failed (non-fatal): {str(e)}")

# Dynamic CORS origins configuration mapping the FRONTEND_PORT
origins = [
    f"http://localhost:{FRONTEND_PORT}",
    f"http://127.0.0.1:{FRONTEND_PORT}",
    "*"  # Allow all during integration for robust connection
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins to prevent CORS blocks
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    """Welcome index redirecting users to the Swagger UI page."""
    return {
        "message": f"Welcome to the {settings.APP_NAME} API.",
        "documentation": "/docs"
    }

# Register V1 routers
app.include_router(health_router, prefix="/api/v1/health", tags=["Health"])
app.include_router(upload_router, prefix="/api/v1/upload", tags=["Upload"])
app.include_router(chatbot_router, prefix="/api/v1/chatbot", tags=["Chatbot"])

# Register new compensation and OCR routers
app.include_router(calculator_router, prefix="/api/calculate", tags=["Calculation"])
app.include_router(ocr_router, prefix="/api/ocr", tags=["OCR"])

# ======================================================
# PYDANTIC SCHEMAS FOR CHAT & EVALUATIONS
# ======================================================

class ChatRequest(BaseModel):
    message: str
    case_type: str = "all"  # 'injury', 'death', or 'all'

class EvaluateRequest(BaseModel):
    params: dict
    calculated_amount: float

class PDFChatRequest(BaseModel):
    question: str = None
    message: str = None  # Backwards compatibility
    filename: str = None  # if provided, chats strictly with this PDF
    case_type: str = "all"  # 'injury', 'death', or 'all'
    
    # Validation context fields
    ocr_text: str = None
    parsed_fields: dict = None
    calculator_result: dict = None

# ======================================================
# API ENDPOINTS
# ======================================================

@app.post("/api/search/chat")
async def legal_ai_chat(request: ChatRequest):
    """
    Receives user query, runs a semantic vector search across 
    100+ indexed PDF documents in Qdrant, and returns matching precedents 
    and summaries.
    """
    try:
        case_filter = None if request.case_type == "all" else request.case_type
        
        # 1. Perform semantic search
        logger_results = semantic_search(request.message, limit=3, case_type_filter=case_filter)
        
        if not logger_results:
            # Fallback chat response if Qdrant is empty
            return {
                "response": "Hello! I am your AI Legal Assistant. The Qdrant centralized database is connected and is awaiting PDF document uploads to learn from precedents.\n\nOnce you drop legal petitions, judgments, or prayers in the **PDF Library**, they will be automatically indexed, and I can semantically answer specific profile questions (e.g. searching by age, income, and disability) and retrieve precedents!",
                "precedents": []
            }
            
        # 2. Compile matches into a highly professional response
        response_text = f"Based on your query **\"{request.message}\"**, I searched the centralized Qdrant vector database and retrieved the most relevant precedent cases:\n\n"
        
        for idx, match in enumerate(logger_results):
            meta = match["metadata"]
            name = meta.get("name", "Unnamed Claimant")
            filename = match["filename"]
            score = match["score"]
            award_amount = meta.get("award_amount", "")
            
            response_text += f"{idx+1}. **{name}** (Precedent file: *{filename}*, Semantic Match: {score*100:.1f}%)\n"
            response_text += f"   - *Case Parameters:* Age {meta.get('age', 'N/A')} | Income Rs. {meta.get('monthly_income', 'N/A')}/pm"
            if meta.get("case_type") == "injury":
                response_text += f" | Disability {meta.get('disability', 'N/A')}%"
            if award_amount:
                response_text += f" | **Award Amount: Rs. {int(float(award_amount)):,}**"
            response_text += f"\n   - *Key Extract:* \"...{match['text'].strip()}...\"\n\n"
            
        response_text += "\nThese matching judgments can be applied immediately as defensible courtroom precedents. Let me know if you would like me to compile the formal claim brief or run a comparative mathematical benchmarking evaluation!"
        
        return {
            "response": response_text,
            "precedents": logger_results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Legal chat error: {str(e)}")

@app.post("/api/search/evaluate")
async def evaluate_precedents(request: EvaluateRequest):
    """
    Benchmarks the math engine's calculated sum against semantic matched Qdrant precedents.
    """
    try:
        evaluation = evaluate_compensation_precedents(request.params, request.calculated_amount)
        return {
            "success": True,
            "evaluation": evaluation
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparative evaluation failed: {str(e)}")

@app.post("/api/chat/pdf")
async def chat_with_pdf(request: PDFChatRequest):
    """
    RAG PDF Assistant: retrieves semantic chunks from Qdrant 
    (optionally filtered strictly by filename for a single PDF Q&A)
    and sends the constructed prompt to the configured LLM.
    """
    try:
        import json
        question_str = request.question or request.message
        if not question_str:
            raise HTTPException(status_code=400, detail="Missing 'question' or 'message' field.")
            
        case_filter = None if request.case_type == "all" else request.case_type
        
        # Determine filename filter
        filename_filter = request.filename
        if filename_filter == "all" or filename_filter == "":
            filename_filter = None

        # 1. Perform semantic vector search using the RAG helper (retrieve more for reranking)
        from app.services.qdrant.vector_db import semantic_search_rag
        search_results = semantic_search_rag(
            query=question_str, 
            limit=15, 
            filename_filter=filename_filter
        )
        
        # Rerank retrieved chunks using ColBERT score
        from app.services.contextual_rag.reranker import BGEReranker
        reranker = BGEReranker()
        search_results = reranker.rerank(query=question_str, chunks=search_results, top_n=5)
        
        # 2. Construct context from retrieved points
        context_blocks = []
        precedents = []
        for idx, res in enumerate(search_results):
            text_block = res.get("text", "").strip()
            filename = res.get("filename", "unknown")
            context_blocks.append(f"[Context {idx+1} from {filename}]:\n{text_block}")
            
            precedents.append({
                "filename": filename,
                "score": res.get("rerank_score", res.get("score")),
                "text": text_block,
                "metadata": res.get("metadata", {})
            })
            
        retrieved_chunks = "\n\n".join(context_blocks)
        
        # 3. Incorporate Workstation Context (Phase 8 state integration)
        chunks_combined = retrieved_chunks
        workstation_blocks = []
        if request.ocr_text:
            workstation_blocks.append(f"[Current PDF Workstation OCR Text]:\n{request.ocr_text[:8000]}")
        if request.parsed_fields:
            workstation_blocks.append(f"[Current PDF Workstation Parsed Fields]:\n{json.dumps(request.parsed_fields, indent=2)}")
        if request.calculator_result:
            workstation_blocks.append(f"[Current Deterministic Calculator Math Output]:\n{json.dumps(request.calculator_result, indent=2)}")
        
        if workstation_blocks:
            chunks_combined = "\n\n".join(workstation_blocks) + "\n\n=== RETRIEVED PRECEDENTS ===\n\n" + chunks_combined
            
        # 4. Construct System Prompt & User Prompt strictly following grounding and safety boundaries
        user_prompt = (
            "You are a Motor Accident Claims Tribunal legal assistant.\n\n"
            "=== STRICTOR GROUNDING INSTRUCTIONS ===\n"
            "1. Use ONLY the supplied context (Retrieved Precedents and active Workstation details).\n"
            "2. Do NOT invent or hallucinate legal facts, precedents, or claims metrics.\n"
            "3. If the context does not contain the answer, clearly state that the information is missing.\n\n"
            "=== NEW COMPENSATION DATA MODEL & PRIORITY RULES ===\n"
            "Maintain separate concepts for the following compensation values and NEVER merge, mix, or overwrite them:\n"
            "- awarded_compensation: Amount awarded by the Tribunal/Court (extracted from PDF). E.g. 'Amount Awarded Rs.' indicates this.\n"
            "- claimed_compensation: Amount originally claimed (extracted from PDF). E.g. 'Claim before Tribunal' indicates this.\n"
            "- enhancement_sought: Additional amount requested in appeal (extracted from PDF). E.g. 'Appeal valued at' or 'Enhancement sought' indicates this.\n"
            "- calculated_compensation: Amount computed by the deterministic calculator (supplied in the active workstation context under [Current Deterministic Calculator Math Output]).\n\n"
            "If the PDF contains a tribunal award, use awarded_compensation first. Do NOT replace it with calculated_compensation.\n"
            "The Tribunal award is a judicial fact, whereas the calculator output is a computed estimate. Never overwrite judicially awarded compensation with calculator output.\n\n"
            "=== FORBIDDEN BEHAVIORS ===\n"
            "- NEVER say: 'Calculated amount is the source of truth'.\n"
            "- NEVER say: 'The deterministic calculator output supplied in the context is the absolute single source of truth' or 'the mathematical engine remains the ultimate source of truth'.\n"
            "- NEVER say: 'Compensation amount is ₹X' (only one figure) when multiple compensation figures exist.\n"
            "- NEVER overwrite judicially awarded compensation with calculator output.\n\n"
            "=== CHATBOT RESPONSE RULES ===\n"
            "When the user asks 'What is the compensation amount?' or questions about compensation, or when multiple compensation figures exist, you MUST separate the figures. NEVER answer with only one figure. Instead, respond strictly using the following REQUIRED RESPONSE FORMAT:\n\n"
            "According to the PDF (Judicial Record)\n\n"
            "Awarded Compensation:\n"
            "₹[awarded_compensation]\n\n"
            "Claim Amount:\n"
            "₹[claimed_compensation]\n\n"
            "Enhancement Sought:\n"
            "₹[enhancement_sought]\n\n\n"
            "According to the Compensation Calculator\n\n"
            "Calculated Compensation:\n"
            "₹[calculated_compensation]\n\n\n"
            "Comparison\n\n"
            "Difference:\n"
            "₹[Difference between Calculated Compensation and Awarded Compensation, calculated as calculated_compensation minus awarded_compensation]\n\n"
            "The calculator result is based on the currently populated fields and serves as an analytical estimate. The judicially awarded compensation remains ₹[awarded_compensation] unless modified by a court order.\n\n"
            "=== MATHEMATICAL INTEGRITY RULES ===\n"
            "- Under no circumstances should you compute, recalculate, or override mathematical values, multipliers, or final compensation totals.\n"
            "- If the user asks you to recalculate compensation, apply different multiplier figures, or alter prospects, explicitly instruct them to update the workstation parameters in the left-hand panel.\n\n"
            f"Context:\n{chunks_combined}\n\n"
            f"Question:\n{question_str}"
        )
        
        # 5. Generate LLM Response using configured provider
        from app.services.chatbot.llm_client import generate_response
        ai_response = generate_response(user_prompt)
        
        return {
            "response": ai_response,
            "precedents": precedents
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Chat failed: {str(e)}")

# Simple time-based TTL cache for Qdrant points (Task 12)
qdrant_points_cache = {"timestamp": 0.0, "data": None}

@app.get("/api/qdrant/points")
async def get_qdrant_points():
    """
    Returns collection stats and points from local Qdrant database 
    for visual rendering in the embedded dashboard. Caches results for 30s.
    """
    import time
    
    current_time = time.time()
    if qdrant_points_cache["data"] is not None and (current_time - qdrant_points_cache["timestamp"] < 30.0):
        logger.info("Qdrant points cache hit (30s TTL). Returning cached data.")
        return qdrant_points_cache["data"]

    logger.info("Qdrant points cache miss. Querying database...")
    try:
        client = get_qdrant_client()
        if client is None:
            return {
                "success": False,
                "message": "Qdrant database is currently offline or uninitialized.",
                "collection_name": COLLECTION_NAME,
                "points_count": 0,
                "points": []
            }
            
        try:
            info = client.get_collection(COLLECTION_NAME)
            points_count = info.points_count
            status = info.status
            distance = info.config.params.vectors.distance
            if hasattr(distance, 'value'):
                distance = distance.value
            vector_size = info.config.params.vectors.size
        except Exception as e:
            return {
                "success": True,
                "message": f"Collection not loaded: {str(e)}",
                "collection_name": COLLECTION_NAME,
                "points_count": 0,
                "status": "not_created",
                "points": []
            }

        # Scroll points to get payloads (up to 100 points)
        points_list = []
        if points_count > 0:
            points, _ = client.scroll(
                collection_name=COLLECTION_NAME,
                limit=100,
                with_payload=True,
                with_vectors=False
            )
            for p in points:
                points_list.append({
                    "id": p.id,
                    "payload": p.payload
                })

        response_data = {
            "success": True,
            "collection_name": COLLECTION_NAME,
            "points_count": points_count,
            "status": str(status),
            "distance": str(distance),
            "vector_size": vector_size,
            "points": points_list
        }
        
        # Update cache
        qdrant_points_cache["timestamp"] = time.time()
        qdrant_points_cache["data"] = response_data
        
        return response_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load database points: {str(e)}")
