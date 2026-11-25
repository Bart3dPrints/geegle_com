// User data layer: account-owned preferences and history. Accounts persist
// indefinitely per the owner's cancellation of the inactivity-deletion feature.
import { supabase, isSupabaseConfigured, T } from './supabase';
import type { OpResult, ThemePreference } from '../types';
import { canonicalGameId, distinctGameIds, equivalentGameIds } from '../data/gameIds';

function readJson(key: string): unknown { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function writeJson(key: string, value: unknown): void { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage may be disabled. */ } }
function readStringArray(key: string): string[] { const v = readJson(key); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; }
export const FAVORITES_KEY = 'geegle-favorites';
export const RECENT_KEY = 'geegle-recently-played';
export const THEME_KEY = 'geegle-theme';
export const SERVERS_KEY = 'geegle-default-servers';
// Storage optimization retained after deletion-feature cancellation: recently
// played history is capped at 50 games per account.
const RECENT_CAP = 50;

function canonicalize(ids: string[]): string[] {
  return distinctGameIds(ids.map(canonicalGameId));
}

function localFavorites(): string[] { return canonicalize(readStringArray(FAVORITES_KEY)); }

export function toggleFavoriteLocal(id: string): string[] {
  const canonical = canonicalGameId(id);
  const favorites = readStringArray(FAVORITES_KEY);
  const isFavorite = favorites.some((favorite) => canonicalGameId(favorite) === canonical);
  const next = isFavorite
    ? favorites.filter((favorite) => canonicalGameId(favorite) !== canonical)
    : [...favorites, canonical];
  writeJson(FAVORITES_KEY, next);
  return canonicalize(next);
}

export async function setFavorite(gameId: string, userId: string | null, favorite: boolean): Promise<OpResult<string[]>> {
  const canonical = canonicalGameId(gameId);
  const aliases = equivalentGameIds(canonical);
  if (!userId) {
    const current = readStringArray(FAVORITES_KEY);
    const next = favorite
      ? current.some((id) => canonicalGameId(id) === canonical) ? current : [...current, canonical]
      : current.filter((id) => !aliases.includes(id));
    writeJson(FAVORITES_KEY, next);
    return { ok: true, data: canonicalize(next) };
  }
  if (!isSupabaseConfigured) return { ok: false, error: 'Account sync unavailable' };

  const result = favorite
    ? await supabase.from(T.favorites).upsert({ user_id: userId, game_id: canonical }, { onConflict: 'user_id,game_id', ignoreDuplicates: true })
    : await supabase.from(T.favorites).delete().eq('user_id', userId).in('game_id', aliases);
  if (result.error) return { ok: false, error: result.error.message };

  const all = await supabase.from(T.favorites).select('game_id').eq('user_id', userId);
  return all.error
    ? { ok: false, error: all.error.message }
    : { ok: true, data: canonicalize((all.data ?? []).map((row) => row.game_id)) };
}

export async function toggleFavorite(gameId: string, userId: string | null): Promise<OpResult<string[]>> {
  const loaded = await loadFavorites(userId);
  if (!loaded.ok || !loaded.data) return loaded;
  const canonical = canonicalGameId(gameId);
  return setFavorite(canonical, userId, !loaded.data.includes(canonical));
}

export async function loadFavorites(userId: string | null): Promise<OpResult<string[]>> {
  if (!userId) return { ok: true, data: localFavorites() };
  if (!isSupabaseConfigured) return { ok: false, error: 'Account sync unavailable' };
  const { data, error } = await supabase.from(T.favorites).select('game_id').eq('user_id', userId);
  return error ? { ok: false, error: error.message } : { ok: true, data: canonicalize((data ?? []).map((row) => row.game_id)) };
}

export function pushRecentLocal(id: string): string[] {
  const canonical = canonicalGameId(id);
  const next = [canonical, ...readStringArray(RECENT_KEY).filter((gameId) => gameId !== canonical)].slice(0, RECENT_CAP);
  writeJson(RECENT_KEY, next);
  return canonicalize(next);
}

