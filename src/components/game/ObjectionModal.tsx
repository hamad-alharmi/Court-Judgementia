"use client";
// ===== Objection Modal =====
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Siren } from "lucide-react";

export function ObjectionModal({
  open,
  onOpenChange,
  remaining,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  remaining: number;
  onSubmit: (grounds: string) => Promise<void>;
}) {
  const [grounds, setGrounds] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!grounds.trim()) {
      toast.error("State your grounds for the objection.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(grounds.trim());
      setGrounds("");
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  const PRESETS = [
    "Counsel is speculating without evidence.",
    "That statement contradicts the record.",
    "This is hearsay with no foundation.",
    "The point is irrelevant to the charges.",
    "Counsel assumes facts not in evidence.",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sharp max-w-lg gap-0 border-white/15 bg-black p-0 font-mono-terminal">
        <DialogHeader className="border-b border-white/10 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-white">
            <Siren className="h-4 w-4 text-red-400" />
            Raise Objection
            <span className="ml-auto text-[10px] font-normal text-white/40">
              {remaining} left
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 p-5">
          <p className="font-mono-terminal text-[11px] leading-relaxed text-white/50">
            State your grounds. Chief Justice Vanguard will rule immediately — sustained
            objections reduce the weight of the targeted statement.
          </p>
          <Textarea
            value={grounds}
            onChange={(e) => setGrounds(e.target.value.slice(0, 300))}
            placeholder="e.g. Counsel is speculating about the defendant's intent with no supporting evidence..."
            className="sharp min-h-[100px] border-white/20 bg-black text-[13px] text-white placeholder:text-white/20 focus-visible:border-gold"
          />
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setGrounds(p)}
                className="sharp border border-white/10 px-2 py-1 text-[9px] text-white/40 transition hover:border-white/30 hover:text-white/70"
              >
                {p}
              </button>
            ))}
          </div>
          <Button
            onClick={submit}
            disabled={busy || !grounds.trim()}
            className="sharp mt-2 h-11 border border-red-500 bg-red-500 font-mono-terminal text-xs font-bold uppercase tracking-[0.25em] text-white hover:bg-red-600"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Ruling...
              </>
            ) : (
              <>
                <Siren className="h-4 w-4" /> Object!
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
