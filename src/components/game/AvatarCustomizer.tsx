"use client";
// ===== Avatar Customizer Matrix =====
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Portrait, ARCHETYPES, ACCENTS, accentColor } from "./Portrait";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { AvatarConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

const MOTTO_PRESETS = [
  "Order in the chamber.",
  "The record does not lie.",
  "Doubt is the defense.",
  "Culpability by correlation.",
  "Protocol above all.",
];

export function AvatarCustomizer() {
  const { profile, updateAvatar } = useAuth();
  const [archetype, setArchetype] = useState<string>(profile?.avatar.archetype ?? "advocate");
  const [accent, setAccent] = useState<string>(profile?.avatar.accent ?? "gold");
  const [motto, setMotto] = useState<string>(profile?.avatar.motto ?? "Order in the chamber.");
  const [saving, setSaving] = useState(false);

  const dirty =
    profile?.avatar.archetype !== archetype ||
    profile?.avatar.accent !== accent ||
    profile?.avatar.motto !== motto;

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      await updateAvatar({ archetype, accent, motto } as AvatarConfig);
      toast.success("Avatar matrix updated.");
    } catch {
      toast.error("Failed to commit avatar matrix.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel sharp flex flex-col gap-5 p-5">
      <Header
        index="02"
        title="Avatar Customizer Matrix"
        subtitle="Configure your digital attorney profile"
      />

      <div className="flex flex-col gap-5 sm:flex-row">
        {/* preview */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="sharp border border-white/15 p-2"
            style={{ boxShadow: `0 0 24px -8px ${accentColor(accent)}` }}
          >
            <Portrait archetype={archetype} accent={accent} size={128} />
          </div>
          <div className="text-center">
            <div className="font-mono-terminal text-sm font-bold text-white">
              {profile?.username}
            </div>
            <div className="font-mono-terminal text-[10px] uppercase tracking-widest text-white/40">
              {profile?.rank}
            </div>
          </div>
        </div>

        {/* controls */}
        <div className="flex flex-1 flex-col gap-4">
          <div>
            <Label className="mb-2 block font-mono-terminal text-[10px] uppercase tracking-[0.25em] text-white/50">
              Archetype
            </Label>
            <div className="grid grid-cols-5 gap-1.5">
              {ARCHETYPES.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setArchetype(a)}
                  className={cn(
                    "sharp border px-1 py-2 font-mono-terminal text-[9px] uppercase tracking-wider transition",
                    archetype === a
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-white/15 text-white/50 hover:border-white/40 hover:text-white",
                  )}
                >
                  {a.slice(0, 4)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block font-mono-terminal text-[10px] uppercase tracking-[0.25em] text-white/50">
              Accent
            </Label>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccent(a.id)}
                  title={a.label}
                  className={cn(
                    "sharp flex h-9 w-9 items-center justify-center border-2 transition",
                    accent === a.id ? "border-white" : "border-white/20 hover:border-white/50",
                  )}
                  style={{ backgroundColor: a.color }}
                >
                  {accent === a.id && (
                    <span className="text-[10px] font-bold text-black">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block font-mono-terminal text-[10px] uppercase tracking-[0.25em] text-white/50">
              Legal Motto
            </Label>
            <Input
              value={motto}
              onChange={(e) => setMotto(e.target.value.slice(0, 60))}
              className="sharp border-white/20 bg-black font-mono-terminal text-white placeholder:text-white/25 focus-visible:border-gold"
              placeholder="Your declaration..."
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MOTTO_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotto(m)}
                  className="sharp border border-white/10 px-2 py-1 font-mono-terminal text-[9px] text-white/40 transition hover:border-white/30 hover:text-white/70"
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Button
        onClick={save}
        disabled={!dirty || saving}
        className="sharp h-10 border border-gold bg-transparent font-mono-terminal text-xs font-bold uppercase tracking-[0.25em] text-gold hover:bg-gold hover:text-black disabled:opacity-30"
      >
        {saving ? "Committing..." : "Commit Matrix"}
      </Button>
    </section>
  );
}

export function Header({
  index,
  title,
  subtitle,
}: {
  index: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-baseline gap-3 border-b border-white/10 pb-3">
      <span className="font-mono-terminal text-[10px] text-gold">{index}</span>
      <div>
        <h2 className="font-mono-terminal text-sm font-bold uppercase tracking-[0.2em] text-white">
          {title}
        </h2>
        {subtitle && (
          <p className="font-mono-terminal text-[10px] uppercase tracking-widest text-white/35">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
