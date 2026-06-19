// ===== Judgementia — Achievements definitions =====
// Each achievement stores the actual Lucide icon component (not a string),
// so the consumer can render it directly: `const Icon = a.icon; <Icon />`.
import type { LucideIcon } from "lucide-react";
import {
  Trophy,
  Flame,
  Award,
  Star,
  Crown,
  Briefcase,
  Landmark,
  Heart,
} from "lucide-react";
import type { Profile } from "@/lib/types";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  check: (profile: Profile) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_win",
    name: "First Victory",
    description: "Win your first case",
    icon: Trophy,
    check: (p) => p.wins >= 1,
  },
  {
    id: "five_wins",
    name: "Winning Streak",
    description: "Win 5 cases",
    icon: Flame,
    check: (p) => p.wins >= 5,
  },
  {
    id: "fifty_wins",
    name: "Veteran Litigator",
    description: "Win 50 cases",
    icon: Award,
    check: (p) => p.wins >= 50,
  },
  {
    id: "elo_1500",
    name: "Senior Counsel",
    description: "Reach 1500 Elo",
    icon: Star,
    check: (p) => p.elo >= 1500,
  },
  {
    id: "elo_2000",
    name: "Magistrate",
    description: "Reach 2000 Elo",
    icon: Crown,
    check: (p) => p.elo >= 2000,
  },
  {
    id: "ten_cases",
    name: "Seasoned",
    description: "Try 10 cases",
    icon: Briefcase,
    check: (p) => p.casesTried >= 10,
  },
  {
    id: "hundred_cases",
    name: "Centurion",
    description: "Try 100 cases",
    icon: Landmark,
    check: (p) => p.casesTried >= 100,
  },
  {
    id: "favored",
    name: "Judge's Favorite",
    description: "Reach 75% judge favorability",
    icon: Heart,
    check: (p) => p.judgeFavorability >= 75,
  },
];
