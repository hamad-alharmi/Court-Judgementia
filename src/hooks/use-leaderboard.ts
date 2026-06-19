"use client";

// ===== useLeaderboard — top profiles, realtime-refreshed =====
import { useCallback, useEffect, useState } from "react";
import { profiles, DATA_MODE, local } from "@/lib/api";
import type { Profile } from "@/lib/types";

export function useLeaderboard(top = 50) {
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const list = await profiles.list(top);
      setRows(list);
    } catch (e) {
      console.error("leaderboard load failed", e);
    } finally {
      setLoading(false);
    }
  }, [top]);

  useEffect(() => {
    refresh();
    let unsub: (() => void) | undefined;
    if (DATA_MODE === "local") {
      unsub = local.subscribeLocal((e) => {
        if (e.type === "profiles") refresh();
      });
    }
    return () => unsub?.();
  }, [refresh]);

  return { rows, loading, refresh };
}
