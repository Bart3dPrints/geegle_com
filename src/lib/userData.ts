// User data layer: favorites, recently played, theme, settings, and default
// proxy servers — all in geegle_* tables with explicit user ids and RLS
// owner-only policies. Errors surface to callers as OpResult.

import { supabase, isSupabaseConfigured, T } from './supabase';
import type { OpResult, ThemePreference } from '../types';

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
    /* storage unavailable */
  }
}

function readStringArray(key: string): string[] {
  const v = readJson(key);
  return Array.isArray(v) ? (v as string[]) : [];
}

export const FAVORITES_KEY = 'geegle-favorites';
export const RECENT_KEY = 'geegle-recently-played';
export const THEME_KEY = 'geegle-theme';
export const SERVERS_KEY = 'geegle-default-servers';

// ── Favorites ───────────────────────────────────────────────────────────────

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

  const existing = await supabase
    .from(T.favorites)
    .select('game_id')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .maybeSingle();
  if (existing.error) return { ok: false, error: existing.error.message };

  if (existing.data) {
    const removed = await supabase
      .from(T.favorites)
      .delete()
      .eq('user_id', userId)
      .eq('game_id', gameId);
    if (removed.error) return { ok: false, error: removed.error.message };
  } else {
    const added = await supabase
      .from(T.favorites)
      .insert({ user_id: userId, game_id: gameId });
    if (added.error) return { ok: false, error: added.error.message };
  }

  const all = await supabase
    .from(T.favorites)
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
  const { data, error } = await supabase
    .from(T.favorites)
    .select('game_id')
    .eq('user_id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map((r) => r.game_id) };
}

// ── Recently played ──────────────────────────────────────────────────────

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

  const upsert = await supabase
    .from(T.recent)
    .upsert(
      { user_id: userId, game_id: gameId, played_at: new Date().toISOString() },
      { onConflict: 'user_id,game_id' }
    );
  if (upsert.error) {
    return { ok: false, error: upsert.error.message, data: pushRecentLocal(gameId) };
  }

  const { data, error } = await supabase
    .from(T.recent)
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
  const { data, error } = await supabase
    .from(T.recent)
    .select('game_id')
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
    .limit(24);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map((r) => r.game_id) };
}

// ── Theme ─────────────────────────────────────────────────────────────────

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
  const { error } = await supabase
    .from(T.settings)
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
  const { data, error } = await supabase
    .from(T.settings)
    .select('theme')
    .eq('id', userId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data?.theme ?? null };
}

// ── Default proxy servers ────────────────────────────────────────────────

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

  const row = await supabase
    .from(T.settings)
    .select('settings')
    .eq('id', userId)
    .maybeSingle();
  if (row.error) return { ok: false, error: row.error.message };

  const settings = (row.data?.settings ?? {}) as Record<string, unknown>;
  const servers = (settings.defaultServers ?? {}) as ServerDefaults;
  servers[serviceId] = index;
  settings.defaultServers = servers;

  const upsert = await supabase
    .from(T.settings)
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
  const { data, error } = await supabase
    .from(T.settings)
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
