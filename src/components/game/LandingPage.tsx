"use client";

// ===== Public Landing Page — visible without login (for AdSense + SEO) =====
import { Button } from "@/components/ui/button";
import { PixelScales } from "./PixelScales";
import { AdSlot } from "./AdSlot";
import { motion } from "framer-motion";
import {
  Gavel,
  Swords,
  Scale,
  Trophy,
  MessageSquare,
  Sparkles,
  Shield,
  Users,
  ArrowRight,
} from "lucide-react";

export function LandingPage({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-4">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at 50% 40%, rgba(212,175,55,0.08), transparent 60%)",
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative flex flex-col items-center gap-6 text-center"
        >
          <div className="h-20 w-20 opacity-90">
            <PixelScales />
          </div>
          <div>
            <h1 className="text-gold text-4xl font-bold tracking-tight sm:text-6xl">
              Judgementia
            </h1>
            <p className="mt-3 text-lg text-white/60 sm:text-xl">
              A real-time multiplayer legal thriller.
            </p>
            <p className="mt-1 text-sm text-white/40">
              Prosecute, defend, raise objections — and face the verdict of an AI judge.
            </p>
          </div>
          <Button
            onClick={onGetStarted}
            className="h-12 rounded-xl border border-gold bg-gold px-8 text-sm font-bold uppercase tracking-wide text-black hover:bg-gold/85"
          >
            Enter the Court
            <ArrowRight className="h-4 w-4" />
          </Button>
        </motion.div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="mb-8 text-center text-2xl font-bold text-white">
          How It Works
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={Gavel}
            title="AI Judge"
            desc="Chief Justice Vanguard delivers real verdicts using Gemini AI. Every case is evaluated on evidence, logic, and rhetoric."
          />
          <FeatureCard
            icon={Swords}
            title="Ranked Matches"
            desc="Climb from Junior Associate to Chief Justice Elite. Elo-rated competitive play against real humans."
          />
          <FeatureCard
            icon={MessageSquare}
            title="Multi-Round Trials"
            desc="File statements, present evidence, and object to your opponent's arguments across multiple rounds."
          />
          <FeatureCard
            icon={Sparkles}
            title="Dynamic Cases"
            desc="AI generates fresh cases on the spot — murder mysteries, theft, fraud, heists, and more."
          />
          <FeatureCard
            icon={Trophy}
            title="Global Leaderboard"
            desc="Compete for the top spot. Track your wins, Elo, and judge favorability."
          />
          <FeatureCard
            icon={Users}
            title="Real-Time Multiplayer"
            desc="Play with friends in custom chambers or queue for ranked matchmaking."
          />
        </div>
      </section>

      {/* Ad slot — surrounded by content */}
      <section className="mx-auto max-w-5xl px-4 py-8">
        <AdSlot slot="landing-mid" label="Sponsored" />
      </section>

      {/* How to Play */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="mb-8 text-center text-2xl font-bold text-white">
          How to Play
        </h2>
        <div className="flex flex-col gap-6">
          <Step
            num="1"
            title="Create an account"
            desc="Sign up with a username and password. You start at 1000 Elo — Junior Associate tier."
          />
          <Step
            num="2"
            title="Choose your match"
            desc="Create a custom chamber with your own rules, join a friend's room with a code, or queue for ranked matchmaking."
          />
          <Step
            num="3"
            title="Read the case"
            desc="Each trial presents a case file with facts and 3 pieces of evidence. Study them before arguing."
          />
          <Step
            num="4"
            title="File your statements"
            desc="Take turns filing written arguments. Present evidence to strengthen your case. Object to your opponent's flaws."
          />
          <Step
            num="5"
            title="Face the verdict"
            desc="After all rounds, a 5-person jury votes and Chief Justice Vanguard delivers the final verdict. Win to gain Elo."
          />
        </div>
      </section>

      {/* Rank Tiers */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="mb-8 text-center text-2xl font-bold text-white">
          Rank Tiers
        </h2>
        <div className="flex flex-col gap-3">
          {[
            { name: "Junior Associate", elo: "0+", desc: "Fresh to the bar" },
            { name: "Partner", elo: "1200+", desc: "Seasoned litigator" },
            { name: "Senior Counsel", elo: "1500+", desc: "Elite rhetoric" },
            { name: "Magistrate", elo: "1800+", desc: "Commands the chamber" },
            { name: "Chief Justice Elite", elo: "2100+", desc: "Apex of the bench" },
          ].map((tier, i) => (
            <div
              key={tier.name}
              className="flex items-center justify-between rounded-xl border border-white/8 bg-panel p-4"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-gold">{i + 1}</span>
                <div>
                  <div className="font-bold text-white">{tier.name}</div>
                  <div className="text-xs text-white/40">{tier.desc}</div>
                </div>
              </div>
              <span className="text-sm text-gold">{tier.elo} Elo</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-xl border border-gold/20 bg-panel p-8">
          <Scale className="mx-auto mb-4 h-10 w-10 text-gold" />
          <h2 className="mb-2 text-2xl font-bold text-white">
            Ready to make your case?
          </h2>
          <p className="mb-6 text-white/50">
            Free to play. No download required.
          </p>
          <Button
            onClick={onGetStarted}
            className="h-12 rounded-xl border border-gold bg-gold px-8 text-sm font-bold uppercase tracking-wide text-black hover:bg-gold/85"
          >
            Enter the Court
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 px-4 py-6 text-center">
        <p className="text-xs text-white/30">
          Judgementia · Legal Trial Protocol · Chief Justice Vanguard presiding
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-panel p-5">
      <Icon className="mb-3 h-6 w-6 text-gold" />
      <h3 className="mb-1 font-bold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-white/50">{desc}</p>
    </div>
  );
}

function Step({
  num,
  title,
  desc,
}: {
  num: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 text-sm font-bold text-gold">
        {num}
      </div>
      <div>
        <h3 className="font-bold text-white">{title}</h3>
        <p className="text-sm leading-relaxed text-white/50">{desc}</p>
      </div>
    </div>
  );
}
