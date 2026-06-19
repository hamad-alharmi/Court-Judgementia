// ===== Judgementia — Unified Data API (Supabase | local mock) =====
import type { Profile, Room } from "@/lib/types";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { tierForElo } from "@/lib/data/ranks";
import * as local from "@/lib/local/store";

export const DATA_MODE: "supabase" | "local" = isSupabaseConfigured
  ? "supabase"
  : "local";

// ---------- DB row mappers (Supabase snake_case <-> camelCase) ----------
interface ProfileRow {
  id: string;
  username: string;
  password_hash: string;
  avatar: Profile["avatar"];
  elo: number;
  rank: Profile["rank"];
  cases_tried: number;
  convictions: number;
  acquittals: number;
  judge_favorability: number;
  wins: number;
  losses: number;
  created_at: string;
}

function rowToProfile(r: ProfileRow): Profile {
  return {
    id: r.id,
    username: r.username,
    avatar: r.avatar,
    elo: r.elo,
    rank: r.rank,
    casesTried: r.cases_tried,
    convictions: r.convictions,
    acquittals: r.acquittals,
    judgeFavorability: r.judge_favorability,
    wins: r.wins,
    losses: r.losses,
    createdAt: r.created_at,
  };
}

interface RoomRow {
  id: string;
  code: string;
  phase: Room["phase"];
  matchmaking_type: Room["matchmakingType"];
  scenario_id: string;
  host_id: string;
  prosecutor_id: string | null;
  defendant_id: string | null;
  prosecutor_name: string | null;
  defendant_name: string | null;
  prosecutor_is_ai: boolean;
  defendant_is_ai: boolean;
  game_state: Room["gameState"];
  created_at: string;
  closed: boolean | null;
}

function rowToRoom(r: RoomRow): Room {
  return {
    id: r.id,
    code: r.code,
    phase: r.phase,
    matchmakingType: r.matchmaking_type,
    scenarioId: r.scenario_id,
    hostId: r.host_id,
    prosecutorId: r.prosecutor_id,
    defendantId: r.defendant_id,
    prosecutorName: r.prosecutor_name,
    defendantName: r.defendant_name,
    prosecutorIsAI: r.prosecutor_is_ai,
    defendantIsAI: r.defendant_is_ai,
    gameState: r.game_state,
    createdAt: r.created_at,
    closed: r.closed ?? false,
  };
}

// ---------- hashing (shared) ----------
export async function hashPassword(password: string): Promise<string> {
  return local.hashPassword(password);
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ============================================================
// PROFILES
// ============================================================
export const profiles = {
  async list(top = 50): Promise<Profile[]> {
    if (DATA_MODE === "supabase" && supabase) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("elo", { ascending: false })
        .limit(top);
      if (error) throw error;
      return (data as ProfileRow[]).map(rowToProfile);
    }
    await local.seedLocalDemoProfiles();
    return local.listLocalProfiles().slice(0, top);
  },

  async get(id: string): Promise<Profile | null> {
    if (DATA_MODE === "supabase" && supabase) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToProfile(data as ProfileRow) : null;
    }
    return local.getLocalProfile(id);
  },

  async signUp(
    username: string,
    password: string,
    avatar: Profile["avatar"],
  ): Promise<Profile> {
    const passwordHash = await hashPassword(password);
    if (DATA_MODE === "supabase" && supabase) {
      const elo = 1000;
      const { data, error } = await supabase
        .from("profiles")
        .insert({
          username,
          password_hash: passwordHash,
          avatar,
          elo,
          rank: tierForElo(elo),
        })
        .select("*")
        .single();
      if (error) {
        // username unique violation
        throw new Error(error.code === "23505" ? "USERNAME_TAKEN" : error.message);
      }
      return rowToProfile(data as ProfileRow);
    }
    const existing = local.getLocalProfileByUsername(username);
    if (existing) throw new Error("USERNAME_TAKEN");
    const profile = local.upsertLocalProfile({
      id: newId(),
      username,
      passwordHash,
      avatar,
      elo: 1000,
      rank: tierForElo(1000),
      casesTried: 0,
      convictions: 0,
      acquittals: 0,
      judgeFavorability: 50,
      wins: 0,
      losses: 0,
      createdAt: new Date().toISOString(),
    });
    return profile;
  },

  async signIn(username: string, password: string): Promise<Profile> {
    const passwordHash = await hashPassword(password);
    if (DATA_MODE === "supabase" && supabase) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("NO_USER");
      const row = data as ProfileRow;
      if (row.password_hash !== passwordHash) throw new Error("BAD_PASSWORD");
      return rowToProfile(row);
    }
    const stored = local.getLocalProfileByUsername(username);
    if (!stored) throw new Error("NO_USER");
    if (stored.passwordHash !== passwordHash) throw new Error("BAD_PASSWORD");
    const { passwordHash: _ph, ...rest } = stored;
    void _ph;
    return rest;
  },

  async update(id: string, patch: Partial<Profile>): Promise<Profile | null> {
    if (DATA_MODE === "supabase" && supabase) {
      const rowPatch: Record<string, unknown> = {};
      if (patch.avatar !== undefined) rowPatch.avatar = patch.avatar;
      if (patch.elo !== undefined) rowPatch.elo = patch.elo;
      if (patch.rank !== undefined) rowPatch.rank = patch.rank;
      if (patch.casesTried !== undefined) rowPatch.cases_tried = patch.casesTried;
      if (patch.convictions !== undefined) rowPatch.convictions = patch.convictions;
      if (patch.acquittals !== undefined) rowPatch.acquittals = patch.acquittals;
      if (patch.judgeFavorability !== undefined)
        rowPatch.judge_favorability = patch.judgeFavorability;
      if (patch.wins !== undefined) rowPatch.wins = patch.wins;
      if (patch.losses !== undefined) rowPatch.losses = patch.losses;
      const { data, error } = await supabase
        .from("profiles")
        .update(rowPatch)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data ? rowToProfile(data as ProfileRow) : null;
    }
    return local.patchLocalProfile(id, patch);
  },
};

