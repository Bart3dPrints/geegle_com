// One presence subscription for the whole library.
//
// Every signed-in account joins the shared channel under an opaque hash of its
// id, so its tabs, devices and reconnects collapse into a single visitor. A
// guest joins under a per-session key. The channel carries no usernames, no
// e-mail addresses and no raw account ids.
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

export function useSocialPresence({
  userId,
  hidden,
  enabled,
}: {
  userId: string | null;
  hidden: boolean;
  enabled: boolean;
}): SocialPresence {
  const [status, setStatus] = useState<PresenceStatus>('connecting');
  const [onlineKeys, setOnlineKeys] = useState<Set<string>>(new Set());
  const [visitors, setVisitors] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured) {
      setStatus('unavailable');
      setVisitors(null);
      return;
    }

    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    setStatus('connecting');
    setVisitors(null);

    void presenceKeyFor(userId, hidden).then((key) => {
      if (cancelled) return;

      const current = supabase.channel(CHANNEL, { config: { presence: { key } } });
      channel = current;

      current.on('presence', { event: 'sync' }, () => {
        if (cancelled) return;
        const state = current.presenceState() as Record<string, unknown[]>;
        setOnlineKeys(new Set(Object.keys(state)));
        setVisitors(countVisitors(state));
        setStatus('live');
      });

      current.subscribe((state) => {
        if (cancelled) return;
        if (state === 'SUBSCRIBED') {
          void current.track({ v: 1 });
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          setStatus('unavailable');
          setVisitors(null);
        }
      });
    });

    const timeout = window.setTimeout(() => {
      setStatus((current) => (current === 'connecting' ? 'unavailable' : current));
    }, SUBSCRIBE_TIMEOUT_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, hidden, enabled]);

  return { status, onlineKeys, visitors };
}
