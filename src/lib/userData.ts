// User data layer: favorites, recently played, theme, settings, and default
// proxy servers — all in the dedicated `geegle` schema.
// Every server operation includes the caller's user id explicitly (RLS also
// enforces ownership server-side) and every error is surfaced to the caller
// as an OpResult; nothing is silently ignored. Anonymous users keep working
// via localStorage, preserving pre-account behavior.

import { db, isSupabaseConfigured } from './supabase';
import type { OpResult, ThemePreference } from '../types';
import { FAVORITES_KEY, RECENT_KEY, THEME_KEY, SERVERS_KEY } from './migrateSaves';

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — localStorage state is best-effort by design */
  }
}

function readStringArray(key: string): string[] {
  const v = readJson(key);
  return Array.isArray(v) ? (v as string[]) : [];
}

// ── Favorites ──────────────────────────────────────────────────────────────

export function toggleFavoriteLocal(gameId: string): string[] {
  const favorites = readStringArray(FAVORITES_KEY);
  const next = favorites.includes(gameId)
    ? favorites.filter((id) => id !== gameId)
    : [...favorites, gameId];
  writeJson(FAVORITES_KEY, next);
  return next;
}

export async function toggleFavorite(
  gameId: string,
  userId: string | null
): Promise<OpResult<string[]>> {
  if (!userId || !isSupabaseConfigured) {
    return { ok: true, data: toggleFavoriteLocal(gameId) };
  }

  const existing = await db()
    .from('favorites')
    .select('game_id')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .maybeSingle();
  if (existing.error) {
    return { ok: false, error: existing.error.message };
  }

  if (existing.data) {
    const removed = await db()
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('game_id', gameId);
    if (removed.error) return { ok: false, error: removed.error.message };
  } else {
    const added = await db()
      .from('favorites')
      .insert({ user_id: userId, game_id: gameId });
    if (added.error) return { ok: false, error: added.error.message };
  }

  const all = await db()
    .from('favorites')
    .select('game_id')
    .eq('user_id', userId);
  if (all.error) return { ok: false, error: all.error.message };
  return { ok: true, data: (all.data ?? []).map((r) => r.game_id) };
}

export async function loadFavorites(
  userId: string | null
): Promise<OpResult<string[]>> {
  if (!userId || !isSupabaseConfigured) {
    return { ok: true, data: readStringArray(FAVORITES_KEY) };
  }
  const { data, error } = await db()
    .from('favorites')
    .select('game_id')
    .eq('user_id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map((r) => r.game_id) };
}

// ── Recently played ──────────────────────────────────────────────────────────

export function pushRecentLocal(gameId: string): string[] {
  let recent = readStringArray(RECENT_KEY);
  recent = [gameId, ...recent.filter((id) => id !== gameId)].slice(0, 24);
  writeJson(RECENT_KEY, recent);
  return recent;
}

export async function trackPlay(
  gameId: string,
  userId: string | null
): Promise<OpResult<string[]>> {
  if (!userId || !isSupabaseConfigured) {
    return { ok: true, data: pushRecentLocal(gameId) };
  }

  const upsert = await db()
    .from('recently_played')
    .upsert(
      { user_id: userId, game_id: gameId, played_at: new Date().toISOString() },
      { onConflict: 'user_id,game_id' }
    )
    .eq('user_id', userId);
  if (upsert.error) {
    // Degrade to local so play history is never lost, but report the error.
    return { ok: false, error: upsert.error.message, data: pushRecentLocal(gameId) };
  }

  const { data, error } = await db()
    .from('recently_played')
    .select('game_id')
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
    .limit(24);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map((r) => r.game_id) };
}

export async function loadRecent(
  userId: string | null
): Promise<OpResult<string[]>> {
  if (!userId || !isSupabaseConfigured) {
    return { ok: true, data: readStringArray(RECENT_KEY) };
  }
  const { data, error } = await db()
    .from('recently_played')
    .select('game_id')
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
    .limit(24);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map((r) => r.game_id) };
}

