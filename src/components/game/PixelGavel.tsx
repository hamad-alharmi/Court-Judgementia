"use client";
// ===== Pixel-art Gavel (slams down) =====
import { cn } from "@/lib/utils";

export function PixelGavel({
  className,
  slam = false,
}: {
  className?: string;
  slam?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-full w-full", className)}
      shapeRendering="crispEdges"
      aria-label="Gavel"
      role="img"
    >
      {/* strike block (anvil) */}
      <rect x="18" y="50" width="28" height="6" fill="var(--gold)" />
      <rect x="20" y="48" width="24" height="2" fill="rgba(212,175,55,0.7)" />
      <rect x="22" y="56" width="20" height="2" fill="rgba(255,255,255,0.15)" />

      {/* gavel head + handle group that rotates to slam */}
      <g
        className={slam ? "animate-gavel-slam" : ""}
        style={{ transformOrigin: "32px 44px" }}
      >
        {/* handle */}
        <rect x="30" y="26" width="4" height="20" fill="var(--gold)" />
        <rect x="30" y="26" width="2" height="20" fill="rgba(255,255,255,0.25)" />
        {/* head */}
        <rect x="22" y="18" width="20" height="10" fill="var(--gold)" />
        <rect x="22" y="18" width="20" height="2" fill="rgba(255,255,255,0.5)" />
        <rect x="22" y="26" width="20" height="2" fill="rgba(0,0,0,0.25)" />
        {/* caps */}
        <rect x="20" y="20" width="2" height="6" fill="var(--gold)" />
        <rect x="42" y="20" width="2" height="6" fill="var(--gold)" />
      </g>
    </svg>
  );
}
