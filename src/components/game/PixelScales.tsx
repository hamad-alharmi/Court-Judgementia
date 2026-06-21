"use client";
// ===== Pixel-art Scales of Justice (tilts continuously) =====
import { cn } from "@/lib/utils";

export function PixelScales({
  className,
  tilt = true,
}: {
  className?: string;
  tilt?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-full w-full", className)}
      shapeRendering="crispEdges"
      aria-label="Scales of Justice"
      role="img"
    >
      {/* base */}
      <rect x="20" y="54" width="24" height="4" fill="var(--gold)" />
      <rect x="24" y="50" width="16" height="4" fill="var(--gold)" />
      {/* column */}
      <rect x="30" y="14" width="4" height="40" fill="var(--gold)" />
      <rect x="28" y="12" width="8" height="4" fill="var(--gold)" />

      {/* tilting crossbar + pans */}
      <g
        className={tilt ? "animate-scale-tilt" : ""}
        style={{ transformOrigin: "32px 14px" }}
      >
        {/* crossbar */}
        <rect x="10" y="12" width="44" height="4" fill="var(--gold)" />
        {/* end caps */}
        <rect x="8" y="10" width="6" height="8" fill="var(--gold)" />
        <rect x="50" y="10" width="6" height="8" fill="var(--gold)" />

        {/* left chains */}
        <rect x="11" y="18" width="2" height="14" fill="rgba(255,255,255,0.85)" />
        <rect x="11" y="18" width="2" height="2" fill="var(--gold)" />
        {/* left pan */}
        <rect x="6" y="32" width="12" height="2" fill="var(--gold)" />
        <rect x="8" y="34" width="8" height="2" fill="rgba(212,175,55,0.7)" />
        <rect x="7" y="30" width="2" height="2" fill="rgba(255,255,255,0.6)" />
        <rect x="15" y="30" width="2" height="2" fill="rgba(255,255,255,0.6)" />

        {/* right chains */}
        <rect x="51" y="18" width="2" height="14" fill="rgba(255,255,255,0.85)" />
        <rect x="51" y="18" width="2" height="2" fill="var(--gold)" />
        {/* right pan */}
        <rect x="46" y="32" width="12" height="2" fill="var(--gold)" />
        <rect x="48" y="34" width="8" height="2" fill="rgba(212,175,55,0.7)" />
        <rect x="47" y="30" width="2" height="2" fill="rgba(255,255,255,0.6)" />
        <rect x="55" y="30" width="2" height="2" fill="rgba(255,255,255,0.6)" />
      </g>
    </svg>
  );
}
