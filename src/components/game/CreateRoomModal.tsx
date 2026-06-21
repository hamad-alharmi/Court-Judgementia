"use client";
// ===== Create Room Modal — full setup options =====
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useSound } from "@/hooks/use-sound";
import { rooms } from "@/lib/api";
import { generateChamberCode } from "@/lib/codec";
import { newRoom } from "@/lib/room";
import { randomScenarioId } from "@/lib/data/cases";
import { toast } from "sonner";
import { Cpu, Dices, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AI_DIFFICULTIES,
  CASE_THEME_PRESETS,
  RANKED_STATEMENT_COUNT,
  STATEMENT_OPTIONS,
  type AIDifficulty,
  type AIRole,
} from "@/lib/types";

export function CreateRoomModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (roomId: string) => void;
}) {
  const { profile } = useAuth();
  const sounds = useSound();
  const [statementCount, setStatementCount] = useState<number>(4);
  const [aiRoles, setAiRoles] = useState<Set<AIRole>>(new Set(["defense"]));
  const [difficulty, setDifficulty] = useState<AIDifficulty>("medium");
  const [theme, setTheme] = useState<string>("cyber");
  const [generating, setGenerating] = useState(false);

  function toggleRole(role: AIRole) {
    sounds.click();
    setAiRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  async function createRoom() {
    if (!profile) return;
    setGenerating(true);
    try {
      const code = generateChamberCode();
      const aiDefense = aiRoles.has("defense");
      const aiProsecution = aiRoles.has("prosecution");
      const room = newRoom({
        code,
        matchmakingType: "casual",
        scenarioId: randomScenarioId(), // fallback; host can regenerate via AI in lobby
        hostId: profile.id,
        prosecutorId: aiProsecution ? undefined : profile.id,
        prosecutorName: aiProsecution ? null : profile.username,
        prosecutorIsAI: aiProsecution,
        defendantId: aiDefense ? null : null,
        defendantName: aiDefense ? "AI Defense" : null,
        defendantIsAI: aiDefense,
        statementCount,
        aiDifficulty: difficulty,
        caseTheme: theme,
        phase: "lobby",
      });
      await rooms.create(room);
      toast.success(`Chamber ${room.code} provisioned.`);
      onOpenChange(false);
      onCreated(room.id);
    } catch (e) {
      console.error(e);
      toast.error("Failed to provision chamber.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sharp max-w-lg gap-0 border-white/15 bg-black p-0 font-mono-terminal">
        <DialogHeader className="border-b border-white/10 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.04em] text-white">
            <Plus className="h-4 w-4 text-gold" />
            Create Custom Chamber
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 p-5">
          {/* Case theme */}
          <div>
            <label className="mb-2 block font-mono-terminal text-[10px] uppercase tracking-[0.06em] text-white/50">
              Case Theme
            </label>
            <Input
              value={theme}
              onChange={(e) => setTheme(e.target.value.slice(0, 40))}
              placeholder="cyber, murder, joke, heist..."
              className="sharp border-white/20 bg-black text-white placeholder:text-white/25 focus-visible:border-gold"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CASE_THEME_PRESETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    sounds.click();
                    setTheme(t);
                  }}
                  className={cn(
                    "sharp border px-2 py-1 text-[9px] uppercase tracking-wider transition",
                    theme === t
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-white/15 text-white/40 hover:border-white/40 hover:text-white",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="mt-1.5 font-mono-terminal text-[9px] text-white/30">
              The AI will generate a fresh case for this theme when the trial begins.
            </p>
          </div>

          {/* Statement count */}
          <div>
            <label className="mb-2 block font-mono-terminal text-[10px] uppercase tracking-[0.06em] text-white/50">
              Statements per side
            </label>
            <div className="grid grid-cols-6 gap-1.5">
              {STATEMENT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    sounds.click();
                    setStatementCount(n);
                  }}
                  className={cn(
                    "sharp border py-2 text-sm font-bold transition",
                    statementCount === n
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-white/15 text-white/50 hover:border-white/40 hover:text-white",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* AI roles */}
          <div>
            <label className="mb-2 block font-mono-terminal text-[10px] uppercase tracking-[0.06em] text-white/50">
              Fill roles with AI
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["prosecution", "defense"] as AIRole[]).map((r) => {
                const active = aiRoles.has(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRole(r)}
                    className={cn(
                      "sharp flex items-center gap-2 border p-3 text-xs uppercase tracking-wider transition",
                      active
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-white/15 text-white/50 hover:border-white/40",
                    )}
                  >
                    <Cpu className="h-4 w-4" />
                    AI {r}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 font-mono-terminal text-[9px] text-white/30">
              You'll take the first unfilled human role. Pick both for a spectator/AI-vs-AI view.
            </p>
          </div>

          {/* AI difficulty */}
          <div>
            <label className="mb-2 block font-mono-terminal text-[10px] uppercase tracking-[0.06em] text-white/50">
              AI Difficulty
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {AI_DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    sounds.click();
                    setDifficulty(d);
                  }}
                  className={cn(
                    "sharp border py-2 text-xs uppercase tracking-wider transition",
                    difficulty === d
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-white/15 text-white/50 hover:border-white/40 hover:text-white",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 p-5">
          <Button
            onClick={() => {
              sounds.click();
              createRoom();
            }}
            disabled={generating}
            className="sharp h-11 w-full border border-gold bg-gold font-mono-terminal text-xs font-bold uppercase tracking-[0.06em] text-black hover:bg-gold/85"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Provisioning...
              </>
            ) : (
              <>
                <Dices className="h-4 w-4" /> Open Chamber
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
