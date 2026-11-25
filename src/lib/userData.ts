// User data layer: account-owned preferences and history. Accounts persist
// indefinitely per the owner's cancellation of the inactivity-deletion feature.
import { supabase, isSupabaseConfigured, T } from './supabase';
import type { OpResult, ThemePreference } from '../types';
import { parseAppearance, type LandingAppearance } from '../landing/appearance';

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

export function toggleFavoriteLocal(id: string): string[] { const f = readStringArray(FAVORITES_KEY); const n = f.includes(id) ? f.filter((x) => x !== id) : [...f, id]; writeJson(FAVORITES_KEY, n); return n; }
export async function toggleFavorite(gameId: string, userId: string | null): Promise<OpResult<string[]>> {
  if (!userId || !isSupabaseConfigured) return { ok: true, data: toggleFavoriteLocal(gameId) };
  const existing = await supabase.from(T.favorites).select('game_id').eq('user_id', userId).eq('game_id', gameId).maybeSingle();
  if (existing.error) return { ok: false, error: existing.error.message };
  const result = existing.data ? await supabase.from(T.favorites).delete().eq('user_id', userId).eq('game_id', gameId) : await supabase.from(T.favorites).insert({ user_id: userId, game_id: gameId });
  if (result.error) return { ok: false, error: result.error.message };
  const all = await supabase.from(T.favorites).select('game_id').eq('user_id', userId);
  return all.error ? { ok: false, error: all.error.message } : { ok: true, data: (all.data ?? []).map((r) => r.game_id) };
}
export async function loadFavorites(userId: string | null): Promise<OpResult<string[]>> { if (!userId || !isSupabaseConfigured) return { ok: true, data: readStringArray(FAVORITES_KEY) }; const { data, error } = await supabase.from(T.favorites).select('game_id').eq('user_id', userId); return error ? { ok: false, error: error.message } : { ok: true, data: (data ?? []).map((r) => r.game_id) }; }
export function pushRecentLocal(id: string): string[] { const n = [id, ...readStringArray(RECENT_KEY).filter((x) => x !== id)].slice(0, RECENT_CAP); writeJson(RECENT_KEY, n); return n; }
export async function trackPlay(gameId: string, userId: string | null): Promise<OpResult<string[]>> {
  if (!userId || !isSupabaseConfigured) return { ok: true, data: pushRecentLocal(gameId) };
  const up = await supabase.from(T.recent).upsert({ user_id: userId, game_id: gameId, played_at: new Date().toISOString() }, { onConflict: 'user_id,game_id' });
  if (up.error) return { ok: false, error: up.error.message };
  const { data, error } = await supabase.from(T.recent).select('game_id').eq('user_id', userId).order('played_at', { ascending: false }).limit(RECENT_CAP);
  return error ? { ok: false, error: error.message } : { ok: true, data: (data ?? []).map((r) => r.game_id) };
}
export async function loadRecent(userId: string | null): Promise<OpResult<string[]>> { if (!userId || !isSupabaseConfigured) return { ok: true, data: readStringArray(RECENT_KEY) }; const { data, error } = await supabase.from(T.recent).select('game_id').eq('user_id', userId).order('played_at', { ascending: false }).limit(RECENT_CAP); return error ? { ok: false, error: error.message } : { ok: true, data: (data ?? []).map((r) => r.game_id) }; }
export function writeThemeLocal(theme: ThemePreference) { try { localStorage.setItem(THEME_KEY, theme); } catch { /* Storage may be disabled. */ } }
export async function saveTheme(theme: ThemePreference, userId: string | null): Promise<OpResult<null>> { if (!userId || !isSupabaseConfigured) { writeThemeLocal(theme); return { ok: true }; } const { error } = await supabase.from(T.settings).upsert({ id: userId, theme }); return error ? { ok: false, error: error.message } : { ok: true }; }
export async function loadTheme(userId: string | null): Promise<OpResult<string | null>> { if (!userId || !isSupabaseConfigured) { try { return { ok: true, data: localStorage.getItem(THEME_KEY) }; } catch { return { ok: true, data: null }; } } const { data, error } = await supabase.from(T.settings).select('theme').eq('id', userId).maybeSingle(); return error ? { ok: false, error: error.message } : { ok: true, data: data?.theme ?? null }; }
export type ServerDefaults = Record<string, number>;

function settingsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function serverDefaults(value: unknown): ServerDefaults {
  return Object.fromEntries(Object.entries(settingsObject(value)).filter((entry): entry is [string, number] => Number.isInteger(entry[1])));
}

async function updateSettings(
  userId: string,
  update: (settings: Record<string, unknown>) => Record<string, unknown>,
): Promise<OpResult<null>> {
  // The settings trigger advances updated_at on every update. Retrying a
  // lost comparison preserves sibling preferences written by another tab.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const row = await supabase.from(T.settings).select('settings,updated_at').eq('id', userId).maybeSingle();
    if (row.error) return { ok: false, error: row.error.message };
    const settings = update(settingsObject(row.data?.settings));
    const write = row.data
      ? supabase.from(T.settings).update({ settings }).eq('id', userId).eq('updated_at', row.data.updated_at)
      : supabase.from(T.settings).upsert({ id: userId, settings }, { onConflict: 'id', ignoreDuplicates: true });
    const applied = await write.select('id').maybeSingle();
    if (applied.error) return { ok: false, error: applied.error.message };
    if (applied.data) return { ok: true };
  }
  return { ok: false, error: 'Your settings changed on another device. Try saving again.' };
}

export function readLocalServerDefaults(): ServerDefaults {
  return serverDefaults(readJson(SERVERS_KEY));
}

export async function saveServerDefault(serviceId: string, index: number, userId: string | null): Promise<OpResult<null>> {
  if (!userId || !isSupabaseConfigured) {
    writeJson(SERVERS_KEY, { ...readLocalServerDefaults(), [serviceId]: index });
    return { ok: true };
  }
  return updateSettings(userId, (settings) => ({
    ...settings,
    defaultServers: { ...serverDefaults(settings.defaultServers), [serviceId]: index },
  }));
}

export async function loadServerDefaults(userId: string | null): Promise<OpResult<ServerDefaults>> {
  if (!userId || !isSupabaseConfigured) return { ok: true, data: readLocalServerDefaults() };
  const { data, error } = await supabase.from(T.settings).select('defaults:settings->defaultServers').eq('id', userId).maybeSingle();
  return error ? { ok: false, error: error.message } : { ok: true, data: serverDefaults(data?.defaults) };
}

export async function loadLandingAppearance(userId: string): Promise<OpResult<LandingAppearance | null>> {
  const { data, error } = await supabase.from(T.settings).select('appearance:settings->landingAppearance').eq('id', userId).maybeSingle();
  return error ? { ok: false, error: error.message } : { ok: true, data: parseAppearance(data?.appearance) };
}

export async function saveLandingAppearance(userId: string, value: LandingAppearance): Promise<OpResult<null>> {
  const appearance = parseAppearance(value);
  if (!appearance) return { ok: false, error: 'Invalid landing appearance.' };
  return updateSettings(userId, (settings) => ({ ...settings, landingAppearance: appearance }));
}
