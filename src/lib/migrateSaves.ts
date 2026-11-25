// One-time migration of anonymous/local data into a user's account on first
// sign-in. Server data wins on conflicts; local-only entries are merged in.
// Nothing is deleted locally.

import { supabase, T } from './supabase';
import { FAVORITES_KEY, RECENT_KEY, THEME_KEY, SERVERS_KEY } from './userData';

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readStringArray(key: string): string[] {
  const v = readJson(key);
  return Array.isArray(v) ? (v as string[]) : [];
}

export async function migrateLocalToAccount(userId: string): Promise<void> {
  // Favorites: union local into server.
  const favorites = readStringArray(FAVORITES_KEY);
  if (favorites.length > 0) {
    const existing = await supabase
      .from(T.favorites)
      .select('game_id')
      .eq('user_id', userId);
    if (!existing.error) {
      const existingIds = new Set((existing.data ?? []).map((r) => r.game_id));
      const toInsert = favorites
        .filter((id) => !existingIds.has(id))
        .map((game_id) => ({ user_id: userId, game_id }));
      if (toInsert.length > 0) {
        await supabase.from(T.favorites).insert(toInsert);
      }
    }
  }

  // Recently played: union unique ids.
  const recent = readStringArray(RECENT_KEY);
  if (recent.length > 0) {
    const existing = await supabase
      .from(T.recent)
      .select('game_id')
      .eq('user_id', userId);
    if (!existing.error) {
      const existingIds = new Set((existing.data ?? []).map((r) => r.game_id));
      const now = new Date().toISOString();
      const toInsert = recent
        .filter((id) => !existingIds.has(id))
        .map((game_id) => ({ user_id: userId, game_id, played_at: now }));
      if (toInsert.length > 0) {
        await supabase.from(T.recent).insert(toInsert);
      }
    }
  }

  // Theme + default proxy servers: seed the account only when fresh, so a
  // device's local choices are kept without clobbering saved preferences.
  const row = await supabase
    .from(T.settings)
    .select('theme, settings')
    .eq('id', userId)
    .maybeSingle();
  if (row.error) return;

  const accountIsFresh =
    !row.data ||
    (row.data.theme === 'system' &&
      (!row.data.settings ||
        Object.keys(row.data.settings as object).length === 0));

  if (!accountIsFresh) return;

  let localTheme: string | null = null;
  try {
    localTheme = localStorage.getItem(THEME_KEY);
  } catch {
    localTheme = null;
  }
  const localServers = readJson(SERVERS_KEY) as Record<string, number> | null;

  const settings: Record<string, unknown> = {};
  if (localServers && typeof localServers === 'object') {
    settings.defaultServers = localServers;
  }

  if (
    localTheme === 'dark' ||
    localTheme === 'light' ||
    settings.defaultServers
  ) {
    await supabase.from(T.settings).upsert({
      id: userId,
      theme:
        localTheme === 'dark' || localTheme === 'light'
          ? localTheme
          : 'system',
      settings,
    });
  }
}
