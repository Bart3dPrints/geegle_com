// One presence subscription for the whole library.
//
// Every signed-in account joins the shared channel under an opaque hash of its
// id, so its tabs, devices and reconnects collapse into a single visitor. A
// guest joins under a per-session key. The channel carries no usernames, no
// e-mail addresses and no raw account ids.
//
// Ownership and teardown rules matter here:
// - The connection lives in this module, because React 18 mounts effects twice
//   in development and two channels on one topic fight each other.
// - A key change (sign-in or sign-out) leaves the old channel before joining
//   the new one, because every visitor shares one topic: a second join on the
//   same topic closes the first, and the server then drops the presence state
//   the new channel had just published. The leave is bounded, so a stalled
//   removal can never block the new join the way it used to.
// - A failed or timed-out join is retried a bounded number of times. While
//   presence is unknown the state says so; it is never presented as "everyone
//   is offline".

import { useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { countVisitors, presenceKeyFor } from '../lib/friends';

export type PresenceStatus = 'connecting' | 'live' | 'unavailable';

const CHANNEL = 'geegle:presence';
const SUBSCRIBE_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 1_500;
const MAX_ATTEMPTS = 3;

export interface SocialPresence {
  status: PresenceStatus;
  /** Presence keys currently connected. */
  onlineKeys: Set<string>;
  /** People connected, including this visitor; null while unknown. */
  visitors: number | null;
}

let channel: RealtimeChannel | null = null;
let currentKey: string | null = null;
let generation = 0;
let running: Promise<void> | null = null;
let state: SocialPresence = { status: 'connecting', onlineKeys: new Set(), visitors: null };
const listeners = new Set<() => void>();

function publish(next: Partial<SocialPresence>) {
  const previous = state;
  const merged = { ...state, ...next };
  const sameKeys = previous.onlineKeys === merged.onlineKeys;
  if (
    previous.status === merged.status &&
    previous.visitors === merged.visitors &&
    (sameKeys || (previous.onlineKeys.size === merged.onlineKeys.size &&
      [...merged.onlineKeys].every((key) => previous.onlineKeys.has(key))))
  ) {
    return;
  }
  state = merged;
  for (const listener of listeners) listener();
}

/** Leaves a channel, bounded, so one slow teardown cannot block the next join. */
async function retire(previous: RealtimeChannel | null): Promise<void> {
  if (!previous) return;
  const leave = (async () => {
    await previous.untrack().catch(() => undefined);
    await previous.unsubscribe().catch(() => undefined);
    await supabase.removeChannel(previous).catch(() => undefined);
  })();
  await Promise.race([
    leave,
    new Promise<void>((resolve) => window.setTimeout(resolve, 2_000)),
  ]);
}

function watch(next: RealtimeChannel, myGeneration: number) {
  next.on('presence', { event: 'sync' }, () => {
    if (generation !== myGeneration || channel !== next) return;
    const presence = next.presenceState() as Record<string, unknown[]>;
    publish({
      status: 'live',
      onlineKeys: new Set(Object.keys(presence)),
      visitors: countVisitors(presence),
    });
  });
  // A reconnect re-joins the topic; the server forgets the old track, so the
  // visitor announces itself again and the count stays truthful.
  next.on('system', {}, (payload: { status?: string }) => {
    if (generation !== myGeneration || channel !== next) return;
    if (payload?.status === 'ok') void next.track({ v: 1 });
  });
}

function join(key: string, myGeneration: number): Promise<boolean> {
  return new Promise((resolve) => {
    const next = supabase.channel(CHANNEL, { config: { presence: { key } } });
    channel = next;
    watch(next, myGeneration);
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(ok);
    };
    const timer = window.setTimeout(() => finish(false), SUBSCRIBE_TIMEOUT_MS);

    next.subscribe((status) => {
      if (generation !== myGeneration) {
        finish(false);
        return;
      }
      if (status === 'SUBSCRIBED') {
        void next.track({ v: 1 });
        finish(true);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        finish(false);
      }
    });
  });
}

async function connect(userId: string | null, enabled: boolean) {
  if (!enabled || !isSupabaseConfigured) {
    generation += 1;
    const previous = channel;
    channel = null;
    currentKey = null;
    retire(previous);
    publish({ status: 'unavailable', onlineKeys: new Set(), visitors: null });
    await retire(previous);
    return;
  }

  const key = await presenceKeyFor(userId);
  if (channel && currentKey === key && (state.status === 'live' || state.status === 'connecting')) {
    return;
  }

  generation += 1;
  const myGeneration = generation;
  const previous = channel;
  channel = null;
  currentKey = key;
  publish({ status: 'connecting', visitors: null });

  // One topic is shared by every visitor, so the old join has to be closed
  // before the new key joins; otherwise the two joins close each other.
  await retire(previous);
  if (generation !== myGeneration) return;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (generation !== myGeneration) return;
    const joined = await join(key, myGeneration);
    if (generation !== myGeneration) return;
    if (joined) return;
    await retire(channel);
    channel = null;
    if (attempt < MAX_ATTEMPTS) {
      publish({ status: 'connecting', visitors: null });
      await new Promise((resolve) => window.setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
  if (generation === myGeneration) publish({ status: 'unavailable', visitors: null });
}

function ensure(userId: string | null, enabled: boolean) {
  running = (running ?? Promise.resolve())
    .then(() => connect(userId, enabled))
    .catch(() => publish({ status: 'unavailable', visitors: null }));
  return running;
}

export function useSocialPresence({
  userId,
  enabled,
}: {
  userId: string | null;
  enabled: boolean;
}): SocialPresence {
  const [snapshot, setSnapshot] = useState<SocialPresence>(state);

  useEffect(() => {
    const listener = () => setSnapshot(state);
    listeners.add(listener);
    listener();
    void ensure(userId, enabled);
    return () => {
      listeners.delete(listener);
    };
  }, [userId, enabled]);

  return snapshot;
}

/** Test hook: forget the module state between cases. */
export function resetPresenceForTests() {
  listeners.clear();
  state = { status: 'connecting', onlineKeys: new Set(), visitors: null };
  channel = null;
  currentKey = null;
  running = null;
  generation = 0;
}
