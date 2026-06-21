"use client";

// ===== Ad System — Google AdSense with user opt-in =====
import { createContext, useCallback, useContext, useState } from "react";

const AD_PREF_KEY = "judgementia:ads-allowed";

type AdPref = "yes" | "no";

interface AdCtx {
  adsAllowed: boolean;
  hasAsked: boolean;
  setAdPref: (pref: "yes" | "no") => void;
}

const Ctx = createContext<AdCtx>({
  adsAllowed: false,
  hasAsked: false,
  setAdPref: () => {},
});

export function AdProvider({ children }: { children: React.ReactNode }) {
  const [adsAllowed, setAdsAllowed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(AD_PREF_KEY) === "yes";
  });
  const [hasAsked, setHasAsked] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(AD_PREF_KEY) !== null;
  });

  const setAdPref = useCallback((pref: "yes" | "no") => {
    localStorage.setItem(AD_PREF_KEY, pref);
    setAdsAllowed(pref === "yes");
    setHasAsked(true);
  }, []);

  return (
    <Ctx.Provider value={{ adsAllowed, hasAsked, setAdPref }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAds() {
  return useContext(Ctx);
}

export { AD_PREF_KEY };
