// User data layer: account-owned preferences and history. Accounts persist
// indefinitely per the owner's cancellation of the inactivity-deletion feature.
import { supabase, isSupabaseConfigured, T } from './supabase';
import type { OpResult, ThemePreference } from '../types';
import { canonicalGameId, distinctGameIds, equivalentGameIds } from '../data/gameIds';

function readJson(key: string): unknown { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function writeJson(key: string, value: unknown): void { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function readStringArray(key: string): string[] { const v = readJson(key); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; }
export const FAVORITES_KEY = 'geegle-favorites';
export const RECENT_KEY = 'geegle-recently-played';
export const THEME_KEY = 'geegle-theme';
export const SERVERS_KEY = 'geegle-default-servers';
// Storage optimization retained after deletion-feature cancellation: recently
// played history is capped at 50 games per account.
const RECENT_CAP = 50;

export async function setFavorite(
  gameId: string, userId: string | null, favorite: boolean,
): Promise<OpResult<string[]>> {
  const id = canonicalGameId(gameId);
  const aliases = equivalentGameIds(id);
  if (!userId) {
    const raw = readStringArray(FAVORITES_KEY);
    const next = favorite
      ? raw.includes(id) ? raw : [...raw, id]
      : raw.filter((storedId) => !aliases.includes(storedId));
    writeJson(FAVORITES_KEY, next);
    return { ok: true, data: distinctGameIds(next) };
  }
  if (!isSupabaseConfigured) return { ok: false, error: 'Account sync unavailable' };
  const result = favorite
    ? await supabase.from(T.favorites).upsert({ user_id: userId, game_id: id }, {
      onConflict: 'user_id,game_id', ignoreDuplicates: true,
    })
    : await supabase.from(T.favorites).delete().eq('user_id', userId).in('game_id', aliases);
  return result.error ? { ok: false, error: result.error.message } : loadFavorites(userId);
}

export async function loadFavorites(userId: string | null): Promise<OpResult<string[]>> {
  if (!userId) return { ok: true, data: distinctGameIds(readStringArray(FAVORITES_KEY)) };
  if (!isSupabaseConfigured) return { ok: false, error: 'Account sync unavailable' };
  const { data, error } = await supabase.from(T.favorites).select('game_id').eq('user_id', userId);
  return error
    ? { ok: false, error: error.message }
    : { ok: true, data: distinctGameIds((data ?? []).map((row) => row.game_id)) };
}

function recentIds(ids: string[]): string[] {
  return distinctGameIds(ids).slice(0, RECENT_CAP);
}

export function pushRecentLocal(gameId: string): string[] {
  const id = canonicalGameId(gameId);
  const raw = [id, ...readStringArray(RECENT_KEY).filter((storedId) => storedId !== id)];
  // Allow the one legacy alias without reducing the number of visible slots.
  const limit = RECENT_CAP + Number(distinctGameIds(raw).length < raw.length);
  const next = raw.slice(0, limit);
  writeJson(RECENT_KEY, next);
  return recentIds(next);
}

export async function trackPlay(gameId: string, userId: string | null): Promise<OpResult<string[]>> {
  if (!userId) return { ok: true, data: pushRecentLocal(gameId) };
  if (!isSupabaseConfigured) return { ok: false, error: 'Account sync unavailable' };
  const up = await supabase.from(T.recent).upsert({
    user_id: userId, game_id: canonicalGameId(gameId), played_at: new Date().toISOString(),
  }, { onConflict: 'user_id,game_id' });
  return up.error ? { ok: false, error: up.error.message } : loadRecent(userId);
}

export async function loadRecent(userId: string | null): Promise<OpResult<string[]>> {
  if (!userId) return { ok: true, data: recentIds(readStringArray(RECENT_KEY)) };
  if (!isSupabaseConfigured) return { ok: false, error: 'Account sync unavailable' };
  const { data, error } = await supabase.from(T.recent).select('game_id').eq('user_id', userId)
    .order('played_at', { ascending: false }).order('game_id').limit(RECENT_CAP + 1);
  return error
    ? { ok: false, error: error.message }
    : { ok: true, data: recentIds((data ?? []).map((row) => row.game_id)) };
}
export function writeThemeLocal(theme: ThemePreference) { try { localStorage.setItem(THEME_KEY, theme); } catch {} }
export async function saveTheme(theme: ThemePreference, userId: string | null): Promise<OpResult<null>> { writeThemeLocal(theme); if (!userId || !isSupabaseConfigured) return { ok: true }; const { error } = await supabase.from(T.settings).upsert({ id: userId, theme }); return error ? { ok: false, error: error.message } : { ok: true }; }
export async function loadTheme(userId: string | null): Promise<OpResult<string | null>> { if (!userId || !isSupabaseConfigured) { try { return { ok: true, data: localStorage.getItem(THEME_KEY) }; } catch { return { ok: true, data: null }; } } const { data, error } = await supabase.from(T.settings).select('theme').eq('id', userId).maybeSingle(); return error ? { ok: false, error: error.message } : { ok: true, data: data?.theme ?? null }; }
export type ServerDefaults = Record<string, number>;
export function readLocalServerDefaults(): ServerDefaults { const v = readJson(SERVERS_KEY); return v && typeof v === 'object' && !Array.isArray(v) ? v as ServerDefaults : {}; }
export async function saveServerDefault(serviceId: string, index: number, userId: string | null): Promise<OpResult<null>> { const current = readLocalServerDefaults(); current[serviceId] = index; writeJson(SERVERS_KEY, current); if (!userId || !isSupabaseConfigured) return { ok: true }; const row = await supabase.from(T.settings).select('settings').eq('id', userId).maybeSingle(); if (row.error) return { ok: false, error: row.error.message }; const settings = (row.data?.settings ?? {}) as Record<string, unknown>; const servers = (settings.defaultServers ?? {}) as ServerDefaults; servers[serviceId] = index; settings.defaultServers = servers; const up = await supabase.from(T.settings).upsert({ id: userId, settings }); return up.error ? { ok: false, error: up.error.message } : { ok: true }; }
export async function loadServerDefaults(userId: string | null): Promise<OpResult<ServerDefaults>> { if (!userId || !isSupabaseConfigured) return { ok: true, data: readLocalServerDefaults() }; const { data, error } = await supabase.from(T.settings).select('settings').eq('id', userId).maybeSingle(); if (error) return { ok: false, error: error.message }; const s = (data?.settings as Record<string, unknown> | undefined)?.defaultServers; return { ok: true, data: s && typeof s === 'object' && !Array.isArray(s) ? s as ServerDefaults : readLocalServerDefaults() }; }
