"use client";
// ===== GameApp — top-level state machine =====
import { useCallback, useEffect, useState } from "react";
import { LoadingScreen } from "./LoadingScreen";
import { AuthGate } from "./AuthGate";
import { GavelTransition } from "./GavelTransition";
import { Dashboard } from "./Dashboard";
import { Courtroom } from "./Courtroom";
import { useAuth } from "@/hooks/use-auth";
import { rooms } from "@/lib/api";
import { normalizeCode, isValidChamberCode } from "@/lib/codec";
import { toast } from "sonner";
import type { AppPhase, Profile } from "@/lib/types";

export function GameApp() {
  const { profile, loading: authLoading } = useAuth();
  const [phase, setPhase] = useState<AppPhase>("loading");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [chamberParam, setChamberParam] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const ch = params.get("chamber");
    return ch && isValidChamberCode(normalizeCode(ch)) ? normalizeCode(ch) : null;
  });

  const handleLoadingComplete = useCallback(() => {
    // useAuth hydrates synchronously from localStorage, so profile is ready
    setPhase(profile ? "dashboard" : "auth");
  }, [profile]);

  const handleAuthenticated = useCallback((_p: Profile) => {
    setPhase("gavel-transition");
  }, []);

  const handleGavelDone = useCallback(() => {
    setPhase("dashboard");
  }, []);

  const enterRoom = useCallback((id: string) => {
    setRoomId(id);
    setPhase("courtroom");
  }, []);

  const leaveRoom = useCallback(() => {
    setRoomId(null);
    setPhase("dashboard");
  }, []);

  // auto-join via ?chamber= once authed & on dashboard
  useEffect(() => {
    if (phase !== "dashboard" || !profile || !chamberParam) return;
    let cancelled = false;
    (async () => {
      try {
        const room = await rooms.getByCode(chamberParam);
        if (!room) {
          toast.error(`Chamber ${chamberParam} not found.`);
          setChamberParam(null);
          return;
        }
        if (room.phase !== "lobby" && room.prosecutorId !== profile.id && room.defendantId !== profile.id) {
          toast.error("That trial is already in session.");
          setChamberParam(null);
          return;
        }
        // join if open
        if (
          room.prosecutorId !== profile.id &&
          room.defendantId !== profile.id
        ) {
          if (!room.defendantId || room.defendantIsAI) {
            await rooms.update(room.id, {
              defendantId: profile.id,
              defendantName: profile.username,
              defendantIsAI: false,
            });
          } else if (!room.prosecutorId || room.prosecutorIsAI) {
            await rooms.update(room.id, {
              prosecutorId: profile.id,
              prosecutorName: profile.username,
              prosecutorIsAI: false,
            });
          } else {
            toast.error("That chamber is full.");
            setChamberParam(null);
            return;
          }
        }
        if (cancelled) return;
        toast.success(`Joined chamber ${room.code}.`);
        setChamberParam(null);
        enterRoom(room.id);
      } catch {
        toast.error("Failed to join chamber link.");
        setChamberParam(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, profile, chamberParam, enterRoom]);

  // ----- render -----
  if (phase === "loading" || authLoading) {
    return <LoadingScreen onComplete={handleLoadingComplete} />;
  }

  if (phase === "auth") {
    // if a session appeared, go straight to gavel/dashboard
    if (profile) {
      return <GavelTransition onDone={handleGavelDone} />;
    }
    return <AuthGate onAuthenticated={handleAuthenticated} />;
  }

  if (phase === "gavel-transition") {
    return <GavelTransition onDone={handleGavelDone} />;
  }

  if (phase === "courtroom" && roomId) {
    return (
      <Courtroom roomId={roomId} onLeave={leaveRoom} onRematch={leaveRoom} />
    );
  }

  // dashboard (default)
  return <Dashboard onEnterRoom={enterRoom} />;
}
