"use client";
// ===== Phase 2: Authentication Gate =====
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PixelScales } from "./PixelScales";
import { useAuth } from "@/hooks/use-auth";
import type { Profile } from "@/lib/types";
import { toast } from "sonner";

export function AuthGate({ onAuthenticated }: { onAuthenticated: (p: Profile) => void }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("All fields are required.");
      return;
    }
    setBusy(true);
    try {
      const p =
        mode === "signin"
          ? await signIn(username.trim(), password)
          : await signUp(username.trim(), password, {
              archetype: "advocate",
              accent: "gold",
              motto: "Order in the chamber.",
            });
      toast.success(mode === "signin" ? "Session restored." : "Bar admission granted.");
      onAuthenticated(p);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "USERNAME_TAKEN")
        toast.error("That handle is already on the docket.");
      else if (code === "NO_USER")
        toast.error("No attorney found under that handle.");
      else if (code === "BAD_PASSWORD")
        toast.error("Credentials rejected by the clerk.");
      else toast.error("Authentication failed. Retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-10 scanlines">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="h-16 w-16 opacity-90">
            <PixelScales />
          </div>
          <div className="text-center">
            <h1 className="text-glow-gold text-gold font-mono-terminal text-xl font-bold tracking-[0.1em] sm:text-2xl">
              JUDGEMENTIA
            </h1>
            <p className="mt-1 font-mono-terminal text-[10px] uppercase tracking-[0.15em] text-white/40">
              Attorney Admission Terminal
            </p>
          </div>
        </div>

        <div className="panel sharp glow-gold p-6 sm:p-8">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
            <TabsList className="grid w-full grid-cols-2 bg-black">
              <TabsTrigger value="signin" className="font-mono-terminal text-xs uppercase tracking-widest">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="signup" className="font-mono-terminal text-xs uppercase tracking-widest">
                Be Admitted
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={submit} className="space-y-4">
                <Field label="ATTORNEY HANDLE">
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. V_Whitcombe"
                    autoComplete="username"
                    className="sharp border-white/20 bg-black font-mono-terminal text-white placeholder:text-white/25 focus-visible:border-gold"
                  />
                </Field>
                <Field label="PASSPHRASE">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="sharp border-white/20 bg-black font-mono-terminal text-white placeholder:text-white/25 focus-visible:border-gold"
                  />
                </Field>
                <SubmitButton busy={busy} label="Restore Session" />
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={submit} className="space-y-4">
                <Field label="NEW ATTORNEY HANDLE">
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="choose a unique handle"
                    autoComplete="username"
                    className="sharp border-white/20 bg-black font-mono-terminal text-white placeholder:text-white/25 focus-visible:border-gold"
                  />
                </Field>
                <Field label="SET PASSPHRASE">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="sharp border-white/20 bg-black font-mono-terminal text-white placeholder:text-white/25 focus-visible:border-gold"
                  />
                </Field>
                <p className="font-mono-terminal text-[10px] leading-relaxed text-white/35">
                  Admission starts you at <span className="text-gold">1000 Elo</span> —{" "}
                  Junior Associate tier. Customize your avatar matrix after entry.
                </p>
                <SubmitButton busy={busy} label="Request Admission" />
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="mt-4 text-center font-mono-terminal text-[10px] uppercase tracking-[0.08em] text-white/25">
          All proceedings recorded · Chief Justice Vanguard presiding
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="font-mono-terminal text-[10px] uppercase tracking-[0.06em] text-white/50">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SubmitButton({ busy, label }: { busy: boolean; label: string }) {
  return (
    <Button
      type="submit"
      disabled={busy}
      className="sharp mt-2 h-11 w-full border border-gold bg-gold font-mono-terminal text-xs font-bold uppercase tracking-[0.08em] text-black hover:bg-gold/85 disabled:opacity-50"
    >
      {busy ? "Processing..." : label}
    </Button>
  );
}
