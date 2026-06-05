import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/shared/Sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Contextual RAG CC",
  description: "Enterprise Document Ingestion and Legal RAG Platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}>
      <body className="h-full bg-slate-950 text-slate-100 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950/10">
          {children}
        </main>
      </body>
    </html>
  );
}
