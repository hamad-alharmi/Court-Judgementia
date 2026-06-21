"use client";
// ===== Scales of Justice — clean, smooth, tilts continuously =====
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
      aria-label="Scales of Justice"
      role="img"
    >
      {/* base — rounded */}
      <rect x="18" y="54" width="28" height="4" rx="2" fill="var(--gold)" />
      <rect x="22" y="50" width="20" height="4" rx="2" fill="var(--gold)" />
      {/* column */}
      <rect x="30" y="14" width="4" height="40" rx="2" fill="var(--gold)" />
      <circle cx="32" cy="12" r="3" fill="var(--gold)" />

      {/* tilting crossbar + pans */}
      <g
        className={tilt ? "animate-scale-tilt" : ""}
        style={{ transformOrigin: "32px 14px" }}
      >
        {/* crossbar — rounded */}
        <rect x="8" y="12" width="48" height="3" rx="1.5" fill="var(--gold)" />
        {/* end caps — rounded circles */}
        <circle cx="9" cy="13.5" r="3" fill="var(--gold)" />
        <circle cx="55" cy="13.5" r="3" fill="var(--gold)" />

        {/* left chain */}
        <line x1="9" y1="16" x2="9" y2="32" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        {/* left pan — rounded dish */}
        <path d="M 2 32 Q 9 40 16 32" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" />
        <path d="M 4 33 Q 9 38 14 33" fill="rgba(212,175,55,0.2)" stroke="none" />

        {/* right chain */}
        <line x1="55" y1="16" x2="55" y2="32" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        {/* right pan — rounded dish */}
        <path d="M 48 32 Q 55 40 62 32" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" />
        <path d="M 50 33 Q 55 38 60 33" fill="rgba(212,175,55,0.2)" stroke="none" />
      </g>
    </svg>
  );
}
