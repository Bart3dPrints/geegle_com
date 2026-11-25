// Migrates anonymous/local-only usage data into a user account on first sign-in.
// Local data lives in dedicated geegle_* localStorage keys. Game saves are
// copied into the game_saves table so they sync across devices afterwards.

import { db } from './supabase';

export const FAVORITES_KEY = 'geegle-favorites';
export const RECENT_KEY = 'geegle-recently-played';
export const THEME_KEY = 'geegle-theme';
export const SETTINGS_KEY = 'geegle-settings';
export const SERVERS_KEY = 'geegle-default-servers';

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

/**
 * One-time merge of local data into the account. Server data wins on
 * conflicts; local-only entries are added. Nothing is deleted locally.
 */
export async function migrateLocalToAccount(userId: string): Promise<void> {
  const favorites = readStringArray(FAVORITES_KEY);
  const recent = readStringArray(RECENT_KEY);

  // Favorites: union local into server.
  if (favorites.length > 0) {
    const existing = await db()
      .from('favorites')
      .select('game_id')
      .eq('user_id', userId);
    if (!existing.error) {
      const existingIds = new Set((existing.data ?? []).map((r) => r.game_id));
      const toInsert = favorites
        .filter((id) => !existingIds.has(id))
        .map((game_id) => ({ user_id: userId, game_id }));
      if (toInsert.length > 0) {
        await db().from('favorites').insert(toInsert);
      }
    }
  }

  // Recently played: union unique ids.
  if (recent.length > 0) {
    const existing = await db()
      .from('recently_played')
      .select('game_id')
      .eq('user_id', userId);
    if (!existing.error) {
      const existingIds = new Set((existing.data ?? []).map((r) => r.game_id));
      const now = new Date().toISOString();
      const toInsert = recent
        .filter((id) => !existingIds.has(id))
        .map((game_id) => ({ user_id: userId, game_id, played_at: now }));
      if (toInsert.length > 0) {
        await db().from('recently_played').insert(toInsert);
      }
    }
  }

  // Per-game saves stored locally (key pattern geegle-save-<gameId>-<saveKey>).
  // Best effort — some games store saves in their own format inside their
  // own origin; those cannot be migrated automatically.
  try {
    const savePrefix = 'geegle-save-';
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(savePrefix)) continue;
      const rest = key.slice(savePrefix.length);
      const bar = rest.indexOf('-');
      if (bar <= 0) continue;
      const gameId = rest.slice(0, bar);
      const saveKey = rest.slice(bar + 1) || 'default';
      const saveData = readJson(key);
      if (saveData == null) continue;
      await db()
        .from('game_saves')
        .upsert(
          {
            user_id: userId,
            game_id: gameId,
            save_key: saveKey,
            save_data: saveData as object,
          },
          { onConflict: 'user_id,game_id,save_key' }
        );
    }
  } catch {
    // localStorage enumeration can throw in restricted environments.
  }

  // Theme/settings/servers: seed the account row only if it is fresh, so a
  // device's local choices are kept without clobbering the account's saved
  // preferences on later sign-ins.
  const row = await db()
    .from('user_settings')
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

  const localTheme = (() => {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  })();
  const localServers = readJson(SERVERS_KEY) as Record<string, number> | null;

  const settings: Record<string, unknown> = {};
  if (localServers && typeof localServers === 'object') {
    settings.defaultServers = localServers;
  }

  if (localTheme === 'dark' || localTheme === 'light' || settings.defaultServers) {
    await db()
      .from('user_settings')
      .upsert({
        id: userId,
        theme:
          localTheme === 'dark' || localTheme === 'light'
            ? localTheme
            : 'system',
        settings,
      });
  }
}
