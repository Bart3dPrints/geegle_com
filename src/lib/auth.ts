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

// Client-side rate limiter (the server enforces its own limits too).
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

function toSessionUser(user: User | null): SessionUser | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const username =
    typeof meta.username === 'string' && meta.username.length > 0
      ? meta.username
      : user.email
        ? user.email.split('@')[0]
        : 'user';
  return { id: user.id, username };
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
    options: { data: { username } },
  });

  if (error) {
    if (/already/i.test(error.message) || error.status === 422) {
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
    throw new AuthError('invalid_credentials', 'Invalid username or password');
  }
  if (!isSupabaseConfigured) {
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
  const { data } = await supabase.auth.getUser();
  return toSessionUser(data?.user ?? null);
}
