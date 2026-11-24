// Migrates anonymous/local-only usage data into a user account on first sign-in.
//
// Local data lives in dedicated geegle_* localStorage keys. Game-specific saves
// are managed by the games themselves on the geegle origin; per-game save sync
// is handled by the GamePlayer save hooks (save/load round-trip via game_saves).

import { supabase } from './supabase';

export const FAVORITES_KEY = 'geegle-favorites';
export const RECENT_KEY = 'geegle-recently-played';
export const THEME_KEY = 'geegle-theme';
export const SETTINGS_KEY = 'geegle-settings';
export const SERVERS_KEY = 'geegle-default-servers';

export interface LocalUsageData {
  favorites: string[];
  recentlyPlayed: string[];
  theme?: string;
  settings?: Record<string, unknown>;
  defaultServers?: Record<string, number>;
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function readLocalUsage(): LocalUsageData {
  const favorites = readJson(FAVORITES_KEY);
  const recent = readJson(RECENT_KEY);
  const theme = readJson(THEME_KEY);
  const settings = readJson(SETTINGS_KEY);
  const servers = readJson(SERVERS_KEY);

  return {
    favorites: Array.isArray(favorites) ? (favorites as string[]) : [],
    recentlyPlayed: Array.isArray(recent) ? (recent as string[]) : [],
    theme: typeof theme === 'string' ? theme : undefined,
    settings:
      settings && typeof settings === 'object' && !Array.isArray(settings)
        ? (settings as Record<string, unknown>)
        : undefined,
    defaultServers:
      servers && typeof servers === 'object' && !Array.isArray(servers)
        ? (servers as Record<string, number>)
        : undefined,
  };
}

/**
 * One-time migration when a user signs in: local-first push.
 *
 * - If the account has no favorites yet, upload the local list.
 * - Otherwise union-merge local ids into the server list (server wins on conflicts).
 * - Theme/settings/default servers are pushed only when the server row is fresh
 *   (theme='system', empty settings), so a device that used the site before
 *   signing in keeps its choices without clobbering the account's saved state.
 */
export async function migrateLocalToAccount(userId: string): Promise<void> {
  const local = readLocalUsage();
  const hasLocalData =
    local.favorites.length > 0 ||
    local.recentlyPlayed.length > 0 ||
    local.settings !== undefined ||
    local.defaultServers !== undefined;

  if (!hasLocalData) return;

  // Favorites: merge (union) local into server.
  if (local.favorites.length > 0) {
    const { data: existing } = await supabase.from('favorites').select('game_id');
    const existingIds = new Set((existing ?? []).map((r) => r.game_id));
    const toInsert = local.favorites
      .filter((id) => !existingIds.has(id))
      .map((game_id) => ({ game_id, user_id: userId }));
    if (toInsert.length > 0) {
      await supabase.from('favorites').insert(toInsert);
    }
  }

  // Recently played: merge unique ids; order is by played_at server-side anyway.
  if (local.recentlyPlayed.length > 0) {
    const { data: existing } = await supabase.from('recently_played').select('game_id');
    const existingIds = new Set((existing ?? []).map((r) => r.game_id));
    const now = new Date().toISOString();
    const toInsert = local.recentlyPlayed
      .filter((id) => !existingIds.has(id))
      .map((game_id) => ({ game_id, user_id: userId, played_at: now }));
    if (toInsert.length > 0) {
      await supabase.from('recently_played').insert(toInsert);
    }
  }

  // Theme/settings/default servers: only seed a fresh account row.
  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('theme, settings')
    .eq('id', userId)
    .maybeSingle();

  const accountIsFresh =
    !settingsRow || (settingsRow.theme === 'system' && !settingsRow.settings);

  if (accountIsFresh && (local.settings || local.defaultServers || local.theme)) {
    const mergedSettings: Record<string, unknown> = {
      ...(local.settings ?? {}),
      ...(local.defaultServers ? { defaultServers: local.defaultServers } : {}),
    };
    await supabase.from('user_settings').upsert({
      id: userId,
      theme: local.theme === 'dark' || local.theme === 'light' ? local.theme : 'system',
      settings: mergedSettings,
    });
  }
}
