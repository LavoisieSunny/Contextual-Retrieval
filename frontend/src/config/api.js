const _base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/api\/?$/, "");

export const API_BASE_URL = _base;

// API endpoints
export const ENDPOINTS = {
  HEALTH:           `${_base}/api/v1/health`,
  UPLOAD:           `${_base}/api/v1/upload`,
  CHAT:             `${_base}/api/v1/chatbot`,

  // Compensation specific
  CALCULATE:        `${_base}/api/calculate/`,
  SEARCH_EVALUATE:  `${_base}/api/search/evaluate`,
  CHAT_PDF:         `${_base}/api/chat/pdf`,
  QDRANT_POINTS:    `${_base}/api/qdrant/points`,
  OCR_PROCESS:      `${_base}/api/ocr/process-ocr`,
  OCR_BATCH_UPLOAD: `${_base}/api/ocr/upload-batch`,
  OCR_BATCH_STATUS: `${_base}/api/ocr/batch-status`,
  OCR_AI_RECOVER:   `${_base}/api/ocr/ai-recover`,
  OCR_SUGGEST_CASE: `${_base}/api/ocr/suggest-case-type`,
};

