"use client";

// ===== First Visit Dialog — asks users to support the game with ads =====
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAds } from "@/lib/ads";
import { Heart, X, Settings } from "lucide-react";
import { toast } from "sonner";

export function FirstVisitDialog() {
  const { hasAsked, setAdPref } = useAds();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hasAsked) {
      const t = setTimeout(() => setOpen(true), 2500);
      return () => clearTimeout(t);
    }
  }, [hasAsked]);

  function choose(pref: "yes" | "no") {
    setAdPref(pref);
    setOpen(false);
    if (pref === "yes") {
      toast.success("Thank you! Means a lot.", { duration: 3000 });
    } else {
      toast("No worries — you can turn ads on anytime in Settings.", {
        duration: 4000,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sharp max-w-md gap-0 border-gold/30 bg-black p-0 font-mono-terminal">
        <DialogHeader className="border-b border-white/10 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.06em] text-white">
            <Heart className="h-4 w-4 text-gold" />
            Quick Question
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-6">
          <p className="text-[13px] leading-relaxed text-white/70">
            Hey — I put a lot of work into this game. It's free and it'll stay free.
          </p>

          <p className="text-[13px] leading-relaxed text-white/70">
            Would you mind keeping ads on? It helps cover server costs and keeps
            things running. No pressure either way — you can always change this
            in Settings later.
          </p>

          <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
            <Button
              onClick={() => choose("yes")}
              className="sharp h-11 border border-gold bg-gold font-mono-terminal text-xs font-bold uppercase tracking-[0.06em] text-black hover:bg-gold/85"
            >
              <Heart className="h-4 w-4" />
              Sure, Keep Ads
            </Button>
            <Button
              onClick={() => choose("no")}
              variant="ghost"
              className="sharp h-10 border border-white/20 font-mono-terminal text-xs uppercase tracking-[0.04em] text-white/50 hover:text-white"
            >
              <X className="h-4 w-4" />
              No Thanks
            </Button>
          </div>

          <p className="flex items-center gap-1.5 text-center font-mono-terminal text-[9px] uppercase tracking-widest text-white/25">
            <Settings className="h-3 w-3" />
            Change this anytime in Settings
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
