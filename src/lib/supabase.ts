// Central Supabase client. Configuration comes from Vite env vars at build
// time:
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// These are public anon credentials — safe to ship in a static build. All
// data protection comes from Row Level Security, which is enabled on every
// Geegle table in the dedicated `geegle` schema (see
// supabase/migrations/0001_init.sql).

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // The app still works fully offline/anonymously (local-only mode) when
  // Supabase is not configured. Components check isSupabaseConfigured.
  console.warn(
    '[geegle] Supabase is not configured. Accounts and cloud sync are disabled; the site runs in local-only mode.'
  );
}

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(
  url ?? 'https://placeholder.invalid',
  anonKey ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'geegle-auth-session',
    },
  }
);

/**
 * Geegle's tables live in a dedicated Postgres schema, isolated from other
 * applications sharing the Supabase project. Every data call in this app
 * MUST go through this accessor so RLS policies apply consistently.
 */
export function db() {
  return supabase.schema('geegle');
}

/**
 * Username-only authentication: Supabase Auth requires an email field, so we
 * derive a stable, unique synthetic address from the username. No real email
 * is ever collected. Duplicate usernames are impossible because two accounts
 * cannot share one email.
 */
export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@users.geegle.internal`;
}

/** Extracts the username from a session user's synthetic email. */
export function usernameFromEmail(email: string | undefined): string {
  if (!email) return 'user';
  const local = email.split('@')[0];
  return local || 'user';
}
