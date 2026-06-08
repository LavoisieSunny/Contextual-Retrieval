"use client";

import { useState, useRef, useEffect } from "react";
import { Send, User, Bot, RefreshCw, FileText } from "lucide-react";
import { ENDPOINTS } from "@/config/api";

export default function ChatbotPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I am your Contextual RAG Assistant. How can I help you analyze legal factors and calculate case values today?",
      citations: []
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    
    const newMessages = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const history = newMessages
        .slice(0, -1)
        .map(msg => ({ role: msg.role, content: msg.content }));

      const res = await fetch(ENDPOINTS.CHAT_PDF, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage,
          message: userMessage,
          history: history
        })
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.response || data.answer || "";
        const rawCitations = data.precedents || data.citations || [];
        const citations = rawCitations.map(p => ({
          document_name: p.filename || p.document_name || "Unknown Document",
          page: p.metadata?.page || p.page || 1
        }));

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: content,
            citations: citations
          }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I received an error status from the server. Please verify that the API backend is running.",
            citations: []
          }
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Failed to connect to the chatbot service. Ensure the FastAPI backend is running.",
          citations: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <div className="border-b border-slate-800/60 p-6 md:px-8 shrink-0">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">RAG Chatbot</h1>
        <p className="text-sm text-slate-400">Consult document content and analyze compensation metrics with citation audit logs.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg, index) => (
            <div key={index} className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="h-9 w-9 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5 text-indigo-400" />
                </div>
              )}

              <div className={`max-w-[75%] rounded-2xl p-4 border space-y-3 backdrop-blur-md transition duration-300 ${
                msg.role === "user"
                  ? "bg-indigo-950/20 border-indigo-500/25 text-indigo-150 shadow-md shadow-indigo-950/20"
                  : "bg-slate-900/40 border-slate-800 text-slate-200"
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-line text-slate-300">{msg.content}</p>

                {msg.citations && msg.citations.length > 0 && (
                  <div className="border-t border-slate-800/60 pt-3 mt-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Sources Referenced:</span>
                    <div className="flex flex-wrap gap-2">
                      {msg.citations.map((cite, cIdx) => (
                        <div key={cIdx} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950/60 border border-slate-850 rounded-lg text-xs text-indigo-300">
                          <FileText className="h-3 w-3 text-indigo-400" />
                          <span>{cite.document_name}</span>
                          <span className="text-slate-500 font-mono">(p. {cite.page})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="h-9 w-9 bg-purple-650/20 border border-purple-550/30 rounded-xl flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-purple-450" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-4 justify-start">
              <div className="h-9 w-9 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center shrink-0">
                <Bot className="h-5 w-5 text-indigo-400" />
              </div>
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex items-center gap-2">
                <span className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce"></span>
                <span className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-6 border-t border-slate-800/60 bg-slate-950/40 shrink-0">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Ask a question about legal factor extraction or compensation formulas..."
            className="flex-1 bg-slate-900/50 border border-slate-850 hover:border-slate-800 focus:border-indigo-500/50 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition duration-300 cursor-pointer shadow-lg shadow-indigo-950/30"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
