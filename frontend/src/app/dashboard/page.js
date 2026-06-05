"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, Cpu, Database, HardDrive, FileText, BarChart3 } from "lucide-react";
import { ENDPOINTS } from "@/config/api";

export default function Dashboard() {
  const [health, setHealth] = useState({ api: "loading", qdrant: "loading", storage: "loading" });
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch(ENDPOINTS.HEALTH);
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      } else {
        setHealth({ api: "unhealthy", qdrant: "unhealthy", storage: "unhealthy" });
      }
    } catch (err) {
      setHealth({ api: "unhealthy", qdrant: "unhealthy", storage: "unhealthy" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const getStatusIcon = (status) => {
    if (status === "loading") return <RefreshCw className="h-5 w-5 text-slate-400 animate-spin" />;
    if (status === "healthy") return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
    return <XCircle className="h-5 w-5 text-rose-500 animate-pulse" />;
  };

  const getStatusColor = (status) => {
    if (status === "loading") return "border-slate-800 bg-slate-900/30";
    if (status === "healthy") return "border-emerald-500/20 bg-emerald-950/10 shadow-lg shadow-emerald-950/20";
    return "border-rose-500/20 bg-rose-950/10 shadow-lg shadow-rose-950/20";
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-6 md:p-8 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800/60 pb-5 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">System Dashboard</h1>
          <p className="text-sm text-slate-400">Monitor system status, health states, and performance statistics.</p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-850 hover:bg-slate-800 rounded-xl text-sm font-medium transition duration-300 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Status
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* API Health */}
        <div className={`p-6 border rounded-2xl backdrop-blur-md transition-all duration-300 ${getStatusColor(health.api)}`}>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
              <Cpu className="h-6 w-6 text-indigo-400" />
            </div>
            {getStatusIcon(health.api)}
          </div>
          <h3 className="font-semibold text-lg text-white">FastAPI Service</h3>
          <p className="text-xs text-slate-400 mt-1">Core endpoints and middleware handlers.</p>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-slate-505">Status:</span>
            <span className={`text-xs font-semibold uppercase tracking-wider ${health.api === "healthy" ? "text-emerald-400" : "text-rose-450"}`}>
              {health.api}
            </span>
          </div>
        </div>

        {/* Qdrant DB Health */}
        <div className={`p-6 border rounded-2xl backdrop-blur-md transition-all duration-300 ${getStatusColor(health.qdrant)}`}>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
              <Database className="h-6 w-6 text-purple-400" />
            </div>
            {getStatusIcon(health.qdrant)}
          </div>
          <h3 className="font-semibold text-lg text-white">Qdrant Vector DB</h3>
          <p className="text-xs text-slate-400 mt-1">Vector stores and collection lookups.</p>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-slate-505">Status:</span>
            <span className={`text-xs font-semibold uppercase tracking-wider ${health.qdrant === "healthy" ? "text-emerald-400" : "text-rose-450"}`}>
              {health.qdrant}
            </span>
          </div>
        </div>

        {/* Local Storage Health */}
        <div className={`p-6 border rounded-2xl backdrop-blur-md transition-all duration-300 ${getStatusColor(health.storage)}`}>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
              <HardDrive className="h-6 w-6 text-pink-400" />
            </div>
            {getStatusIcon(health.storage)}
          </div>
          <h3 className="font-semibold text-lg text-white">Disk Storage</h3>
          <p className="text-xs text-slate-400 mt-1">Read/write access to folder paths.</p>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-slate-505">Status:</span>
            <span className={`text-xs font-semibold uppercase tracking-wider ${health.storage === "healthy" ? "text-emerald-400" : "text-rose-450"}`}>
              {health.storage}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="p-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="h-5 w-5 text-indigo-400" />
              <h3 className="font-semibold text-lg text-white">System Metrics (Mocked)</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm border-b border-slate-800/40 pb-2">
                <span className="text-slate-400">Total Documents Ingested</span>
                <span className="font-semibold text-slate-200">12</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-800/40 pb-2">
                <span className="text-slate-400">Generated Text Chunks</span>
                <span className="font-semibold text-slate-200">2,410</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-800/40 pb-2">
                <span className="text-slate-400">Qdrant Indexed Vectors</span>
                <span className="font-semibold text-slate-200">2,410</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-6">
            Metrics are generated locally. In future phases, these counts will query the Postgres DB and Qdrant client collections directly.
          </p>
        </div>

        <div className="p-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-md">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-5 w-5 text-purple-400" />
            <h3 className="font-semibold text-lg text-white">Recent System Activity</h3>
          </div>
          <div className="space-y-3 font-mono text-xs text-slate-400">
            <div className="flex gap-2">
              <span className="text-slate-600">[2026-06-04 15:38]</span>
              <span className="text-indigo-400">SYSTEM:</span>
              <span>Phase 1 skeleton initialized successfully.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-slate-600">[2026-06-04 15:39]</span>
              <span className="text-purple-400">API:</span>
              <span>Loaded settings from .env file successfully.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-slate-600">[2026-06-04 15:40]</span>
              <span className="text-emerald-400">QDRANT:</span>
              <span>Lazy initialization configuration established.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
