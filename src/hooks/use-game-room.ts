"use client";

// ===== useGameRoom — fetch + realtime subscription for a single room =====
import { useCallback, useEffect, useRef, useState } from "react";
import { rooms, DATA_MODE, local } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
import type { Room } from "@/lib/types";

export function useGameRoom(roomId: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    if (inflight.current) return;
    inflight.current = true;
    try {
      const r = await rooms.get(roomId);
      setRoom(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load room");
    } finally {
      setLoading(false);
      inflight.current = false;
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();

    let unsub: (() => void) | undefined;
    if (DATA_MODE === "supabase" && supabase) {
      const channel = supabase
        .channel(`room:${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "rooms",
            filter: `id=eq.${roomId}`,
          },
          () => refresh(),
        )
        .subscribe();
      unsub = () => {
        supabase?.removeChannel(channel);
      };
    } else {
      unsub = local.subscribeLocal((e) => {
        if (e.type === "rooms") refresh();
      });
    }
    return () => unsub?.();
  }, [roomId, refresh]);

  const update = useCallback(
    async (patch: Partial<Room>) => {
      if (!roomId) return null;
      const updated = await rooms.update(roomId, patch);
      if (updated) setRoom(updated);
      return updated;
    },
    [roomId],
  );

  return { room, loading, error, refresh, update };
}
