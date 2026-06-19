"use client";
// ===== Lawliet entrance animation (admin character) =====
import { useEffect, useRef, useState } from "react";
import { DetectivePortrait } from "./DetectivePortrait";
import { cn } from "@/lib/utils";

export function LawlietEntrance({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");
  const [imgOk, setImgOk] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Play the Lawliet voice sound on entrance
    try {
      const audio = new Audio("/characters/lawliet-voice.mp3");
      audio.volume = 0.8;
      audio.play().catch(() => {
        // Autoplay may be blocked until user interaction; that's OK.
      });
      audioRef.current = audio;
    } catch {
      // ignore audio errors
    }

    const t1 = setTimeout(() => setPhase("hold"), 900);
    const t2 = setTimeout(() => setPhase("exit"), 2400);
    const t3 = setTimeout(onDone, 3200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      audioRef.current?.pause();
    };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black">
      <div className="absolute inset-0 grid-bg opacity-20" />
      {/* radial vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, transparent 30%, rgba(0,0,0,0.8) 80%)",
        }}
      />
      <div
        className={cn(
          "relative flex flex-col items-center gap-6 transition-all duration-700",
          phase === "enter" && "translate-y-8 opacity-0 scale-95",
          phase === "hold" && "translate-y-0 opacity-100 scale-100",
          phase === "exit" && "-translate-x-full opacity-0",
        )}
        style={{ transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}
      >
        {/* portrait with dramatic frame */}
        <div
          className="relative border-2 border-white/30 shadow-2xl"
          style={{
            filter: "contrast(1.15) brightness(1.05)",
            boxShadow: "0 0 60px -10px rgba(212,175,55,0.4), 0 0 100px -20px rgba(0,0,0,0.9)",
          }}
        >
          {imgOk ? (
            <img
              src="/characters/lawliet.png"
              alt="L — Lawliet"
              className="max-h-[55vh] max-w-[80vw] object-contain"
              onError={() => setImgOk(false)}
            />
          ) : (
            <DetectivePortrait className="h-[55vh] w-auto" />
          )}
          {/* scanline overlay on the image */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background:
                "repeating-linear-gradient(to bottom, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 3px)",
            }}
          />
        </div>
        <div className="text-center">
          <div className="text-glow-gold text-gold font-mono-terminal text-3xl font-black uppercase tracking-[0.5em] sm:text-5xl">
            L
          </div>
          <div className="mt-2 font-mono-terminal text-[11px] uppercase tracking-[0.5em] text-white/50">
            I am justice.
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 animate-flash-white" />
    </div>
  );
}
