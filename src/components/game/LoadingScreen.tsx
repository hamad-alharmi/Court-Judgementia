"use client";
// ===== Phase 1: Loading Screen =====
import { useEffect, useState } from "react";
import { PixelScales } from "./PixelScales";

export function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const dur = 2600;
    const iv = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / dur);
      setPct(Math.round(t * 100));
      if (t >= 1) {
        clearInterval(iv);
        setTimeout(onComplete, 350);
      }
    }, 40);
    return () => clearInterval(iv);
  }, [onComplete]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black scanlines">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="relative flex flex-col items-center gap-8 px-6">
        <div className="h-32 w-32 sm:h-40 sm:w-40">
          <PixelScales />
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-glow-gold text-gold font-mono-terminal text-2xl font-bold tracking-[0.4em] sm:text-4xl">
            JUDGEMENTIA
          </h1>
          <p className="font-mono-terminal text-[10px] uppercase tracking-[0.5em] text-white/50 sm:text-xs">
            Cyber Legal Trial Protocol
          </p>
        </div>

        {/* boot bar */}
        <div className="w-72 max-w-[80vw] sm:w-96">
          <div className="mb-2 flex items-center justify-between font-mono-terminal text-[10px] uppercase tracking-widest text-white/40">
            <span>Initializing Bench</span>
            <span className="text-gold">{pct}%</span>
          </div>
          <div className="h-1.5 w-full border border-white/15 bg-white/5">
            <div
              className="h-full bg-gold transition-[width] duration-100"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-3 font-mono-terminal text-[10px] text-white/30">
            <BootLines pct={pct} />
          </div>
        </div>
      </div>
    </div>
  );
}

function BootLines({ pct }: { pct: number }) {
  const lines = [
    "> mounting evidence vault ............ OK",
    "> calibrating rhetoric engine ....... OK",
    "> summoning Chief Justice Vanguard .. OK",
    "> opening realtime docket .......... OK",
  ];
  const visible = Math.floor((pct / 100) * lines.length);
  return (
    <div className="space-y-0.5">
      {lines.slice(0, Math.max(1, visible)).map((l) => (
        <div key={l} className="text-white/40">
          {l}
        </div>
      ))}
      <div className="text-gold">
        {"> protocol ready"}
        <span className="animate-blink">_</span>
      </div>
    </div>
  );
}
