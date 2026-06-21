"use client";
// ===== Phase 2: Gavel Transition (slam + screen-shake + flash) =====
import { useEffect } from "react";
import { PixelGavel } from "./PixelGavel";

export function GavelTransition({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black">
      <div className="absolute inset-0 animate-screen-shake">
        <div className="absolute inset-0 grid-bg opacity-20" />
      </div>

      <div className="relative flex flex-col items-center gap-6">
        <div className="h-40 w-40 sm:h-56 sm:w-56">
          <PixelGavel slam />
        </div>
        <div className="animate-flash-white absolute inset-0 bg-white" />

        <div className="relative font-mono-terminal text-center">
          <div className="text-glow-gold text-gold text-xl font-bold uppercase tracking-[0.5em] sm:text-3xl">
            Court Adjourned
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.15em] text-white/40">
            Entering the Chamber
          </div>
        </div>
      </div>
    </div>
  );
}
