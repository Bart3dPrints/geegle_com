// Friends: account discovery, requests, friendships, blocking and the shared
// presence channel.
//
// All mutations go through security-definer RPCs that derive the caller from
// the session; the client never sends "who am I". Responses are treated as
// untrusted input: only the fields the feature needs are kept.

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import type { OpResult } from '../types';

export interface SocialFriend {
  userId: string;
  username: string;
  since: string;
}

export interface SocialRequest {
  requestId: string;
  userId: string;
  username: string;
  createdAt: string;
}

export interface SocialBlocked {
  userId: string;
  username: string;
}

export interface SocialSnapshot {
  friends: SocialFriend[];
  incoming: SocialRequest[];
  outgoing: SocialRequest[];
  blocked: SocialBlocked[];
}

export interface SearchUser {
  userId: string;
  username: string;
}

const EMPTY: SocialSnapshot = { friends: [], incoming: [], outgoing: [], blocked: [] };

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

function requestFrom(value: unknown): SocialRequest | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const requestId = text(row.requestId);
  const userId = text(row.userId);
  const username = text(row.username);
  if (!requestId || !userId || !username) return null;
  return { requestId, userId, username, createdAt: text(row.createdAt) };
}

/** Keeps only the fields the Friends surface is allowed to show. */
export function parseSocialSnapshot(value: unknown): SocialSnapshot {
  if (!value || typeof value !== 'object') return { ...EMPTY };
  const record = value as Record<string, unknown>;
  const list = (entry: unknown) => (Array.isArray(entry) ? entry : []);

  return {
    friends: list(record.friends)
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const row = entry as Record<string, unknown>;
        const userId = text(row.userId);
        const username = text(row.username);
        if (!userId || !username) return null;
        return { userId, username, since: text(row.since) };
      })
      .filter((entry): entry is SocialFriend => Boolean(entry)),
    incoming: list(record.incoming)
      .map(requestFrom)
      .filter((entry): entry is SocialRequest => Boolean(entry)),
    outgoing: list(record.outgoing)
      .map(requestFrom)
      .filter((entry): entry is SocialRequest => Boolean(entry)),
    blocked: list(record.blocked)
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const row = entry as Record<string, unknown>;
        const userId = text(row.userId);
        const username = text(row.username);
        if (!userId || !username) return null;
        return { userId, username };
      })
      .filter((entry): entry is SocialBlocked => Boolean(entry)),
  };
}

/** A username search needs at least two real characters. */
export function normalizeSearchTerm(raw: string | null | undefined): string {
  const value = (raw ?? '').trim().toLowerCase();
  return value.length < 2 ? '' : value;
}

/** Counts people, not connections: one key per account or guest session. */
export function countVisitors(state: Record<string, unknown[]> | null | undefined): number {
  return state ? Object.keys(state).length : 0;
}

const PRESENCE_SALT = 'geegle-presence:';
const PRESENCE_HIDDEN_SALT = 'geegle-presence-hidden:';

