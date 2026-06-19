"use client";

// ===== useAuth — current player session =====
import { useCallback, useEffect, useState } from "react";
import { profiles, DATA_MODE, local } from "@/lib/api";
import type { AvatarConfig, Profile } from "@/lib/types";

const SESSION_KEY = "judgementia:session:v1";

function readSession(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

function writeSession(p: Profile | null) {
  if (typeof window === "undefined") return;
  if (p) localStorage.setItem(SESSION_KEY, JSON.stringify(p));
  else localStorage.removeItem(SESSION_KEY);
}

export function useAuth() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // hydrate
  useEffect(() => {
    let mounted = true;
    (async () => {
      const cached = readSession();
      if (cached) {
        setProfile(cached);
        // refresh from store
        const fresh = await profiles.get(cached.id);
        if (mounted && fresh) {
          setProfile(fresh);
          writeSession(fresh);
        }
      }
      if (mounted) setLoading(false);
    })();

    // keep fresh in local mode
    let unsub: (() => void) | undefined;
    if (DATA_MODE === "local") {
      unsub = local.subscribeLocal((e) => {
        if (e.type !== "profiles") return;
        const cur = readSession();
        if (!cur) return;
        const fresh = local.getLocalProfile(cur.id);
        if (fresh) {
          setProfile(fresh);
          writeSession(fresh);
        }
      });
    }
    return () => {
      mounted = false;
      unsub?.();
    };
  }, []);

  const signUp = useCallback(
    async (username: string, password: string, avatar: AvatarConfig) => {
      const p = await profiles.signUp(username, password, avatar);
      writeSession(p);
      setProfile(p);
      return p;
    },
    [],
  );

  const signIn = useCallback(async (username: string, password: string) => {
    const p = await profiles.signIn(username, password);
    writeSession(p);
    setProfile(p);
    return p;
  }, []);

  const logout = useCallback(() => {
    writeSession(null);
    setProfile(null);
  }, []);

  const updateAvatar = useCallback(
    async (avatar: AvatarConfig) => {
      if (!profile) return;
      const updated = await profiles.update(profile.id, { avatar });
      if (updated) {
        setProfile(updated);
        writeSession(updated);
      }
      return updated;
    },
    [profile],
  );

  const applyResult = useCallback(
    async (patch: Partial<Profile>) => {
      if (!profile) return;
      const updated = await profiles.update(profile.id, patch);
      if (updated) {
        setProfile(updated);
        writeSession(updated);
      }
      return updated;
    },
    [profile],
  );

  const refresh = useCallback(async () => {
    if (!profile) return;
    const fresh = await profiles.get(profile.id);
    if (fresh) {
      setProfile(fresh);
      writeSession(fresh);
    }
    return fresh;
  }, [profile]);

  return {
    profile,
    loading,
    signUp,
    signIn,
    logout,
    updateAvatar,
    applyResult,
    refresh,
  };
}
