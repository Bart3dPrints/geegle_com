// One presence subscription for the whole library.
//
// Every signed-in account joins the shared channel under an opaque hash of its
// id, so its tabs, devices and reconnects collapse into a single visitor. A
// guest joins under a per-session key. The channel carries no usernames, no
// e-mail addresses and no raw account ids.
//
// The connection is owned by this module rather than by a component: React 18
// mounts effects twice in development, and a per-mount channel would fight
// itself on the same topic. A key change (sign-in, sign-out, hidden status)
// tears the old channel down before the new one subscribes.
//
// If Realtime is unreachable the state is reported as unavailable; it is never
// presented as "everyone is offline".

import { useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { countVisitors, presenceKeyFor } from '../lib/friends';

export type PresenceStatus = 'connecting' | 'live' | 'unavailable';

const CHANNEL = 'geegle:presence';
const SUBSCRIBE_TIMEOUT_MS = 12_000;

export interface SocialPresence {
  status: PresenceStatus;
  /** Presence keys currently connected. */
  onlineKeys: Set<string>;
  /** People connected, including this visitor; null while unknown. */
  visitors: number | null;
}

let channel: RealtimeChannel | null = null;
let currentKey: string | null = null;
let connecting: Promise<void> | null = null;
let state: SocialPresence = { status: 'connecting', onlineKeys: new Set(), visitors: null };
const listeners = new Set<() => void>();

function publish(next: Partial<SocialPresence>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

async function teardown() {
  const previous = channel;
  channel = null;
  currentKey = null;
  if (previous) await supabase.removeChannel(previous);
}

async function connect(userId: string | null, hidden: boolean, enabled: boolean) {
  if (!enabled || !isSupabaseConfigured) {
    await teardown();
    publish({ status: 'unavailable', onlineKeys: new Set(), visitors: null });
    return;
  }

  const key = await presenceKeyFor(userId, hidden);
  if (channel && currentKey === key) return;

  await teardown();
  currentKey = key;
  publish({ status: 'connecting', visitors: null });

  const next = supabase.channel(CHANNEL, { config: { presence: { key } } });
  channel = next;

  next.on('presence', { event: 'sync' }, () => {
    if (channel !== next) return;
    const presence = next.presenceState() as Record<string, unknown[]>;
    publish({
      status: 'live',
      onlineKeys: new Set(Object.keys(presence)),
      visitors: countVisitors(presence),
    });
  });

  const subscribed = new Promise<void>((resolve) => {
    next.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void next.track({ v: 1 });
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (channel === next) {
          publish({ status: 'unavailable', onlineKeys: new Set(), visitors: null });
        }
        resolve();
      }
    });
  });

  const timeout = new Promise<void>((resolve) => {
    window.setTimeout(resolve, SUBSCRIBE_TIMEOUT_MS);
  });

  await Promise.race([subscribed, timeout]);
  if (state.status === 'connecting' && channel === next) {
    publish({ status: 'unavailable', visitors: null });
  }
}

function ensure(userId: string | null, hidden: boolean, enabled: boolean) {
  connecting = (connecting ?? Promise.resolve())
    .then(() => connect(userId, hidden, enabled))
    .catch(() => publish({ status: 'unavailable', visitors: null }));
  return connecting;
}

export function useSocialPresence({
  userId,
  hidden,
  enabled,
}: {
  userId: string | null;
  hidden: boolean;
  enabled: boolean;
}): SocialPresence {
  const [snapshot, setSnapshot] = useState<SocialPresence>(state);

  useEffect(() => {
    const listener = () => setSnapshot(state);
    listeners.add(listener);
    listener();
    void ensure(userId, hidden, enabled);
    return () => {
      listeners.delete(listener);
    };
  }, [userId, hidden, enabled]);

  return snapshot;
}
