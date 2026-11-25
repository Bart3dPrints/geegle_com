// Username/password account service backed by Supabase Auth.
// Usernames are unique; the "email" is a synthetic local address because
// Supabase Auth requires one. No real email is ever collected or verified.
// Sessions persist (persistSession: true) so login survives refreshes and
// syncs across devices via the server-side session token.

import { supabase, isSupabaseConfigured } from './supabase';
import type { SessionUser } from '../types';

export const USERNAME_RE = /^[a-zA-Z0-9_-]{3,32}$/;
const SYNTHETIC_DOMAIN = 'users.geegle.local';

export class AuthError extends Error {
  code: 'invalid_credentials' | 'username_taken' | 'username_invalid' | 'not_configured' | 'rate_limited' | 'network';

  constructor(code: AuthError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

export function toSyntheticEmail(username: string): string {
  return username.toLowerCase() + '@' + SYNTHETIC_DOMAIN;
}

export function usernameFromSession(user: SessionUser | null): string | null {
  return user?.username ?? null;
}

// Client-side rate limiting to take pressure off the server (the server
// enforces its own limits via the Edge Function / auth hooks).
const attempts = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_MINUTE = 8;

function clientRateLimited(key: string): boolean {
  const now = Date.now();
  const window = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  window.push(now);
  attempts.set(key, window);
  return window.length > MAX_ATTEMPTS_PER_MINUTE;
}

export function isUsernameValid(username: string): boolean {
  return USERNAME_RE.test(username);
}

export async function register(username: string, password: string): Promise<SessionUser> {
  if (!isUsernameValid(username)) {
    throw new AuthError('username_invalid', 'Username must be 3-32 characters: letters, numbers, _ or -');
  }
  if (password.length < 8) {
    throw new AuthError('username_invalid', 'Password must be at least 8 characters');
  }
  if (!isSupabaseConfigured) {
    throw new AuthError('not_configured', 'Accounts are temporarily unavailable');
  }
  if (clientRateLimited('register:' + username.toLowerCase())) {
    throw new AuthError('rate_limited', 'Too many attempts. Please wait a moment.');
  }

  const { data, error } = await supabase.auth.signUp({
    email: toSyntheticEmail(username),
    password,
    options: {
      data: { username },
    },
  });

  if (error) {
    if (/already.*(registered|exists)/i.test(error.message)) {
      throw new AuthError('username_taken', 'That username is already taken');
    }
    throw new AuthError('network', error.message);
  }

  const sessionUser = toSessionUser(data.user);
  if (!sessionUser) {
    throw new AuthError('network', 'Registration succeeded but no session was returned');
  }
  return sessionUser;
}

export async function login(username: string, password: string): Promise<SessionUser> {
  if (!isUsernameValid(username)) {
    throw new AuthError('username_invalid', 'Invalid username or password');
  }
  if (!isSupababaseConfigured) {
    throw new AuthError('not_configured', 'Accounts are temporarily unavailable');
  }
  if (clientRateLimited('login:' + username.toLowerCase())) {
    throw new AuthError('rate_limited', 'Too many attempts. Please wait a minute.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: toSyntheticEmail(username),
    password,
  });

  if (error) {
    throw new AuthError('invalid_credentials', 'Invalid username or password');
  }

  const sessionUser = toSessionUser(data.user);
  if (!sessionUser) {
    throw new AuthError('network', 'Login succeeded but no session was returned');
  }
  return sessionUser;
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const { data } = await supapabase.auth.getUser();
  return toSessionUser(data?.user ?? null);
}

export function toSessionUser(user: User | null): SessionUser | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const username =
    typeof meta.username === 'string'
      ? meta.username
      : user.email
      ? user.email.split('@')[0]
      : 'user';
  return { id: user.id, username };
}
