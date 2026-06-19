"use client";
// ===== Pixel Portrait — varies by archetype + accent =====
import { cn } from "@/lib/utils";

export const ARCHETYPES = [
  "advocate",
  "inquisitor",
  "magister",
  "warden",
  "silencer",
] as const;

export const ACCENTS = [
  { id: "gold", label: "Gold", color: "#d4af37" },
  { id: "crimson", label: "Crimson", color: "#e0524a" },
  { id: "jade", label: "Jade", color: "#3fb98a" },
  { id: "silver", label: "Silver", color: "#c7c9d1" },
  { id: "amber", label: "Amber", color: "#f08a24" },
] as const;

const ACCENT_COLOR: Record<string, string> = Object.fromEntries(
  ACCENTS.map((a) => [a.id, a.color]),
);

export function accentColor(id: string): string {
  return ACCENT_COLOR[id] ?? ACCENT_COLOR.gold;
}

export function Portrait({
  archetype,
  accent,
  className,
  size = 120,
}: {
  archetype: string;
  accent: string;
  className?: string;
  size?: number;
}) {
  const c = accentColor(accent);
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={cn(className)}
      aria-label={`${archetype} portrait`}
      role="img"
    >
      {/* background plate */}
      <rect x="0" y="0" width="48" height="48" fill="#0a0a0a" />
      <rect x="0" y="0" width="48" height="48" fill={c} opacity="0.08" />

      {/* shoulders */}
      <rect x="8" y="36" width="32" height="8" fill="#1c1c1c" />
      <rect x="10" y="34" width="28" height="4" fill="#262626" />
      {/* collar / accent */}
      <rect x="20" y="34" width="8" height="6" fill={c} />

      {/* head */}
      <rect x="16" y="12" width="16" height="18" fill="#d9d9d9" />
      <rect x="16" y="12" width="16" height="2" fill="#bdbdbd" />
      <rect x="16" y="28" width="16" height="2" fill="#a0a0a0" />

      {/* eyes */}
      <rect x="19" y="19" width="3" height="2" fill="#0a0a0a" />
      <rect x="26" y="19" width="3" height="2" fill="#0a0a0a" />

      {/* mouth */}
      <rect x="21" y="25" width="6" height="1" fill="#5a5a5a" />

      {/* archetype-specific accessory */}
      {archetype === "advocate" && (
        <>
          {/* gavel pin */}
          <rect x="13" y="36" width="4" height="4" fill={c} />
          <rect x="14" y="37" width="2" height="2" fill="#000" opacity="0.3" />
        </>
      )}
      {archetype === "inquisitor" && (
        <>
          {/* visor band */}
          <rect x="15" y="20" width="18" height="2" fill={c} />
          <rect x="19" y="19" width="3" height="2" fill={c} />
          <rect x="26" y="19" width="3" height="2" fill={c} />
        </>
      )}
      {archetype === "magister" && (
        <>
          {/* tall collar */}
          <rect x="14" y="32" width="20" height="4" fill={c} />
          <rect x="16" y="30" width="16" height="2" fill={c} opacity="0.7" />
        </>
      )}
      {archetype === "warden" && (
        <>
          {/* hood */}
          <rect x="12" y="8" width="24" height="10" fill="#141414" />
          <rect x="14" y="10" width="20" height="6" fill="#1c1c1c" />
          <rect x="12" y="8" width="24" height="2" fill={c} opacity="0.5" />
        </>
      )}
      {archetype === "silencer" && (
        <>
          {/* lower mask */}
          <rect x="17" y="23" width="14" height="6" fill="#101010" />
          <rect x="19" y="25" width="2" height="2" fill={c} />
          <rect x="27" y="25" width="2" height="2" fill={c} />
        </>
      )}
    </svg>
  );
}
