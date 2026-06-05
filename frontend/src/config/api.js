export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// API endpoints
export const ENDPOINTS = {
  HEALTH: `${API_BASE_URL}/api/v1/health`,
  UPLOAD: `${API_BASE_URL}/api/v1/upload`,
  CHAT: `${API_BASE_URL}/api/v1/chatbot`,

  // Compensation specific
  CALCULATE: `${API_BASE_URL}/api/calculate/`,
  SEARCH_EVALUATE: `${API_BASE_URL}/api/search/evaluate`,
  CHAT_PDF: `${API_BASE_URL}/api/chat/pdf`,
  QDRANT_POINTS: `${API_BASE_URL}/api/qdrant/points`,
  OCR_PROCESS: `${API_BASE_URL}/api/ocr/process-ocr`,
  OCR_BATCH_UPLOAD: `${API_BASE_URL}/api/ocr/upload-batch`,
  OCR_BATCH_STATUS: `${API_BASE_URL}/api/ocr/batch-status`,
  OCR_AI_RECOVER: `${API_BASE_URL}/api/ocr/ai-recover`,
  OCR_SUGGEST_CASE: `${API_BASE_URL}/api/ocr/suggest-case-type`,
};
