// Username/password account service backed by Supabase Auth.
// Usernames are unique; the "email" is a synthetic local address because
// Supabase Auth requires one. No real email is ever collected or verified.
// Sessions persist (persistSession: true) so login survives refreshes.

import { supabase, isSupabaseConfigured } from './supabase';
import type { SessionUser } from '../types';
import type { User } from '@supabase/supabase-js';

export const USERNAME_RE = /^[a-zA-Z0-9_-]{3,32}$/;
const SYNTHETIC_DOMAIN = 'users.geegle.local';

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'username_taken'
  | 'username_invalid'
  | 'not_configured'
  | 'rate_limited'
  | 'network';

export class AuthError extends Error {
  code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function toSyntheticEmail(username: string): string {
  return username.toLowerCase() + '@' + SYNTHETIC_DOMAIN;
}

// Client-side rate limiting to take pressure off the server (the server
// enforces its own limits via the Edge Function and auth hooks).
const attempts = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_MINUTE = 8;

function clientRateLimited(key: string): boolean {
  const now = Date.
  // placeholder
}
