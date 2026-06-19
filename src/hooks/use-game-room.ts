"use client";

// ===== useGameRoom — fetch + realtime + polling for a single room =====
import { useCallback, useEffect, useRef, useState } from "react";
import { rooms, DATA_MODE, local } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
import type { Room } from "@/lib/types";

const POLL_MS = 2000; // polling fallback ensures both players stay in sync

export function useGameRoom(roomId: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    if (inflight.current) return;
    inflight.current = true;
    try {
      const r = await rooms.get(roomId);
      if (!mounted.current) return;
      setRoom((prev) => {
        // Only update if something changed to avoid needless re-renders
        if (prev && r && JSON.stringify(prev) === JSON.stringify(r)) return prev;
        return r;
      });
      setError(null);
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Failed to load room");
    } finally {
      if (mounted.current) setLoading(false);
      inflight.current = false;
    }
  }, [roomId]);

  useEffect(() => {
    mounted.current = true;
    if (!roomId) {
      setRoom(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();

    let unsub: (() => void) | undefined;

    // Realtime subscription (primary)
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
        .on("broadcast", { event: "room_update" }, () => refresh())
        .subscribe();
      unsub = () => {
        supabase?.removeChannel(channel);
      };
    } else {
      unsub = local.subscribeLocal((e) => {
        if (e.type === "rooms") refresh();
      });
    }

    // Polling fallback (critical for sync reliability)
    const poll = setInterval(refresh, POLL_MS);

    return () => {
      mounted.current = false;
      unsub?.();
      clearInterval(poll);
    };
  }, [roomId, refresh]);

  const update = useCallback(
    async (patch: Partial<Room>) => {
      if (!roomId) return null;
      const updated = await rooms.update(roomId, patch);
      if (updated) setRoom(updated);
      // Broadcast to other clients via realtime channel
      if (DATA_MODE === "supabase" && supabase) {
        supabase.channel(`room:${roomId}`).send({
          type: "broadcast",
          event: "room_update",
          payload: {},
        });
      }
      return updated;
    },
    [roomId],
  );

  return { room, loading, error, refresh, update };
}
