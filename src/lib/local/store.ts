// ===== Judgementia — Local Mock Data Layer (preview / no-Supabase mode) =====
// Persists profiles + rooms to localStorage and syncs across browser tabs
// via BroadcastChannel + the `storage` event. This gives a fully functional
// real-time multiplayer experience in the preview without Supabase creds.
import type { Profile, Room } from "@/lib/types";

const PROFILES_KEY = "judgementia:profiles:v2";
const ROOMS_KEY = "judgementia:rooms:v2";
const CHANNEL = "judgementia-rt";

export interface StoredProfile extends Profile {
  passwordHash: string;
}

type ChangeEvent =
  | { type: "profiles" }
  | { type: "rooms"; roomId?: string };

type Listener = (e: ChangeEvent) => void;

let listeners = new Set<Listener>();
let channel: BroadcastChannel | null = null;

try {
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (ev) => {
    const data = ev.data as ChangeEvent | null;
    if (!data) return;
    listeners.forEach((l) => l(data));
  };
} catch {
  channel = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (ev) => {
    if (ev.key === PROFILES_KEY) {
      listeners.forEach((l) => l({ type: "profiles" }));
    } else if (ev.key === ROOMS_KEY) {
      listeners.forEach((l) => l({ type: "rooms" }));
    }
  });
}

function emit(e: ChangeEvent) {
  // Defer listener invocation to a microtask so subscribers cannot cause
  // synchronous re-entrancy (which previously overflowed the stack).
  queueMicrotask(() => {
    listeners.forEach((l) => l(e));
  });
  channel?.postMessage(e);
}

export function subscribeLocal(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ---------- persistence helpers ----------
function readProfiles(): Record<string, StoredProfile> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeProfiles(map: Record<string, StoredProfile>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROFILES_KEY, JSON.stringify(map));
  emit({ type: "profiles" });
}

function readRooms(): Record<string, Room> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(ROOMS_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeRooms(map: Record<string, Room>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROOMS_KEY, JSON.stringify(map));
  emit({ type: "rooms" });
}

// ---------- simple sha-256 hash (async) ----------
export async function hashPassword(password: string): Promise<string> {
  try {
    const enc = new TextEncoder().encode("judgementia::" + password);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "hash_" + btoa(password);
  }
}

// ---------- profiles ----------
export function listLocalProfiles(): Profile[] {
  return Object.values(readProfiles())
    .map(stripPassword)
    .sort((a, b) => b.wins - a.wins || b.elo - a.elo);
}

export function getLocalProfile(id: string): Profile | null {
  const p = readProfiles()[id];
  return p ? stripPassword(p) : null;
}

export function getLocalProfileByUsername(
  username: string,
): StoredProfile | null {
  const map = readProfiles();
  return (
    Object.values(map).find(
      (p) => p.username.toLowerCase() === username.toLowerCase(),
    ) || null
  );
}

export function upsertLocalProfile(profile: StoredProfile): Profile {
  const map = readProfiles();
  map[profile.id] = profile;
  writeProfiles(map);
  return stripPassword(profile);
}

export function patchLocalProfile(
  id: string,
  patch: Partial<Profile>,
): Profile | null {
  const map = readProfiles();
  const cur = map[id];
  if (!cur) return null;
  const next: StoredProfile = { ...cur, ...patch, id: cur.id, passwordHash: cur.passwordHash };
  map[id] = next;
  writeProfiles(map);
  return stripPassword(next);
}

export function deleteLocalProfile(id: string): void {
  const map = readProfiles();
  delete map[id];
  writeProfiles(map);
}

function stripPassword(p: StoredProfile): Profile {
  const { passwordHash, ...rest } = p;
  void passwordHash;
  return rest;
}

// ---------- rooms ----------
export function listLocalRooms(): Room[] {
  return Object.values(readRooms());
}

export function getLocalRoom(id: string): Room | null {
  return readRooms()[id] || null;
}