// ============================================================
// ROOMS
// ============================================================
export const rooms = {
  async create(room: Room): Promise<Room> {
    if (DATA_MODE === "supabase" && supabase) {
      const row = {
        id: room.id,
        code: room.code,
        phase: room.phase,
        matchmaking_type: room.matchmakingType,
        scenario_id: room.scenarioId,
        host_id: room.hostId,
        prosecutor_id: room.prosecutorId,
        defendant_id: room.defendantId,
        prosecutor_name: room.prosecutorName,
        defendant_name: room.defendantName,
        prosecutor_is_ai: room.prosecutorIsAI,
        defendant_is_ai: room.defendantIsAI,
        game_state: room.gameState,
        closed: room.closed ?? false,
      };
      const { data, error } = await supabase
        .from("rooms")
        .insert(row)
        .select("*")
        .single();
      if (error) throw error;
      return rowToRoom(data as RoomRow);
    }
    return local.upsertLocalRoom(room);
  },

  async get(id: string): Promise<Room | null> {
    if (DATA_MODE === "supabase" && supabase) {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToRoom(data as RoomRow) : null;
    }
    return local.getLocalRoom(id);
  },

  async getByCode(code: string): Promise<Room | null> {
    const normalized = code.toUpperCase();
    if (DATA_MODE === "supabase" && supabase) {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", normalized)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToRoom(data as RoomRow) : null;
    }
    return local.getLocalRoomByCode(normalized);
  },

  async update(id: string, patch: Partial<Room>): Promise<Room | null> {
    if (DATA_MODE === "supabase" && supabase) {
      const rowPatch: Record<string, unknown> = {};
      if (patch.phase !== undefined) rowPatch.phase = patch.phase;
      if (patch.prosecutorId !== undefined) rowPatch.prosecutor_id = patch.prosecutorId;
      if (patch.defendantId !== undefined) rowPatch.defendant_id = patch.defendantId;
      if (patch.prosecutorName !== undefined) rowPatch.prosecutor_name = patch.prosecutorName;
      if (patch.defendantName !== undefined) rowPatch.defendant_name = patch.defendantName;
      if (patch.prosecutorIsAI !== undefined) rowPatch.prosecutor_is_ai = patch.prosecutorIsAI;
      if (patch.defendantIsAI !== undefined) rowPatch.defendant_is_ai = patch.defendantIsAI;
      if (patch.gameState !== undefined) rowPatch.game_state = patch.gameState;
      if (patch.closed !== undefined) rowPatch.closed = patch.closed;
      if (patch.scenarioId !== undefined) rowPatch.scenario_id = patch.scenarioId;
      const { data, error } = await supabase
        .from("rooms")
        .update(rowPatch)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data ? rowToRoom(data as RoomRow) : null;
    }
    return local.patchLocalRoom(id, patch);
  },

  /** For ranked matchmaking: find an open ranked room awaiting an opponent. */
  async findOpenRankedRoom(): Promise<Room | null> {
    if (DATA_MODE === "supabase" && supabase) {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("matchmaking_type", "ranked")
        .eq("phase", "lobby")
        .eq("closed", false)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToRoom(data as RoomRow) : null;
    }
    const open = local
      .listLocalRooms()
      .filter(
        (r) =>
          r.matchmakingType === "ranked" &&
          r.phase === "lobby" &&
          !r.closed &&
          !r.defendantId,
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return open[0] || null;
  },

  async listRecentLobbies(): Promise<Room[]> {
    if (DATA_MODE === "supabase" && supabase) {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("phase", "lobby")
        .eq("closed", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as RoomRow[]).map(rowToRoom);
    }
    return local
      .listLocalRooms()
      .filter((r) => r.phase === "lobby" && !r.closed)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
};

export { local, newId };
