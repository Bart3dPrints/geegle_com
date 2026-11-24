// Central Supabase client. Config comes from Vite env vars at build time:
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// These are public anon credentials (safe to ship in a static build — RLS protects data).

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // The app must still work fully offline/anonymously (local-only mode) when
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
