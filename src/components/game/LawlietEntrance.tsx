"use client";
// ===== Lawliet entrance animation (admin character) =====
import { useEffect, useState } from "react";
import { DetectivePortrait } from "./DetectivePortrait";
import { cn } from "@/lib/utils";

export function LawlietEntrance({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 900);
    const t2 = setTimeout(() => setPhase("exit"), 2400);
    const t3 = setTimeout(onDone, 3200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black">
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div
        className={cn(
          "relative flex flex-col items-center gap-4 transition-all duration-700",
          phase === "enter" && "translate-y-8 opacity-0 scale-95",
          phase === "hold" && "translate-y-0 opacity-100 scale-100",
          phase === "exit" && "-translate-x-full opacity-0",
        )}
        style={{ transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}
      >
        <div
          className="h-[60vh] max-h-[520px] w-auto border border-white/20 shadow-2xl"
          style={{ filter: "contrast(1.1)" }}
        >
          {imgOk ? (
            <img
              src="/characters/lawliet.png"
              alt="L"
              className="h-full w-auto"
              onError={() => setImgOk(false)}
            />
          ) : (
            <DetectivePortrait className="h-full w-auto" />
          )}
        </div>
        <div className="text-center">
          <div className="text-glow-gold text-gold font-mono-terminal text-2xl font-black uppercase tracking-[0.4em] sm:text-3xl">
            L
          </div>
          <div className="mt-1 font-mono-terminal text-[10px] uppercase tracking-[0.4em] text-white/40">
            I am justice.
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 animate-flash-white" />
    </div>
  );
}
