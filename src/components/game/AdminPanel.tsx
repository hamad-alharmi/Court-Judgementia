"use client";
// ===== Admin Panel — manage leaderboard accounts =====
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { useAuth } from "@/hooks/use-auth";
import { profiles } from "@/lib/api";
import { tierInfoForElo } from "@/lib/data/ranks";
import { toast } from "sonner";
import { RotateCcw, Trash2, ShieldAlert, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export function AdminPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { profile: admin } = useAuth();
  const { rows, refresh } = useLeaderboard(100);
  const [filter, setFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = rows.filter((r) =>
    r.username.toLowerCase().includes(filter.toLowerCase()),
  );

  const act = useCallback(
    async (action: "delete" | "reset", target: Profile) => {
      if (!admin) return;
      setBusyId(target.id);
      try {
        const res = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            targetId: target.id,
            adminUsername: admin.username,
            adminPassword: prompt(`Admin password to ${action} ${target.username}:`) || "",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Action failed.");
        } else {
          toast.success(
            action === "delete"
              ? `${target.username} removed from the docket.`
              : `${target.username}'s stats reset.`,
          );
          await refresh();
        }
      } catch (e) {
        console.error(e);
        toast.error("Admin action failed.");
      } finally {
        setBusyId(null);
      }
    },
    [admin, refresh],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sharp max-h-[85vh] gap-0 border-white/15 bg-black p-0 font-mono-terminal">
        <DialogHeader className="border-b border-white/10 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.04em] text-white">
            <ShieldAlert className="h-4 w-4 text-gold" />
            Admin Panel — Bench Authority
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2 border border-white/15 bg-black px-3 py-2">
            <Search className="h-3.5 w-3.5 text-white/40" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter attorneys..."
              className="w-full bg-transparent text-xs text-white placeholder:text-white/25 focus:outline-none"
            />
          </div>

          <div className="max-h-[55vh] overflow-y-auto">
            <div className="grid grid-cols-[1fr_60px_60px_120px] gap-2 border-b border-white/10 pb-1.5 text-[9px] uppercase tracking-widest text-white/40">
              <span>Attorney</span>
              <span className="text-right">Elo</span>
              <span className="text-right">W</span>
              <span className="text-right">Actions</span>
            </div>
            {filtered.map((p) => {
              const tier = tierInfoForElo(p.elo);
              const isMe = admin?.id === p.id;
              return (
                <div
                  key={p.id}
                  className={cn(
                    "grid grid-cols-[1fr_60px_60px_120px] items-center gap-2 border-b border-white/5 py-1.5 text-xs",
                    p.isAdmin ? "text-gold" : "text-white/70",
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate font-bold">
                      {p.username}
                      {p.isAdmin && (
                        <span className="ml-1.5 text-[8px] uppercase tracking-widest">ADMIN</span>
                      )}
                      {isMe && <span className="ml-1.5 text-[8px] uppercase tracking-widest text-white/40">YOU</span>}
                    </div>
                    <div className="text-[9px] text-white/30">{tier.code}</div>
                  </div>
                  <span className="text-right text-gold">{p.elo}</span>
                  <span className="text-right text-white/60">{p.wins}</span>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={p.isAdmin || busyId === p.id}
                      onClick={() => act("reset", p)}
                      className="sharp h-7 w-7 border border-white/15 text-white/50 hover:text-white"
                      title="Reset stats"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={p.isAdmin || busyId === p.id}
                      onClick={() => act("delete", p)}
                      className="sharp h-7 w-7 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white"
                      title="Delete / ban account"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="font-mono-terminal text-[9px] leading-relaxed text-white/30">
            Delete removes the account entirely (banned) — they vanish from the leaderboard.
            Reset returns Elo to 1000 and zeroes all stats.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
