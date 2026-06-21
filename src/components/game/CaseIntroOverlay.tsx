"use client";
// ===== Case Intro Overlay — explains the case + evidence before trial =====
import { Button } from "@/components/ui/button";
import type { CaseScenario } from "@/lib/types";
import { ShieldAlert, ScrollText, HelpCircle, FileText, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EvidenceSide } from "@/lib/types";

const SIDE_META: Record<EvidenceSide, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  prosecution: { label: "PROSECUTION", color: "#e0524a", icon: ShieldAlert },
  defense: { label: "DEFENSE", color: "#3fb98a", icon: ScrollText },
  ambiguous: { label: "AMBIGUOUS", color: "#d4af37", icon: HelpCircle },
};

export function CaseIntroOverlay({
  scenario,
  statementCount,
  onBegin,
  isHost,
}: {
  scenario: CaseScenario;
  statementCount: number;
  onBegin: () => void;
  isHost: boolean;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/90 p-4 backdrop-blur-sm">
      <div className="panel sharp glow-gold my-auto w-full max-w-2xl p-6 sm:p-8">
        <div className="mb-1 font-mono-terminal text-[10px] uppercase tracking-[0.15em] text-gold">
          Case File Briefing
        </div>
        <h2 className="text-glow-gold text-gold font-mono-terminal text-xl font-bold sm:text-2xl">
          {scenario.title}
        </h2>
        {scenario.generated && (
          <span className="mt-1 inline-block font-mono-terminal text-[9px] uppercase tracking-widest text-white/40">
            ◂ AI-Generated · theme: {scenario.theme || "cyber"}
          </span>
        )}

        <div className="mt-4 border-l-2 border-gold/40 pl-4">
          <div className="mb-1 font-mono-terminal text-[10px] uppercase tracking-[0.06em] text-white/50">
            The Facts
          </div>
          <p className="font-mono-terminal text-sm leading-relaxed text-white/80">
            {scenario.facts}
          </p>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-gold" />
            <span className="font-mono-terminal text-[10px] uppercase tracking-[0.06em] text-white/50">
              Evidence Exhibits ({scenario.evidence.length})
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {scenario.evidence.map((e, i) => {
              const meta = SIDE_META[e.side];
              const Icon = meta.icon;
              return (
                <div
                  key={e.id}
                  className="sharp border border-white/15 bg-white/[0.02] p-3"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: meta.color }} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-terminal text-xs font-bold text-white">
                          {i + 1}. {e.title}
                        </span>
                        <span
                          className="sharp border px-1.5 py-0.5 font-mono-terminal text-[8px] font-bold uppercase tracking-widest"
                          style={{ color: meta.color, borderColor: meta.color }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono-terminal text-[9px] uppercase tracking-widest text-white/30">
                        {e.assetType}
                      </div>
                      <p className="mt-1.5 font-mono-terminal text-[11px] leading-relaxed text-white/60">
                        {e.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div className="font-mono-terminal text-[10px] uppercase tracking-widest text-white/40">
            Trial format: {statementCount} statement{statementCount > 1 ? "s" : ""} per side
          </div>
          {isHost ? (
            <Button
              onClick={onBegin}
              className="sharp h-11 border border-gold bg-gold px-6 font-mono-terminal text-xs font-bold uppercase tracking-[0.06em] text-black hover:bg-gold/85"
            >
              Enter Court
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex items-center gap-2 font-mono-terminal text-xs uppercase tracking-[0.04em] text-white/60">
              <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
              Waiting for host to open court...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
