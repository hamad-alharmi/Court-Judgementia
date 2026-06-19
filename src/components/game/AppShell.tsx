"use client";
// ===== AppShell — sticky-footer layout wrapper =====
import { DATA_MODE } from "@/lib/api";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-black">
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-black px-4 py-4">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 sm:flex-row">
        <div className="font-mono-terminal text-[9px] uppercase tracking-[0.25em] text-white/30">
          JUDGEMENTIA · Cyber Legal Trial Protocol
        </div>
        <div className="flex items-center gap-4 font-mono-terminal text-[9px] uppercase tracking-[0.2em] text-white/25">
          <span>
            Backend:{" "}
            <span className={DATA_MODE === "supabase" ? "text-emerald-400" : "text-amber-400"}>
              {DATA_MODE === "supabase" ? "Supabase" : "Local Mock"}
            </span>
          </span>
          <span className="hidden sm:inline">Chief Justice Vanguard presiding</span>
        </div>
      </div>
    </footer>
  );
}
