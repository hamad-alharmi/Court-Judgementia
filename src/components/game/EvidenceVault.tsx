"use client";
// ===== Evidence Vault (right column, 35%) =====
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  FileText,
  ShieldAlert,
  ScrollText,
  HelpCircle,
  FolderLock,
} from "lucide-react";
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
  { label: string; color: string; border: string; bg: string; tagBg: string }
> = {
  prosecution: {
    label: "PROSECUTION",
    color: "#e0524a",
    border: "border-red-500/50",
    bg: "bg-red-500/5",
    tagBg: "rgba(224,82,74,0.12)",
  },
  defense: {
    label: "DEFENSE",
    color: "#3fb98a",
    border: "border-emerald-500/50",
    bg: "bg-emerald-500/5",
    tagBg: "rgba(63,185,138,0.12)",
  },
  ambiguous: {
    label: "AMBIGUOUS",
    color: "#d4af37",
    border: "border-gold/50",
    bg: "bg-gold/5",
    tagBg: "rgba(212,175,55,0.12)",
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
    <aside className="premium-card sharp flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <FolderLock className="h-4 w-4 text-gold" />
          <h2 className="font-mono-terminal text-xs font-bold uppercase tracking-[0.25em] text-white">
            Evidence Vault
          </h2>
        </div>
        <span className="sharp border border-white/15 px-2 py-0.5 font-mono-terminal text-[9px] uppercase tracking-widest text-white/40">
          {evidence.length} exhibits
        </span>
      </div>

      <div className="fade-mask-b flex flex-col gap-2 overflow-y-auto pr-1">
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
        <div className="border-t border-white/10 pt-3 text-center">
          <div className="flex items-center justify-center gap-2 font-mono-terminal text-[9px] uppercase tracking-widest text-white/25">
            <span className="h-1 w-1 animate-blink bg-white/30" />
            Awaiting your turn to present
            <span className="h-1 w-1 animate-blink bg-white/30" />
          </div>
        </div>
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
    <motion.div
      layout
      className={cn(
        "group sharp relative overflow-hidden border-l-2 bg-gradient-to-r to-transparent transition-all",
        meta.border,
        meta.bg,
        presented && "ring-1 ring-gold/30",
      )}
      style={{ borderLeftColor: meta.color, borderLeftWidth: "3px" }}
    >
      {/* Hover sheen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent transition-transform duration-500 group-hover:translate-x-full"
      />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex w-full items-start gap-2.5 p-3 text-left"
      >
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center border"
          style={{ borderColor: meta.color, background: meta.tagBg }}
        >
          <SideIcon side={evidence.side} className="h-3.5 w-3.5" style={{ color: meta.color }} />
        </div>
        <div className="flex-1">
          <div className="font-mono-terminal text-xs font-bold leading-snug text-white transition-colors group-hover:text-gold">
            {evidence.title}
          </div>
          <div className="mt-0.5 font-mono-terminal text-[9px] uppercase tracking-widest text-white/40">
            {evidence.assetType}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-white/40 transition-transform duration-200",
            open && "rotate-180 text-gold",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 px-3 pb-3 pt-2.5">
              <p className="font-mono-terminal text-[11px] leading-relaxed text-white/60">
                {evidence.description}
              </p>

              <div className="mt-2.5 flex items-center justify-between">
                <span
                  className="sharp flex items-center gap-1 border px-2 py-0.5 font-mono-terminal text-[8px] font-bold uppercase tracking-widest"
                  style={{ color: meta.color, borderColor: meta.color, background: meta.tagBg }}
                >
                  <span className="h-1 w-1" style={{ background: meta.color }} />
                  {meta.label}
                </span>
                {presented && (
                  <span className="flex items-center gap-1 font-mono-terminal text-[8px] font-bold uppercase tracking-widest text-gold">
                    <span className="h-1 w-1 animate-pulse-gold rounded-full bg-gold" />
                    Presented
                  </span>
                )}
              </div>

              {canPresent && (
                <Button
                  type="button"
                  onClick={onPresent}
                  className={cn(
                    "sharp group mt-3 h-9 w-full border font-mono-terminal text-[10px] font-bold uppercase tracking-[0.25em] transition-all",
                    presented
                      ? "border-gold/40 bg-transparent text-gold/80 hover:border-gold hover:bg-gold/10 hover:shadow-[0_0_18px_-6px_var(--gold)]"
                      : "border-gold bg-transparent text-gold hover:bg-gold hover:text-black hover:shadow-[0_0_24px_-4px_var(--gold)]",
                  )}
                >
                  <FileText className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
                  {presented ? "Re-Present" : "Present Evidence"}
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
