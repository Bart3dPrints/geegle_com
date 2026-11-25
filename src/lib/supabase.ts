// Central Supabase client. Configuration comes from Vite env vars at build
// time: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (public credentials; all
// data protection comes from Row Level Security).
//
// All Geegle tables live in the `public` schema with a `geegle_` prefix —
// public is always exposed through Supabase's Data API, and the prefix keeps
// them separate from other applications sharing this project.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // The app still works fully anonymously (local-only mode) when Supabase
  // is not configured. Components check isSupabaseConfigured.
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

// Geegle table names (public schema, geegle_ prefix).
export const T = {
  profiles: 'geegle_profiles',
  settings: 'geegle_user_settings',
  favorites: 'geegle_favorites',
  recent: 'geegle_recently_played',
  saves: 'geegle_game_saves',
  entryAttempts: 'geegle_entry_attempts',
} as const;

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
