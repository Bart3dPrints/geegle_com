// Site entry gate. Verification happens EXCLUSIVELY server-side via the
// Supabase Edge Function `verify-entry-password`: the PBKDF2 hash of the
// password exists only as an Edge Function secret, never in this codebase.
//
// When Supabase is not configured the gate shows a clear configuration error
// instead of falling back to client-side checking — a client-side check
// would expose the gate to anyone reading the bundle.

import { isSupabaseConfigured, supabase } from './supabase';

const ENTRY_KEY = 'geegle-entry-ok';

export type GateResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'rate_limited' | 'not_configured' | 'network' };

export function isEntryUnlocked(): boolean {
  try {
    return localStorage.getItem(ENTRY_KEY) === '1';
  } catch {
    return false;
  }
}

function markUnlocked(): void {
  try {
    localStorage.setItem(ENTRY_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function lockEntry(): void {
  try {
    localStorage.removeItem(ENTRY_KEY);
  } catch {
    /* ignore */
  }
}

export async function verifyEntryPassword(
  password: string
): Promise<GateResult> {
  const trimmed = password.trim();
  if (!trimmed) return { ok: false, reason: 'invalid' };

  if (!isSupabaseConfigured) {
    return { ok: false, reason: 'not_configured' };
  }

  try {
    const { data, error } = await supabase.functions.invoke(
      'verify-entry-password',
      { body: { password: trimmed } }
    );

    if (data && data.valid === true) {
      markUnlocked();
      return { ok: true };
    }

    const status = (error as { context?: { status?: number } } | null)?.context
      ?.status;
    if (status === 429 || data?.reason === 'rate_limited') {
      return { ok: false, reason: 'rate_limited' };
    }
    if (data?.valid === false) {
      return { ok: false, reason: 'invalid' };
    }
    // Edge function not deployed or returned an unexpected error.
    return { ok: false, reason: 'network' };
  } catch {
    return { ok: false, reason: 'network' };
  }
}
