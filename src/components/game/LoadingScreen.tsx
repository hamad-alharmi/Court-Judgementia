"use client";
// ===== Phase 1: Loading Screen — typewriter boot + particle grid =====
import { useEffect, useMemo, useRef, useState } from "react";
import { PixelScales } from "./PixelScales";

const BOOT_LINES = [
  "> mounting evidence vault ............ OK",
  "> calibrating rhetoric engine ....... OK",
  "> summoning Chief Justice Vanguard .. OK",
  "> opening realtime docket .......... OK",
];

export function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [pct, setPct] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // mount the particle field on the client only (avoids hydration mismatch
    // from floating-point precision differences in the seeded PRNG)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

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
      {mounted && <ParticleField />}
      {/* radial gold glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, color-mix(in oklab, var(--gold) 18%, transparent), transparent 55%)",
        }}
      />
      <div className="relative flex flex-col items-center gap-8 px-6">
        <div className="h-32 w-32 sm:h-40 sm:w-40 animate-flicker">
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
            <BootTypewriter pct={pct} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Typewriter that progressively reveals each boot line character by character,
 * driven by the global progress percentage so the boot completes as the bar fills.
 */
function BootTypewriter({ pct }: { pct: number }) {
  // total chars across all lines
  const totalChars = useMemo(
    () => BOOT_LINES.reduce((n, l) => n + l.length, 0) + BOOT_LINES.length, // +1 each for newline
    [],
  );
  const revealed = Math.floor((pct / 100) * totalChars);

  // build rendered lines based on how many chars are revealed
  let used = 0;
  const lines: { text: string; done: boolean }[] = [];
  for (const line of BOOT_LINES) {
    const remaining = revealed - used;
    if (remaining <= 0) break;
    const slice = line.slice(0, Math.min(line.length, remaining));
    const done = remaining >= line.length;
    lines.push({ text: slice, done });
    used += line.length + 1; // account for the (virtual) newline
  }

  const allDone = lines.length === BOOT_LINES.length && lines[lines.length - 1]?.done;

  return (
    <div className="space-y-0.5">
      {lines.map((l, i) => (
        <div key={i} className={l.done ? "text-white/55" : "text-white/40"}>
          {l.text}
          {!l.done && <span className="animate-blink text-gold">▌</span>}
        </div>
      ))}
      {allDone && (
        <div className="text-gold">
          {"> protocol ready"}
          <span className="animate-blink">_</span>
        </div>
      )}
    </div>
  );
}

/**
 * Lightweight particle field: drifting gold/white dots behind the boot screen.
 * Pure CSS-driven (no canvas) so it stays cheap.
 */
function ParticleField() {
  const ref = useRef<HTMLDivElement>(null);
  // 28 particles with deterministic pseudo-random positions/sizes/delays
  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        // simple seeded PRNG (LCG) for stable SSR + CSR
        const seed = (i + 1) * 9301;
        const r = (n: number) => {
          const x = Math.sin(seed + n) * 10000;
          return x - Math.floor(x);
        };
        return {
          left: Math.round(r(1) * 1000) / 10,
          top: Math.round(r(2) * 1000) / 10,
          size: Math.round((1 + r(3) * 1.5) * 100) / 100,
          delay: Math.round(r(4) * 600) / 100,
          duration: Math.round((6 + r(5) * 8) * 100) / 100,
          gold: r(6) > 0.65,
          opacity: Math.round((0.15 + r(7) * 0.35) * 1000) / 1000,
        };
      }),
    [],
  );

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <style>{`
        @keyframes particle-drift {
          0% { transform: translate(0, 0); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translate(0, -28px); opacity: 0; }
        }
      `}</style>
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.gold ? "var(--gold)" : "rgba(255,255,255,0.7)",
            opacity: p.opacity,
            animation: `particle-drift ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