export function getLocalRoomByCode(code: string): Room | null {
  return (
    Object.values(readRooms()).find(
      (r) => r.code.toUpperCase() === code.toUpperCase(),
    ) || null
  );
}

export function upsertLocalRoom(room: Room): Room {
  const map = readRooms();
  map[room.id] = room;
  writeRooms(map);
  return room;
}

export function patchLocalRoom(
  id: string,
  patch: Partial<Room>,
): Room | null {
  const map = readRooms();
  const cur = map[id];
  if (!cur) return null;
  const next: Room = { ...cur, ...patch, id: cur.id };
  map[id] = next;
  writeRooms(map);
  return next;
}

export function deleteLocalRoom(id: string): void {
  const map = readRooms();
  delete map[id];
  writeRooms(map);
}

// ---------- seed demo leaderboard + admin (once) ----------
const SEEDED_KEY = "judgementia:seeded:v2";
const DEMO_SEED: Array<{ username: string; elo: number; wins: number; losses: number }> = [
  { username: "V_Whitcombe", elo: 2380, wins: 261, losses: 151 },
  { username: "Aurochs_Vex", elo: 2210, wins: 240, losses: 148 },
  { username: "Mira_Stenwick", elo: 2050, wins: 198, losses: 153 },
  { username: "Dorian_Faye", elo: 1925, wins: 170, losses: 132 },
  { username: "Kestrel_Imre", elo: 1810, wins: 159, losses: 118 },
  { username: "Sable_Okafor", elo: 1680, wins: 138, losses: 106 },
  { username: "Rune_Calloway", elo: 1545, wins: 121, losses: 90 },
  { username: "Thessaly_Vox", elo: 1410, wins: 104, losses: 84 },
  { username: "Percival_Mott", elo: 1288, wins: 88, losses: 68 },
  { username: "Iola_Brigant", elo: 1150, wins: 67, losses: 55 },
];

let seedingInProgress = false;
export async function seedLocalDemoProfiles(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEEDED_KEY)) return;
  if (seedingInProgress) return;
  seedingInProgress = true;
  try {
    const map = readProfiles();
    // admin account
    const adminId = "admin-alrzrii";
    if (!map[adminId]) {
      map[adminId] = {
        id: adminId,
        username: "alrzrii",
        passwordHash: await hashPassword("vyhghgg46"),
        avatar: { archetype: "magister", accent: "gold", motto: "I am justice." },
        elo: 2500,
        rank: "Chief Justice Elite",
        casesTried: 999,
        convictions: 700,
        acquittals: 299,
        judgeFavorability: 99,
        wins: 700,
        losses: 50,
        isAdmin: true,
        character: "lawliet",
        createdAt: new Date().toISOString(),
      };
    }
    for (const s of DEMO_SEED) {
      const id = "seed-" + s.username.toLowerCase();
      if (map[id]) continue;
      const cases = s.wins + s.losses;
      map[id] = {
        id,
        username: s.username,
        passwordHash: await hashPassword("seedpassword"),
        avatar: { archetype: "advocate", accent: "gold", motto: "Order in the chamber." },
        elo: s.elo,
        rank: tierLabel(s.elo),
        casesTried: cases,
        convictions: s.wins,
        acquittals: s.losses,
        judgeFavorability: 40 + Math.floor((s.elo - 1000) / 30),
        wins: s.wins,
        losses: s.losses,
        createdAt: new Date().toISOString(),
      };
    }
    localStorage.setItem(SEEDED_KEY, "1");
    writeProfiles(map);
  } finally {
    seedingInProgress = false;
  }
}

function tierLabel(elo: number): Profile["rank"] {
  if (elo >= 2100) return "Chief Justice Elite";
  if (elo >= 1800) return "Magistrate";
  if (elo >= 1500) return "Senior Counsel";
  if (elo >= 1200) return "Partner";
  return "Junior Associate";
}
