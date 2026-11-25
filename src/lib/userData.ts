// User data layer: favorites, recently played, theme, settings, and default
// proxy servers. Signed-in users sync via Supabase (RLS: owner-only access).
// Anonymous users keep using localStorage, preserving pre-account behavior.

import { supabase, isSupabaseConfigured } from './supabase';
import type { ThemePreference } from '../types';
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
    /* storage unavailable */
  }
}

function readStringArray(key: string): string[] {
  const v = readJson(key);
  return Array.isArray(v) ? (v as string[]) : [];
}

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
  signedIn: boolean
): Promise<string[]> {
  if (!signedIn || !isSupabaseConfigured) return toggleFavoriteLocal(gameId);
  const { data: existing } = await supabase
    .from('favorites')
    .select('game_id')
    .eq('game_id', gameId)
    .maybeSingle();
  if (existing) {
    await supabase.from('favorites').delete().eq('game_id', gameId);
  } else {
    await supabase.from('favorites').insert({ game_id: gameId });
  }
  const { data } = await supabase.from('favorites').select('game_id');
  return (data ?? []).map((r) => r.game_id);
}

export async function loadFavorites(signedIn: boolean): Promise<string[]> {
  if (!signedIn || !isSupabaseConfigured) return readStringArray(FAVORITES_KEY);
  const { data } = await supabase.from('favorites').select('game_id');
  return (data ?? []).map((r) => r.game_id);
}

export function pushRecentLocal(gameId: string): string[] {
  let recent = readStringArray(RECENT_KEY);
  recent = [gameId, ...recent.filter((id) => id !== gameId)].slice(0, 24);
  writeJson(RECENT_KEY, recent);
  return recent;
}

export async function trackPlay(
  gameId: string,
  signedIn: boolean
): Promise<string[]> {
  if (!signedIn || !isSupabaseConfigured) return pushRecentLocal(gameId);
  const { error } = await supabase
    .from('recently_played')
    .upsert(
      { game_id: gameId, played_at: new Date().toISOString() },
      { onConflict: 'user_id,game_id' }
    );
  if (error) return pushRecentLocal(gameId);
  const { data } = await supabase
    .from('recently_played')
    .select('game_id')
    .order('played_at', { ascending: false })
    .limit(24);
  return (data ?? []).map((r) => r.game_id);
}

export async function loadRecent(signedIn: boolean): Promise<string[]> {
  if (!signedIn || !isSupabaseConfigured) return readStringArray(RECENT_KEY);
  const { data } = await supabase
    .from('recently_played')
    .select('game_id')
    .order('played_at', { ascending: false })
    .limit(24);
  return (data ?? []).map((r) => r.game_id);
}

export function writeThemeLocal(theme: ThemePreference): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

export async function saveTheme(
  theme: ThemePreference,
  signedIn: boolean
): Promise<void> {
  writeThemeLocal(theme);
  if (!signedIn || !isSupabaseConfigured) return;
  await supabase.from('user_settings').upsert({ theme });
}

export async function loadTheme(signedIn: boolean): Promise<string | null> {
  if (!signedIn || !isSupabaseConfigured) {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  }
  const { data } = await supabase
    .from('user_settings')
    .select('theme')
    .maybeSingle();
  return data?.theme ?? null;
}

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
  signedIn: boolean
): Promise<void> {
  const current = readLocalServerDefaults();
  current[serviceId] = index;
  writeJson(SERVERS_KEY, current);
  if (!signedIn || !isSupabaseConfigured) return;
  const { data: row } = await supabase
    .from('user_settings')
    .select('settings')
    .maybeSingle();
  const settings = (row?.settings ?? {}) as Record<string, unknown>;
  const servers = (settings.defaultServers ?? {}) as ServerDefaults;
  servers[serviceId] = index;
  settings.defaultServers = servers;
  await supabase.from('user_settings').upsert({ settings });
}

export async function loadServerDefaults(
  signedIn: boolean
): Promise<ServerDefaults> {
  if (!signedIn || !isSupabaseConfigured) return readLocalServerDefaults();
  const { data } = await supabase
    .from('user_settings')
    .select('settings')
    .maybeSingle();
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  const servers = settings.defaultServers;
  return servers && typeof servers === 'object' && !Array.isArray(servers)
    ? (servers as ServerDefaults)
    : readLocalServerDefaults();
}