export async function trackPlay(gameId: string, userId: string | null): Promise<OpResult<string[]>> {
  const canonical = canonicalGameId(gameId);
  if (!userId) return { ok: true, data: pushRecentLocal(canonical) };
  if (!isSupabaseConfigured) return { ok: false, error: 'Account sync unavailable' };
  const up = await supabase.from(T.recent).upsert({ user_id: userId, game_id: canonical, played_at: new Date().toISOString() }, { onConflict: 'user_id,game_id' });
  if (up.error) return { ok: false, error: up.error.message };
  const { data, error } = await supabase.from(T.recent).select('game_id').eq('user_id', userId).order('played_at', { ascending: false }).limit(RECENT_CAP + 1);
  return error ? { ok: false, error: error.message } : { ok: true, data: canonicalize((data ?? []).map((row) => row.game_id)).slice(0, RECENT_CAP) };
}

export async function loadRecent(userId: string | null): Promise<OpResult<string[]>> {
  if (!userId) return { ok: true, data: canonicalize(readStringArray(RECENT_KEY)) };
  if (!isSupabaseConfigured) return { ok: false, error: 'Account sync unavailable' };
  const { data, error } = await supabase.from(T.recent).select('game_id').eq('user_id', userId).order('played_at', { ascending: false }).limit(RECENT_CAP + 1);
  return error ? { ok: false, error: error.message } : { ok: true, data: canonicalize((data ?? []).map((row) => row.game_id)).slice(0, RECENT_CAP) };
}
export function writeThemeLocal(theme: ThemePreference) { try { localStorage.setItem(THEME_KEY, theme); } catch { /* Storage may be disabled. */ } }
export async function saveTheme(theme: ThemePreference, userId: string | null): Promise<OpResult<null>> { if (!userId || !isSupabaseConfigured) { writeThemeLocal(theme); return { ok: true }; } const { error } = await supabase.from(T.settings).upsert({ id: userId, theme }); return error ? { ok: false, error: error.message } : { ok: true }; }
export async function loadTheme(userId: string | null): Promise<OpResult<string | null>> { if (!userId || !isSupabaseConfigured) { try { return { ok: true, data: localStorage.getItem(THEME_KEY) }; } catch { return { ok: true, data: null }; } } const { data, error } = await supabase.from(T.settings).select('theme').eq('id', userId).maybeSingle(); return error ? { ok: false, error: error.message } : { ok: true, data: data?.theme ?? null }; }
export type ServerDefaults = Record<string, number>;
export function readLocalServerDefaults(): ServerDefaults { const v = readJson(SERVERS_KEY); return v && typeof v === 'object' && !Array.isArray(v) ? v as ServerDefaults : {}; }
export async function saveServerDefault(serviceId: string, index: number, userId: string | null): Promise<OpResult<null>> { if (!userId || !isSupabaseConfigured) { const current = readLocalServerDefaults(); current[serviceId] = index; writeJson(SERVERS_KEY, current); return { ok: true }; } const row = await supabase.from(T.settings).select('settings').eq('id', userId).maybeSingle(); if (row.error) return { ok: false, error: row.error.message }; const settings = (row.data?.settings ?? {}) as Record<string, unknown>; const servers = (settings.defaultServers ?? {}) as ServerDefaults; servers[serviceId] = index; settings.defaultServers = servers; const up = await supabase.from(T.settings).upsert({ id: userId, settings }); return up.error ? { ok: false, error: up.error.message } : { ok: true }; }
export async function loadServerDefaults(userId: string | null): Promise<OpResult<ServerDefaults>> { if (!userId || !isSupabaseConfigured) return { ok: true, data: readLocalServerDefaults() }; const { data, error } = await supabase.from(T.settings).select('settings').eq('id', userId).maybeSingle(); if (error) return { ok: false, error: error.message }; const s = (data?.settings as Record<string, unknown> | undefined)?.defaultServers; return { ok: true, data: s && typeof s === 'object' && !Array.isArray(s) ? s as ServerDefaults : {} }; }
