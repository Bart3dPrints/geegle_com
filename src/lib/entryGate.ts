// Site entry gate: verifies the shared entry password server-side via the
// Supabase Edge Function. The password is never present in the client bundle.
// Falls back to a client-side SHA-256 comparison ONLY when the backend is not
// configured, so the gate never hard-fails offline (dev parity with legacy).

import { isSupabaseConfigured, supabase } from './supabase';

const ENTRY_KEY = 'geegle-entry-ok';
// SHA-256("pirate") — legacy fallback only; primary check is server-side.
const FALLBACK_HASH =
  '2c6d7e950239d3e75d444569a1a78a73532014ba9c6731c690bad1e45988c597';

export type GateStatus = 'checking' | 'locked' | 'open' | 'unavailable';

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

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyEntryPassword(password: string): Promise<
  { ok: boolean; reason?: 'invalid' | 'rate_limited' | 'unavailable' }
> {
  const trimmed = password.trim().toLowerCase();

  if (!trimmed) return { ok: false, reason: 'invalid' };

  // Primary path: server-side verification (Edge Function).
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.functions.invoke(
        'verify-entry-password',
        { body: { password: trimmed } }
      );
      if (!error && data && data.valid === true) {
        markUnlocked();
        return { ok: true };
      }
      if (data?.reason === 'rate_limited' || error?.context?.status === 429) {
        return { ok: false, reason: 'rate_limited' };
      }
      return { ok: false, reason: 'invalid' };
    } catch {
      // Network failure → fall through to local fallback.
    }
  }

  // Fallback (unconfigured backend or network failure): client-side hash.
  const hash = await sha256Hex(trimmed);
  if (hash === FALLBACK_HASH) {
    markUnlocked();
    return { ok: true };
  }
  return { ok: false, reason: 'invalid' };
}

export function lockEntry(): void {
  try {
    localStorage.removeItem(ENTRY_KEY);
  } catch {
    /* ignore */
  }
}
