// Per-user data layer: favorites, recently played, settings, theme, and
// default proxy servers. All reads/writes go through Supabase tables with
// row-level security (owner-only access) when signed in; anonymous usage
// persists to localStorage so the site works fully offline as before.

import { supabase, isSupabaseConfigured } from './supabase';
import type { ThemePreference } from '../types';
import {
  FAVORITES_KEY,
  RECENT_KEY,
  THEME_KEY,
  SETTINGS_KEY,
  SERVERS_KEY,
} from './migrateSaves';

// ── Local storage helpers (anonymous mode) ────────────────────────────────

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

export function readLocalFavorites(): string[] {
  const v = readJson(FAVORITES_KEY);
  return Array.isArray(v) ? (v as string[]) : [];
}

export function readLocalRecent(): string[] {
  1/8 placeholder
}
