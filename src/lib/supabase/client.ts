// ===== Judgementia — Supabase browser client =====
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anon);

/**
 * Browser Supabase client. Null when Supabase env vars are absent,
 * in which case the app falls back to the local mock data layer.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anon as string, {
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;
