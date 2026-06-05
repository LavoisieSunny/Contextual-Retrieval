"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UploadCloud, MessageSquare, ShieldAlert, Cpu, Scale } from "lucide-react";
import { ROUTES } from "@/config/routes";

export default function Sidebar() {
  const pathname = usePathname();

  const navigation = [
    { name: "Dashboard", href: ROUTES.DASHBOARD, icon: LayoutDashboard },
    { name: "Document Ingestion", href: ROUTES.UPLOAD, icon: UploadCloud },
    { name: "RAG Chatbot", href: ROUTES.CHATBOT, icon: MessageSquare },
    { name: "Compensation Workstation", href: ROUTES.COMPENSATION, icon: Scale },
  ];

  return (
    <aside className="w-64 bg-slate-900/60 border-r border-slate-800/80 backdrop-blur-xl flex flex-col justify-between shrink-0 h-full">
      <div>
        <div className="h-16 flex items-center px-6 border-b border-slate-800/60 gap-3">
          <Cpu className="h-6 w-6 text-indigo-400 animate-pulse" />
          <span className="font-semibold text-lg bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Contextual RAG
          </span>
        </div>

        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? "bg-indigo-900/40 border border-indigo-500/30 text-indigo-200 shadow-lg shadow-indigo-950/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "text-indigo-400" : "text-slate-400"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800/60 flex items-center gap-3 text-xs text-slate-500 justify-center">
        <ShieldAlert className="h-4 w-4 text-slate-600" />
        <span>Phase 1 Foundation v1.0</span>
      </div>
    </aside>
  );
}
