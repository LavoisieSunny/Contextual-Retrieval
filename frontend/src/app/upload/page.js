"use client";

import { useState } from "react";
import { UploadCloud, File, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { ENDPOINTS } from "@/config/api";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(null); // 'success', 'error'
  const [message, setMessage] = useState("");
  const [uploadHistory, setUploadHistory] = useState([]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus(null);
      setMessage("");
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setStatus(null);
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(ENDPOINTS.UPLOAD, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage(data.message || "File uploaded successfully!");
        setUploadHistory((prev) => [
          {
            id: data.document_id || Date.now().toString(),
            name: file.name,
            size: (file.size / 1024 / 1024).toFixed(2) + " MB",
            status: "Success",
            message: data.message,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev,
        ]);
        setFile(null);
      } else {
        setStatus("error");
        setMessage(data.detail || "Upload failed. Please check the file size and type.");
      }
    } catch (err) {
      setStatus("error");
      setMessage("Failed to connect to the backend server.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-6 md:p-8 space-y-8">
      <div className="border-b border-slate-800/60 pb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Document Ingestion</h1>
        <p className="text-sm text-slate-400">Ingest documents (.pdf, .docx, .txt) into the vector processing pipeline.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-8 text-center bg-slate-900/20 backdrop-blur-md transition duration-300">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".pdf,.docx,.txt"
                onChange={handleFileChange}
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center space-y-4">
                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
                  <UploadCloud className="h-10 w-10 text-indigo-400" />
                </div>
                <div>
                  <span className="text-indigo-400 hover:text-indigo-300 font-medium">Click to upload</span> or drag and drop
                  <p className="text-xs text-slate-500 mt-1">PDF, DOCX, or TXT (Max 50MB)</p>
                </div>
              </label>

              {file && (
                <div className="mt-6 flex items-center justify-center gap-3 p-3 bg-slate-900/60 border border-slate-850 rounded-xl max-w-md mx-auto">
                  <File className="h-5 w-5 text-indigo-400 shrink-0" />
                  <span className="text-sm text-slate-200 truncate">{file.name}</span>
                  <span className="text-xs text-slate-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!file || uploading}
              className="w-full flex justify-center items-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-medium transition duration-350 disabled:opacity-50 cursor-pointer shadow-lg shadow-indigo-950/40"
            >
              {uploading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processing Document...
                </>
              ) : (
                "Ingest Document"
              )}
            </button>
          </form>

          {status === "success" && (
            <div className="flex gap-3 p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm backdrop-blur-md">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {status === "error" && (
            <div className="flex gap-3 p-4 bg-rose-950/20 border border-rose-500/20 rounded-xl text-rose-400 text-sm backdrop-blur-md">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{message}</span>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="p-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-md h-[400px] flex flex-col">
            <h3 className="font-semibold text-lg text-white mb-4">Ingestion Activity</h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {uploadHistory.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-center text-slate-500">
                  <File className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No documents ingested in this session.</p>
                </div>
              ) : (
                uploadHistory.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-900/80 border border-slate-850 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-200 truncate max-w-[150px]">{item.name}</span>
                      <span className="text-slate-500">{item.timestamp}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Size: {item.size}</span>
                      <span className="text-emerald-400 font-medium">{item.status}</span>
                    </div>
                    <p className="text-slate-500 border-t border-slate-800/40 pt-1.5">{item.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
