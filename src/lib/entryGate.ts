// Site entry gate. Verification happens server-side via the Supabase Edge
// Function `verify-entry-password` (PBKDF2 hash of `pirate` lives only as an
// Edge Function secret). When the backend is not configured, we fall back to
// a client-side constant-time hash comparison so the site is never locked
// out — the fallback hash is NOT the password and is of no use offline.

import { isSupabaseConfigured, supabase } from './supabase';

const ENTRY_KEY = 'geegle-entry-ok';
// SHA-256 of the entry password — fallback only when no backend is deployed.
const FALLBACK_HASH =
  '2c6d7e950239d3e75d444569a1a78a73532014ba9c6731c690bad1e45988c597';

export type GateResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'rate_limited' | 'unavailable' };

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

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time string comparison. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyEntryPassword(password: string): Promise<GateResult> {
  const trimmed = password.trim();
  if (!trimmed) return { ok: false, reason: 'invalid' };

  // Primary path: server-side verification with rate limiting.
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
      const status = (error as { context?: { status?: number } } | null)
        ?.context?.status;
      if (status === 429 || data?.reason === 'rate_limited') {
        return { ok: false, reason: 'rate_limited' };
      }
      if (data?.valid === false) {
        return { ok: false, reason: 'invalid' };
      }
      // Network/edge failure: fall through to local fallback below.
    } catch {
      /* fall through */
    }
  }

  // Offline fallback (backend not configured or unreachable).
  const hash = await sha256Hex(trimmed);
  if (timingSafeEqual(hash, FALLBACK_HASH)) {
    markUnlocked();
    return { ok: true };
  }
  return { ok: false, reason: 'invalid' };
}
