// Site entry gate. Verification happens EXCLUSIVELY server-side via the
// `geegle_verify_entry_password` Postgres function (bcrypt against a hash the
// client can never read, with a best-effort per-device attempt limit). The function is
// callable without authentication, so the gate works before sign-in.
//
// When Supabase is not configured the gate shows a clear configuration error
// instead of falling back to client-side checking.

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

/** Best-effort device identifier for the server-side attempt limit. */
function clientIp(): string {
  // This identifier is client-supplied and can be changed; it is not an IP
  // address or a security boundary.
  try {
    let id = localStorage.getItem('geegle-device-id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('geegle-device-id', id);
    }
    return id;
  } catch {
    return 'unknown';
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
    const { data, error } = await supabase.rpc('geegle_verify_entry_password', {
      p_password: trimmed,
      p_ip: clientIp(),
    });

    if (error) {
      console.error('[geegle] entry gate error:', error.message);
      return { ok: false, reason: 'network' };
    }

    if (data && data.valid === true) {
      markUnlocked();
      return { ok: true };
    }
    if (data && data.reason === 'rate_limited') {
      return { ok: false, reason: 'rate_limited' };
    }
    if (data && data.reason === 'gate_not_configured') {
      return { ok: false, reason: 'not_configured' };
    }
    if (data && data.valid === false) {
      return { ok: false, reason: 'invalid' };
    }
    return { ok: false, reason: 'network' };
  } catch {
    return { ok: false, reason: 'network' };
  }
}
