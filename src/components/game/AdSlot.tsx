"use client";

// ===== Ad Slot — renders a Google AdSense unit when ads are enabled =====
import { useAds } from "@/lib/ads";
import { cn } from "@/lib/utils";

interface AdSlotProps {
  slot?: string;
  format?: string;
  className?: string;
  label?: string;
}

export function AdSlot({
  slot = "0000000000",
  format = "auto",
  className,
  label = "Advertisement",
}: AdSlotProps) {
  const { adsAllowed } = useAds();

  if (!adsAllowed) return null;

  const client = "ca-pub-8823186128402736";

  return (
    <div
      className={cn(
        "relative flex min-h-[90px] items-center justify-center overflow-hidden rounded-xl border border-white/8 bg-white/[0.02]",
        className,
      )}
      aria-label="advertisement"
    >
      <span className="absolute left-2 top-1.5 text-[7px] uppercase tracking-widest text-white/20">
        {label}
      </span>
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%", minHeight: "90px" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
