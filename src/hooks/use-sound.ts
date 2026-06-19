"use client";
import { useCallback, useMemo, useRef } from "react";

/**
 * useSound — UI sound effects via the Web Audio API.
 * All tones are generated programmatically (no external files needed).
 * Each call is wrapped so that any failure (AudioContext blocked,
 * SSR environment, etc.) silently no-ops — sounds should never break
 * the game flow.
 */
export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      try {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctor) return null;
        ctxRef.current = new Ctor();
      } catch {
        return null;
      }
    }
    // Some browsers start the context in a "suspended" state until a
    // user gesture; try to resume so the first tone is audible.
    try {
      if (ctxRef.current.state === "suspended") {
        void ctxRef.current.resume();
      }
    } catch {
      /* ignore */
    }
    return ctxRef.current;
  }, []);

  const playTone = useCallback(
    (
      frequency: number,
      duration: number,
      type: OscillatorType = "sine",
      volume = 0.1,
    ) => {
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch {
        /* silently fail — sounds are non-essential */
      }
    },
    [getCtx],
  );

  const sounds = useMemo(
    () => ({
      click: () => playTone(800, 0.05, "square", 0.05),
      turnStart: () => {
        playTone(523, 0.1);
        setTimeout(() => playTone(659, 0.15), 100);
      },
      fileStatement: () => playTone(440, 0.08, "sine", 0.08),
      objection: () => {
        playTone(200, 0.15, "sawtooth", 0.1);
        setTimeout(() => playTone(150, 0.2, "sawtooth", 0.1), 150);
      },
      sustained: () => {
        playTone(659, 0.1);
        setTimeout(() => playTone(784, 0.2), 100);
      },
      overruled: () => {
        playTone(300, 0.1, "sawtooth");
        setTimeout(() => playTone(200, 0.2, "sawtooth"), 100);
      },
      verdict: () => {
        playTone(523, 0.15);
        setTimeout(() => playTone(659, 0.15), 150);
        setTimeout(() => playTone(784, 0.3), 300);
      },
      evidence: () => playTone(1200, 0.04, "sine", 0.06),
      timer: () => playTone(1000, 0.03, "square", 0.03),
    }),
    [playTone],
  );

  return sounds;
}
