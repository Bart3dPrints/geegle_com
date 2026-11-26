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
  if (msg.includes('not confirmed')) {
    return 'This account is not activated yet. Please contact support.';
  }
  return 'Something went wrong. Please try again.';
}

const USERNAME_TAKEN = 'That username is already taken.';
const ACCOUNT_UNAVAILABLE =
  'The account service is unavailable right now. Please try again shortly.';
const ACCOUNT_NOT_ACTIVATED =
  'This deployment could not activate the new account. Please try again shortly.';

/**
 * Duplicate usernames arrive in three shapes depending on project settings
 * and timing: 422 `user_already_exists`, a sanitized 200 response with no
 * identities, or a 23505 unique violation when two requests race. The
 * database enforces uniqueness in every case; this only maps the reply.
 */
function isDuplicateSignup(error: {
  code?: string;
  message?: string;
}): boolean {
  // Supabase normally reports a string code, but GoTrue's unique violation
  // arrives as the number 23505, so coerce before comparing.
  const code = String(error.code ?? '').toLowerCase();
  const msg = String(error.message ?? '').toLowerCase();
  return (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    code === '23505' ||
    msg.includes('already registered') ||
    msg.includes('already been registered') ||
    msg.includes('already exists') ||
    msg.includes('duplicate key') ||
    msg.includes('unique constraint')
  );
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
  // The stored identity is the lowercase synthetic address; the typed
  // capitalisation is kept as display metadata only.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username: username.trim() } },
  });

  if (error) {
    if (import.meta.env.DEV) {
      // Redacted: status and code only, never the password or the full body.
      console.debug('[geegle-auth] signup failed: status=%s code=%s', error.status ?? 'n/a', error.code ?? 'n/a');
    }
    if (isDuplicateSignup(error)) return { ok: false, error: USERNAME_TAKEN };
    if (error.status === 429) {
      return { ok: false, error: 'Too many attempts. Please wait a minute and try again.' };
    }
    if (error.status && error.status >= 500) {
      return { ok: false, error: ACCOUNT_UNAVAILABLE };
    }
    return { ok: false, error: friendlyAuthError(error.message) };
  }

  if (data.session) {
    return {
      ok: true,
      user: data.user ?? undefined,
      session: data.session,
    };
  }

  // No session. A duplicate registration is answered with a sanitized user
  // that has no identities; anything else means the account exists but this
  // deployment did not activate it, so try the password the user just chose.
  if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
    return { ok: false, error: USERNAME_TAKEN };
  }

  const { data: signedIn, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password });
  if (!signInError && signedIn.session) {
    return {
      ok: true,
      user: signedIn.user ?? undefined,
      session: signedIn.session,
    };
  }
  if (
    signInError?.code === 'email_not_confirmed' ||
    (signInError?.message ?? '').toLowerCase().includes('not confirmed')
  ) {
    return { ok: false, error: ACCOUNT_NOT_ACTIVATED };
  }
  if (signInError) return { ok: false, error: USERNAME_TAKEN };
  return { ok: false, error: ACCOUNT_UNAVAILABLE };
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
    if (import.meta.env.DEV) {
      console.debug('[geegle-auth] signin failed: status=%s code=%s', error.status ?? 'n/a', error.code ?? 'n/a');
    }
    return { ok: false, error: friendlyAuthError(error.message) };
  }

  return {
    ok: true,
    user: data.user ?? undefined,
    session: data.session ?? undefined,
  };
}

export async function logout(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  return error ? friendlyAuthError(error.message) : null;
}
