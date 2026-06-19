"use client";
// ===== Stylized detective portrait (Lawliet-inspired) — pure SVG, always available =====
import { cn } from "@/lib/utils";

export function DetectivePortrait({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 520"
      className={cn("h-full w-full", className)}
      aria-label="Detective portrait"
      role="img"
    >
      {/* background */}
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1a1a" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </linearGradient>
        <radialGradient id="spot" cx="50%" cy="35%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="520" fill="url(#bg)" />
      <rect width="400" height="520" fill="url(#spot)" />

      {/* subtle red accent bar */}
      <rect x="0" y="0" width="8" height="520" fill="#b91c1c" opacity="0.7" />

      {/* crouched body / chair silhouette */}
      <ellipse cx="200" cy="500" rx="130" ry="22" fill="#000" opacity="0.6" />
      {/* legs (crouched) */}
      <path
        d="M 150 500 Q 130 460 150 420 Q 170 400 200 405 Q 230 400 250 420 Q 270 460 250 500 Z"
        fill="#0d0d0d"
        stroke="#262626"
        strokeWidth="1.5"
      />
      {/* torso leaning forward */}
      <path
        d="M 165 420 Q 175 360 200 340 Q 225 360 235 420 Z"
        fill="#121212"
        stroke="#2a2a2a"
        strokeWidth="1.5"
      />
      {/* arm raised to mouth (biting thumb) */}
      <path
        d="M 215 350 Q 240 330 245 300 Q 246 285 230 280 Q 218 282 215 295"
        fill="#0f0f0f"
        stroke="#2a2a2a"
        strokeWidth="1.5"
      />
      {/* hand / thumb near mouth */}
      <circle cx="222" cy="268" r="9" fill="#e8e6df" />
      <rect x="219" y="258" width="6" height="10" fill="#e8e6df" rx="1" />

      {/* neck */}
      <rect x="188" y="300" width="24" height="40" fill="#e8e6df" />
      <rect x="188" y="328" width="24" height="12" fill="#000" opacity="0.15" />

      {/* head — pale, angled slightly down */}
      <ellipse cx="200" cy="250" rx="58" ry="66" fill="#ece9e0" />
      {/* hair — messy black */}
      <path
        d="M 142 235 Q 138 195 165 180 Q 185 165 210 168 Q 245 165 258 195 Q 262 220 256 240 Q 248 215 235 210 Q 220 205 210 212 Q 195 200 178 208 Q 160 212 150 232 Q 146 240 142 235 Z"
        fill="#0a0a0a"
      />
      {/* hair tufts */}
      <path d="M 168 178 Q 172 168 180 172 Q 176 182 168 182 Z" fill="#0a0a0a" />
      <path d="M 200 168 Q 210 160 220 168 Q 214 178 204 176 Z" fill="#0a0a0a" />
      <path d="M 235 178 Q 248 175 252 188 Q 244 190 238 186 Z" fill="#0a0a0a" />

      {/* face shadow (under-brow) */}
      <path
        d="M 150 240 Q 200 250 250 240 Q 250 248 200 252 Q 150 248 150 240 Z"
        fill="#000"
        opacity="0.18"
      />

      {/* eyes — heavy dark bags, half-lidded staring */}
      <ellipse cx="178" cy="250" rx="9" ry="5" fill="#0a0a0a" />
      <ellipse cx="222" cy="250" rx="9" ry="5" fill="#0a0a0a" />
      {/* eye highlights */}
      <circle cx="180" cy="249" r="1.5" fill="#fff" opacity="0.8" />
      <circle cx="224" cy="249" r="1.5" fill="#fff" opacity="0.8" />
      {/* dark circles / bags */}
      <path d="M 168 258 Q 178 264 190 258" stroke="#7a6f5f" strokeWidth="2" fill="none" opacity="0.6" />
      <path d="M 212 258 Q 222 264 234 258" stroke="#7a6f5f" strokeWidth="2" fill="none" opacity="0.6" />
      {/* eyebrows */}
      <path d="M 168 240 Q 178 236 190 240" stroke="#0a0a0a" strokeWidth="2.5" fill="none" />
      <path d="M 212 240 Q 222 236 234 240" stroke="#0a0a0a" strokeWidth="2.5" fill="none" />

      {/* nose */}
      <path d="M 200 256 L 196 272 Q 200 276 204 272 Z" fill="#d8d3c8" />

      {/* mouth — slight, biting expression */}
      <path d="M 192 286 Q 200 288 208 286" stroke="#3a2f25" strokeWidth="2" fill="none" />

      {/* grain / scanlines */}
      <rect width="400" height="520" fill="url(#bg)" opacity="0" />
    </svg>
  );
}
