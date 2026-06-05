import Link from "next/link";
import { Cpu, ArrowRight } from "lucide-react";
import { ROUTES } from "@/config/routes";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 text-center">
      <div className="max-w-3xl space-y-8 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
        
        <div className="flex justify-center">
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-md">
            <Cpu className="h-12 w-12 text-indigo-400" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">
            Contextual RAG Platform
          </h1>
          <p className="text-base sm:text-lg text-slate-400 max-w-xl mx-auto">
            Enterprise-grade foundation integrating Next.js 15, FastAPI, and Qdrant. Upload documents, extract chunks, and query case intelligence.
          </p>
        </div>

        <div className="flex justify-center">
          <Link
            href={ROUTES.DASHBOARD}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-medium transition-all duration-300 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 hover:-translate-y-0.5 group"
          >
            Open Dashboard
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}
