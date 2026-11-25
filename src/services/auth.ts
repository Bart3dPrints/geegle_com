// Username/password account service backed by Supabase Auth.
// Usernames are unique (synthetic email collision = rejection at the server).
// Sessions persist across reloads via Supabase's localStorage session store.

import { supabase, isSupabaseConfigured, usernameToEmail } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthResult {
  ok: boolean;
  error?: string;
  user?: User;
  session?: Session;
}

/** Client-side validation mirroring the server constraints. */
export function validateCredentials(
  username: string,
  password: string
): string | null {
  if (!/^[a-z0-9_-]{3,32}$/i.test(username.trim())) {
    return 'Username must be 3-32 characters (letters, numbers, underscore, hyphen).';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (password.length > 72) {
    return 'Password must be at most 72 characters.';
  }
  return null;
}

/**
 * Friendly, non-revealing error messages. Login failures never say whether
 * a username exists (anti-enumeration).
 */
function friendlyAuthError(raw: string): string {
  const msg = raw.toLowerCase();
  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid email or password')
  ) {
    return 'Invalid username or password.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (msg.includes('password should be')) {
    return 'Password must be at least 8 characters.';
  }
  if (msg.includes('already registered') || msg.includes('already exists')) {
    return 'That username is already taken.';
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Could not reach the account service. Check your connection.';
  }
  return 'Something went wrong. Please try again.';
}

export async function register(
  username: string,
  password: string
): Promise<AuthResult> {
  const problem = validateCredentials(username, password);
  if (problem) return { ok: false, error: problem };
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      error: 'Accounts are not configured on this deployment.',
    };
  }

  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    if (
      error.message.toLowerCase().includes('already registered') ||
      error.status === 422
    ) {
      return { ok: false, error: 'That username is already taken.' };
    }
    return { ok: false, error: friendlyAuthError(error.message) };
  }

  return {
    ok: true,
    user: data.user ?? undefined,
    session: data.session ?? undefined,
  };
}

export async function login(
  username: string,
  password: string
): Promise<AuthResult> {
  const problem = validateCredentials(username, password);
  if (problem) return { ok: false, error: problem };
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      error: 'Accounts are not configured on this deployment.',
    };
  }

  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { ok: false, error: friendlyAuthError(error.message) };
  }

  return {
    ok: true,
    user: data.user ?? undefined,
    session: data.session ?? undefined,
  };
}

export async function logout(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('[geegle] sign-out failed:', error.message);
  }
}
