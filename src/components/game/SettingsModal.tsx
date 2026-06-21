"use client";
// ===== Settings Modal — theme picker + session =====
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { THEMES, useTheme } from "./ThemeProvider";
import { useAuth } from "@/hooks/use-auth";
import { Check, Palette, LogOut, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UITheme } from "@/lib/types";

export function SettingsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { theme, setTheme } = useTheme();
  const { profile, logout } = useAuth();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sharp max-w-md gap-0 border-white/15 bg-black p-0 font-mono-terminal">
        <DialogHeader className="border-b border-white/10 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.04em] text-white">
            <Palette className="h-4 w-4 text-gold" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 p-5">
          {/* Theme picker */}
          <div>
            <div className="mb-2 font-mono-terminal text-[10px] uppercase tracking-[0.06em] text-white/50">
              Accent Theme
            </div>
            <div className="grid grid-cols-1 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id as UITheme)}
                  className={cn(
                    "sharp flex items-center justify-between border px-3 py-2.5 transition",
                    theme === t.id
                      ? "border-white bg-white/5"
                      : "border-white/15 hover:border-white/40",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-5 w-5 border border-white/30"
                      style={{ backgroundColor: t.swatch }}
                    />
                    <span className="text-xs text-white">{t.label}</span>
                  </div>
                  {theme === t.id && <Check className="h-4 w-4 text-gold" />}
                </button>
              ))}
            </div>
          </div>

          {/* account */}
          {profile && (
            <div className="border-t border-white/10 pt-4">
              <div className="mb-2 font-mono-terminal text-[10px] uppercase tracking-[0.06em] text-white/50">
                Account
              </div>
              <div className="panel-2 sharp mb-3 flex items-center justify-between p-3">
                <div>
                  <div className="text-xs font-bold text-white">
                    {profile.username}
                    {profile.isAdmin && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-gold">
                        <Shield className="h-3 w-3" /> Admin
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-white/40">
                    {profile.elo} Elo · {profile.rank}
                  </div>
                </div>
              </div>
              <Button
                onClick={() => {
                  logout();
                  onOpenChange(false);
                }}
                className="sharp h-10 w-full border border-white/20 bg-transparent font-mono-terminal text-xs font-bold uppercase tracking-[0.04em] text-white/70 hover:bg-white hover:text-black"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