// ── Game saves (compatible games) ───────────────────────────────────────────

export async function saveGameSave(
  gameId: string,
  saveKey: string,
  saveData: unknown,
  userId: string | null
): Promise<OpResult<null>> {
  if (!userId || !isSupabaseConfigured) {
    // Mirror to localStorage so saves survive even without an account.
    writeJson(`geegle-save-${gameId}-${saveKey}`, saveData);
    return { ok: true };
  }
  const { error } = await db()
    .from('game_saves')
    .upsert(
      {
        user_id: userId,
        game_id: gameId,
        save_key: saveKey,
        save_data: saveData as object,
      },
      { onConflict: 'user_id,game_id,save_key' }
    )
    .eq('user_id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function loadGameSave(
  gameId: string,
  saveKey: string,
  userId: string | null
): Promise<OpResult<unknown>> {
  if (!userId || !isSupabaseConfigured) {
    return { ok: true, data: readJson(`geegle-save-${gameId}-${saveKey}`) };
  }
  const { data, error } = await db()
    .from('game_saves')
    .select('save_data')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .eq('save_key', saveKey)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data?.save_data ?? null };
}

// ── Theme ─────────────────────────────────────────────────────────────────────

export function writeThemeLocal(theme: ThemePreference): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

export async function saveTheme(
  theme: ThemePreference,
  userId: string | null
): Promise<OpResult<null>> {
  writeThemeLocal(theme);
  if (!userId || !isSupabaseConfigured) return { ok: true };
  const { error } = await db()
    .from('user_settings')
    .upsert({ id: userId, theme })
    .eq('id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function loadTheme(
  userId: string | null
): Promise<OpResult<string | null>> {
  if (!userId || !isSupabaseConfigured) {
    try {
      return { ok: true, data: localStorage.getItem(THEME_KEY) };
    } catch {
      return { ok: true, data: null };
    }
  }
  const { data, error } = await db()
    .from('user_settings')
    .select('theme')
    .eq('id', userId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data?.theme ?? null };
}

// ── Default proxy servers ─────────────────────────────────────────────────────

export type ServerDefaults = Record<string, number>;

export function readLocalServerDefaults(): ServerDefaults {
  const v = readJson(SERVERS_KEY);
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as ServerDefaults)
    : {};
}

export async function saveServerDefault(
  serviceId: string,
  index: number,
  userId: string | null
): Promise<OpResult<null>> {
  const current = readLocalServerDefaults();
  current[serviceId] = index;
  writeJson(SERVERS_KEY, current);

  if (!userId || !isSupabaseConfigured) return { ok: true };

  const row = await db()
    .from('user_settings')
    .select('settings')
    .eq('id', userId)
    .maybeSingle();
  if (row.error) return { ok: false, error: row.error.message };

  const settings = (row.data?.settings ?? {}) as Record<string, unknown>;
  const servers = (settings.defaultServers ?? {}) as ServerDefaults;
  servers[serviceId] = index;
  settings.defaultServers = servers;

  const upsert = await db()
    .from('user_settings')
    .upsert({ id: userId, settings })
    .eq('id', userId);
  if (upsert.error) return { ok: false, error: upsert.error.message };
  return { ok: true };
}

export async function loadServerDefaults(
  userId: string | null
): Promise<OpResult<ServerDefaults>> {
  if (!userId || !isSupabaseConfigured) {
    return { ok: true, data: readLocalServerDefaults() };
  }
  const { data, error } = await db()
    .from('user_settings')
    .select('settings')
    .eq('id', userId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  const servers = settings.defaultServers;
  return {
    ok: true,
    data:
      servers && typeof servers === 'object' && !Array.isArray(servers)
        ? (servers as ServerDefaults)
        : readLocalServerDefaults(),
  };
}
