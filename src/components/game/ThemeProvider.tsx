"use client";
// ===== Theme System — runtime CSS-variable theme switching =====
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { UITheme } from "@/lib/types";

interface ThemeDef {
  id: UITheme;
  label: string;
  swatch: string;
  vars: Record<string, string>;
}

// Each theme overrides the gold accent + a couple of supporting tokens.
// The base dark surface (black bg, white borders) stays constant.
export const THEMES: ThemeDef[] = [
  {
    id: "gold",
    label: "Vanguard Gold",
    swatch: "#d4af37",
    vars: {
      "--gold": "oklch(0.82 0.15 84)",
      "--primary": "oklch(0.82 0.15 84)",
      "--ring": "oklch(0.82 0.15 84)",
      "--chart-1": "oklch(0.82 0.15 84)",
    },
  },
  {
    id: "crimson",
    label: "Prosecutor Crimson",
    swatch: "#e0524a",
    vars: {
      "--gold": "oklch(0.65 0.22 25)",
      "--primary": "oklch(0.65 0.22 25)",
      "--ring": "oklch(0.65 0.22 25)",
      "--chart-1": "oklch(0.65 0.22 25)",
    },
  },
  {
    id: "jade",
    label: "Defense Jade",
    swatch: "#3fb98a",
    vars: {
      "--gold": "oklch(0.7 0.15 160)",
      "--primary": "oklch(0.7 0.15 160)",
      "--ring": "oklch(0.7 0.15 160)",
      "--chart-1": "oklch(0.7 0.15 160)",
    },
  },
  {
    id: "violet",
    label: "Magister Violet",
    swatch: "#a78bfa",
    vars: {
      "--gold": "oklch(0.7 0.18 300)",
      "--primary": "oklch(0.7 0.18 300)",
      "--ring": "oklch(0.7 0.18 300)",
      "--chart-1": "oklch(0.7 0.18 300)",
    },
  },
  {
    id: "cyan",
    label: "Signal Cyan",
    swatch: "#22d3ee",
    vars: {
      "--gold": "oklch(0.78 0.15 200)",
      "--primary": "oklch(0.78 0.15 200)",
      "--ring": "oklch(0.78 0.15 200)",
      "--chart-1": "oklch(0.78 0.15 200)",
    },
  },
];

const STORAGE_KEY = "judgementia:theme:v1";

interface ThemeCtx {
  theme: UITheme;
  setTheme: (t: UITheme) => void;
}

const Ctx = createContext<ThemeCtx>({ theme: "gold", setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<UITheme>(() => {
    if (typeof window === "undefined") return "gold";
    const saved = localStorage.getItem(STORAGE_KEY) as UITheme | null;
    return saved && THEMES.some((t) => t.id === saved) ? saved : "gold";
  });

  useEffect(() => {
    const def = THEMES.find((t) => t.id === theme) ?? THEMES[0];
    const root = document.documentElement;
    for (const [k, v] of Object.entries(def.vars)) {
      root.style.setProperty(k, v);
    }
    root.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = useCallback((t: UITheme) => {
    setThemeState(t);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, t);
  }, []);

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}
