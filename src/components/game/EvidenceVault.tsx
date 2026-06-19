"use client";
// ===== Evidence Vault (right column, 35%) =====
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, FileText, ShieldAlert, ScrollText, HelpCircle } from "lucide-react";
import type { EvidenceItem, EvidenceSide } from "@/lib/types";
import { cn } from "@/lib/utils";

function SideIcon({
  side,
  className,
  style,
}: {
  side: EvidenceSide;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (side === "prosecution") return <ShieldAlert className={className} style={style} />;
  if (side === "defense") return <ScrollText className={className} style={style} />;
  return <HelpCircle className={className} style={style} />;
}

const SIDE_META: Record<
  EvidenceSide,
  { label: string; color: string; border: string; bg: string }
> = {
  prosecution: {
    label: "PROSECUTION",
    color: "#e0524a",
    border: "border-red-500/50",
    bg: "bg-red-500/5",
  },
  defense: {
    label: "DEFENSE",
    color: "#3fb98a",
    border: "border-emerald-500/50",
    bg: "bg-emerald-500/5",
  },
  ambiguous: {
    label: "AMBIGUOUS",
    color: "#d4af37",
    border: "border-gold/50",
    bg: "bg-gold/5",
  },
};

export function EvidenceVault({
  evidence,
  canPresent,
  presentedIds,
  onPresent,
}: {
  evidence: EvidenceItem[];
  canPresent: boolean;
  presentedIds: string[];
  onPresent: (e: EvidenceItem) => void;
}) {
  return (
    <aside className="panel sharp flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-gold" />
          <h2 className="font-mono-terminal text-xs font-bold uppercase tracking-[0.2em] text-white">
            Evidence Vault
          </h2>
        </div>
        <span className="font-mono-terminal text-[9px] uppercase tracking-widest text-white/30">
          {evidence.length} exhibits
        </span>
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto pr-1">
        {evidence.map((e) => (
          <EvidenceCard
            key={e.id}
            evidence={e}
            canPresent={canPresent}
            presented={presentedIds.includes(e.id)}
            onPresent={() => onPresent(e)}
          />
        ))}
      </div>

      {!canPresent && (
        <p className="border-t border-white/10 pt-2 text-center font-mono-terminal text-[9px] uppercase tracking-widest text-white/25">
          Awaiting your turn to present
        </p>
      )}
    </aside>
  );
}

function EvidenceCard({
  evidence,
  canPresent,
  presented,
  onPresent,
}: {
  evidence: EvidenceItem;
  canPresent: boolean;
  presented: boolean;
  onPresent: () => void;
}) {
  const [open, setOpen] = useState(true);
  const meta = SIDE_META[evidence.side];

  return (
    <div className={cn("sharp border", meta.border, meta.bg)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-2 p-3 text-left"
      >
        <SideIcon side={evidence.side} className="mt-0.5 h-4 w-4 shrink-0" style={{ color: meta.color }} />
        <div className="flex-1">
          <div className="font-mono-terminal text-xs font-bold leading-snug text-white">
            {evidence.title}
          </div>
          <div className="mt-0.5 font-mono-terminal text-[9px] uppercase tracking-widest text-white/40">
            {evidence.assetType}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-white/40 transition",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="border-t border-white/10 px-3 pb-3 pt-2">
          <p className="font-mono-terminal text-[11px] leading-relaxed text-white/60">
            {evidence.description}
          </p>

          <div className="mt-2 flex items-center justify-between">
            <span
              className="sharp border px-2 py-0.5 font-mono-terminal text-[8px] font-bold uppercase tracking-widest"
              style={{ color: meta.color, borderColor: meta.color }}
            >
              {meta.label}
            </span>
            {presented && (
              <span className="font-mono-terminal text-[8px] uppercase tracking-widest text-gold">
                ◂ Presented
              </span>
            )}
          </div>

          {canPresent && (
            <Button
              type="button"
              onClick={onPresent}
              className="sharp mt-3 h-8 w-full border border-gold bg-transparent font-mono-terminal text-[10px] font-bold uppercase tracking-[0.2em] text-gold hover:bg-gold hover:text-black"
            >
              {presented ? "Re-Present Evidence" : "Present Evidence"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