function randomKey(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function guestKey(): string {
  const storageKey = 'geegle-presence-guest';
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const created = `g${randomKey()}`;
    sessionStorage.setItem(storageKey, created);
    return created;
  } catch {
    return `g${randomKey()}`;
  }
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The opaque key this browser uses on the shared presence channel.
 *
 * A signed-in account gets a stable hash of its id, so its tabs and devices
 * collapse into one visitor. A hidden account gets a different hash: it is
 * still counted, but no friend can match it and show it as online.
 */
export async function presenceKeyFor(userId: string | null, hidden: boolean): Promise<string> {
  if (!userId) return guestKey();
  const salt = hidden ? PRESENCE_HIDDEN_SALT : PRESENCE_SALT;
  return `u${(await sha256(salt + userId)).slice(0, 32)}`;
}

// --- live relationship changes -------------------------------------------
//
// One channel per account for the whole app. React mounts effects twice in
// development, and two channels on one topic fight each other, so the
// connection is owned here instead of by a component.

let socialChannel: RealtimeChannel | null = null;
let socialChannelUser: string | null = null;
let socialQueue: Promise<void> = Promise.resolve();
const socialListeners = new Set<() => void>();

function notifySocial() {
  for (const listener of socialListeners) listener();
}

function connectSocial(userId: string) {
  socialQueue = socialQueue.then(async () => {
    if (socialChannelUser === userId && socialChannel) return;
    const previous = socialChannel;
    socialChannel = null;
    if (previous) await supabase.removeChannel(previous);
    socialChannelUser = userId;
    const channel = supabase
      .channel(`geegle:social:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'geegle_friend_requests' }, notifySocial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'geegle_friendships' }, notifySocial);
    socialChannel = channel;
    channel.subscribe();
  });
  return socialQueue;
}

/** Subscribes to relationship changes; returns an unsubscribe function. */
export function watchSocial(userId: string | null, onChange: () => void): () => void {
  socialListeners.add(onChange);
  if (userId && isSupabaseConfigured) void connectSocial(userId);
  return () => {
    socialListeners.delete(onChange);
  };
}

const SOCIAL_ERRORS: Record<string, string> = {
  not_authenticated: 'Sign in to use Friends.',
  rate_limited: 'Too many attempts. Try again in a minute.',
  self_request: 'You cannot add yourself.',
  recipient_not_found: 'That account no longer exists.',
  duplicate: 'You already sent that request.',
  blocked: 'That account cannot be contacted.',
  request_not_found: 'That request is no longer available.',
  invalid_target: 'That account cannot be used here.',
  reason_required: 'Describe the problem first.',
};

/**
 * A deployment whose database has not been migrated says so plainly, instead
 * of surfacing a PostgREST schema-cache message or looking like empty data.
 */
export function socialFailure(error: { message?: string; code?: string } | null): string {
  const raw = (error?.message ?? '').trim();
  const code = error?.code ?? '';
  if (
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    /schema cache/i.test(raw) ||
    /Could not find the (table|function)/i.test(raw)
  ) {
    return 'Friends are not available on this deployment yet. Try again later.';
  }
  if (code === '42501' || /permission denied/i.test(raw)) {
    return 'You do not have permission to do that.';
  }
  return SOCIAL_ERRORS[raw] ?? (raw || 'Something went wrong.');
}

const failure = socialFailure;

function unavailable<T>(): OpResult<T> {
  return { ok: false, error: 'Friends need an account on this deployment.' };
}

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<OpResult<T>> {
  if (!isSupabaseConfigured) return unavailable<T>();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: failure(error) };
  return { ok: true, data: data as T };
}

export async function loadSocial(): Promise<OpResult<SocialSnapshot>> {
  if (!isSupabaseConfigured) return unavailable<SocialSnapshot>();
  const { data, error } = await supabase.rpc('geegle_list_social');
  if (error) return { ok: false, error: failure(error) };
  return { ok: true, data: parseSocialSnapshot(data) };
}

export async function searchAccounts(raw: string): Promise<OpResult<SearchUser[]>> {
  const term = normalizeSearchTerm(raw);
  if (!term) return { ok: true, data: [] };
  const result = await call<unknown[]>('geegle_search_users', { p_query: term });
  if (!result.ok) return { ok: false, error: result.error };
  const rows = Array.isArray(result.data) ? result.data : [];
  return {
    ok: true,
    data: rows
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const row = entry as Record<string, unknown>;
        const userId = text(row.user_id);
        const username = text(row.username);
        return userId && username ? { userId, username } : null;
      })
      .filter((entry): entry is SearchUser => Boolean(entry)),
  };
}

export const sendFriendRequest = (userId: string) =>
  call<{ status: string }>('geegle_send_friend_request', { p_recipient: userId });

export const respondToRequest = (requestId: string, accept: boolean) =>
  call<{ status: string }>('geegle_respond_friend_request', { p_request: requestId, p_accept: accept });

export const cancelRequest = (requestId: string) =>
  call<{ status: string }>('geegle_cancel_friend_request', { p_request: requestId });

export const removeFriend = (userId: string) =>
  call<{ status: string }>('geegle_remove_friend', { p_other: userId });

export const blockUser = (userId: string) =>
  call<{ status: string }>('geegle_block_user', { p_other: userId });

export const unblockUser = (userId: string) =>
  call<{ status: string }>('geegle_unblock_user', { p_other: userId });

export const reportUser = (userId: string, reason: string) =>
  call<{ status: string }>('geegle_report_user', { p_reported: userId, p_reason: reason });
