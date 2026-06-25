"use client";

// ===== Ad Slot — renders an Adsterra display ad when ads are enabled =====
import { useEffect, useRef } from "react";
import { useAds } from "@/lib/ads";
import { cn } from "@/lib/utils";

interface AdSlotProps {
  className?: string;
  label?: string;
}

export function AdSlot({
  className,
  label = "Advertisement",
}: AdSlotProps) {
  const { adsAllowed } = useAds();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!adsAllowed || !containerRef.current || loadedRef.current) return;
    loadedRef.current = true;

    // Adsterra display ad — inject the atOptions config + invoke script
    const container = containerRef.current;

    const opts = document.createElement("script");
    opts.text = `
      atOptions = {
        'key' : '65cc022f40ba08ecc4f05a7085c5873f',
        'format' : 'iframe',
        'height' : 300,
        'width' : 160,
        'params' : {}
      };
    `;
    container.appendChild(opts);

    const invoke = document.createElement("script");
    invoke.src = "https://www.highperformanceformat.com/65cc022f40ba08ecc4f05a7085c5873f/invoke.js";
    invoke.async = true;
    container.appendChild(invoke);
  }, [adsAllowed]);

  if (!adsAllowed) return null;

  return (
    <div
      className={cn(
        "relative flex min-h-[300px] items-center justify-center overflow-hidden border border-white/8 bg-white/[0.02]",
        className,
      )}
      aria-label="advertisement"
    >
      <span className="absolute left-2 top-1.5 font-mono-terminal text-[7px] uppercase tracking-widest text-white/20">
        {label}
      </span>
      <div ref={containerRef} className="flex items-center justify-center" />
    </div>
  );
}
