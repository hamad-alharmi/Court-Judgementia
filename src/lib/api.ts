// ===== Judgementia — Unified Data API (Supabase | local mock) v2 =====
import type { Profile, Room } from "@/lib/types";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { tierForElo } from "@/lib/data/ranks";
import * as local from "@/lib/local/store";

export const DATA_MODE: "supabase" | "local" = isSupabaseConfigured
  ? "supabase"
  : "local";

// ---------- DB row mappers ----------
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
  is_admin?: boolean | null;
  character?: string | null;
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
    isAdmin: r.is_admin ?? false,
    character: r.character ?? undefined,
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
  statement_count?: number;
  ai_difficulty?: Room["aiDifficulty"];
  case_theme?: string;
  game_state: Room["gameState"];
  created_at: string;
  closed: boolean | null;
}

function rowToRoom(r: RoomRow): Room {
  // v2 columns may be absent if the user hasn't run the v2 migration.
  // Fall back to values stashed in game_state._v2.
  const gs = (r.game_state ?? {}) as Room["gameState"] & { _v2?: { statementCount?: number; aiDifficulty?: Room["aiDifficulty"]; caseTheme?: string } };
  const v2 = gs._v2 ?? {};
  const gameState = { ...gs };
  delete (gameState as { _v2?: unknown })._v2;
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
    statementCount: r.statement_count ?? v2.statementCount ?? 4,
    aiDifficulty: (r.ai_difficulty ?? v2.aiDifficulty ?? "medium") as Room["aiDifficulty"],
    caseTheme: r.case_theme ?? v2.caseTheme ?? "",
    gameState,
    createdAt: r.created_at,
    closed: r.closed ?? false,
  };
}

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
  /** Top profiles sorted by wins DESC (then Elo). */
  async list(top = 50): Promise<Profile[]> {
    if (DATA_MODE === "supabase" && supabase) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("wins", { ascending: false })
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
      const baseRow = {
        username,
        password_hash: passwordHash,
        avatar,
        elo,
        rank: tierForElo(elo),
      };
      // Try with v2 columns (is_admin, character) — fall back to base if absent.
      let { data, error } = await supabase
        .from("profiles")
        .insert({ ...baseRow, is_admin: false, character: null })
        .select("*")
        .single();
      if (error && /column .* does not exist|Could not find the .* column|PGRST204/i.test(error.message)) {
        const res2 = await supabase
          .from("profiles")
          .insert(baseRow)
          .select("*")
          .single();
        data = res2.data;
        error = res2.error;
      }
      if (error) {
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
      const v2Patch: Record<string, unknown> = {};
      if (patch.isAdmin !== undefined) v2Patch.is_admin = patch.isAdmin;
      if (patch.character !== undefined) v2Patch.character = patch.character;
      let { data, error } = await supabase
        .from("profiles")
        .update({ ...rowPatch, ...v2Patch })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error && /column .* does not exist|Could not find the .* column|PGRST204/i.test(error.message)) {
        // retry without v2 columns
        const res2 = await supabase
          .from("profiles")
          .update(rowPatch)
          .eq("id", id)
          .select("*")
          .maybeSingle();
        data = res2.data;
        error = res2.error;
      }
      if (error) throw error;
      return data ? rowToProfile(data as ProfileRow) : null;
    }
    return local.patchLocalProfile(id, patch);
  },

  async remove(id: string): Promise<void> {
    if (DATA_MODE === "supabase" && supabase) {
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) throw error;
      return;
    }
    local.deleteLocalProfile(id);
  },
};

// ============================================================
// ROOMS
// ============================================================
export const rooms = {
  async create(room: Room): Promise<Room> {
    if (DATA_MODE === "supabase" && supabase) {
      // Base row (v1 schema). v2 columns are added only if present.
      const row: Record<string, unknown> = {
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
      // Try with v2 columns; if the column is missing, retry without them.
      const v2Cols = {
        statement_count: room.statementCount,
        ai_difficulty: room.aiDifficulty,
        case_theme: room.caseTheme,
      };
      let { data, error } = await supabase
        .from("rooms")
        .insert({ ...row, ...v2Cols })
        .select("*")
        .single();
      if (error && /column .* does not exist|Could not find the .* column|PGRST204/i.test(error.message)) {
        // v2 columns not present — insert v1-only, then patch gameState to carry v2 fields
        const res2 = await supabase
          .from("rooms")
          .insert({
            ...row,
            game_state: {
              ...room.gameState,
              _v2: {
                statementCount: room.statementCount,
                aiDifficulty: room.aiDifficulty,
                caseTheme: room.caseTheme,
              },
            },
          })
          .select("*")
          .single();
        data = res2.data;
        error = res2.error;
      }
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
      const v2Patch: Record<string, unknown> = {};
      if (patch.statementCount !== undefined) v2Patch.statement_count = patch.statementCount;
      if (patch.aiDifficulty !== undefined) v2Patch.ai_difficulty = patch.aiDifficulty;
      if (patch.caseTheme !== undefined) v2Patch.case_theme = patch.caseTheme;
      let { data, error } = await supabase
        .from("rooms")
        .update({ ...rowPatch, ...v2Patch })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error && /column .* does not exist|Could not find the .* column|PGRST204/i.test(error.message)) {
        // v2 columns missing — stash v2 fields into game_state._v2
        const fresh = await supabase
          .from("rooms")
          .select("game_state")
          .eq("id", id)
          .maybeSingle();
        const cur = (fresh.data?.game_state ?? {}) as Record<string, unknown>;
        const mergedV2: Record<string, unknown> = {
          ...(cur._v2 as object | undefined),
        };
        if (patch.statementCount !== undefined) mergedV2.statementCount = patch.statementCount;
        if (patch.aiDifficulty !== undefined) mergedV2.aiDifficulty = patch.aiDifficulty;
        if (patch.caseTheme !== undefined) mergedV2.caseTheme = patch.caseTheme;
        const mergedGs = { ...cur, _v2: mergedV2 };
        const res2 = await supabase
          .from("rooms")
          .update({ ...rowPatch, game_state: mergedGs })
          .eq("id", id)
          .select("*")
          .maybeSingle();
        data = res2.data;
        error = res2.error;
      }
      if (error) throw error;
      return data ? rowToRoom(data as RoomRow) : null;
    }
    return local.patchLocalRoom(id, patch);
  },

  async findOpenRankedRoom(): Promise<Room | null> {
    if (DATA_MODE === "supabase" && supabase) {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("matchmaking_type", "ranked")
        .eq("phase", "lobby")
        .eq("closed", false)
        .order("created_at", { ascending: true })
        .limit(10);
      if (error) throw error;
      const rows = (data as RoomRow[] | null) ?? [];
      // find the first room with an open (non-AI, empty) defendant slot
      const open = rows
        .map(rowToRoom)
        .find((r) => !r.defendantId && !r.defendantIsAI);
      return open ?? null;
    }
    const open = local
      .listLocalRooms()
      .filter(
        (r) =>
          r.matchmakingType === "ranked" &&
          r.phase === "lobby" &&
          !r.closed &&
          !r.defendantId &&
          !r.defendantIsAI,
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
