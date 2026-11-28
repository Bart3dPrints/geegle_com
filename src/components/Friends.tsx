// Friends: a compact surface for account discovery, requests, friendships and
// blocking. Guests see a single sign-in action; nothing private is requested
// until an account exists. Changes arrive live over Realtime, so the lists do
// not need a refresh.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import {
  blockUser,
  cancelRequest,
  loadSocial,
  normalizeSearchTerm,
  presenceKeyFor,
  removeFriend,
  reportUser,
  respondToRequest,
  searchAccounts,
  sendFriendRequest,
  unblockUser,
  watchSocial,
  type SearchUser,
  type SocialSnapshot,
} from '../lib/friends';
import type { PresenceStatus } from '../hooks/useSocialPresence';

const EMPTY: SocialSnapshot = { friends: [], incoming: [], outgoing: [], blocked: [] };

const row =
  'flex items-center justify-between gap-2 border-b border-neutral-200 py-1.5 last:border-0 dark:border-neutral-800';
const name = 'min-w-0 truncate text-sm';
const action =
  'shrink-0 rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800';
const heading = 'mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400';

function Section({
  title,
  children,
  empty,
  showEmpty = true,
}: {
  title: string;
  children: React.ReactNode;
  empty?: string;
  /**
   * Empty copy is only a description of an empty list — never a caption under
   * a populated one, and never a stand-in for a failed request.
   */
  showEmpty?: boolean;
}) {
  return (
    <section className="mb-4">
      <h3 className={heading}>{title}</h3>
      <div className="card px-3 py-1">
        {children}
        {empty && showEmpty && (
          <p className="py-1.5 text-xs text-neutral-500 dark:text-neutral-400">{empty}</p>
        )}
      </div>
    </section>
  );
}

function StatusDot({ online, status }: { online: boolean; status: PresenceStatus }) {
  const tone =
    status !== 'live'
      ? 'bg-neutral-300 dark:bg-neutral-700'
      : online
        ? 'bg-emerald-500'
        : 'bg-neutral-400 dark:bg-neutral-600';
  const label = status !== 'live' ? 'Status unavailable' : online ? 'Online' : 'Offline';
  return (
    <span
      aria-label={label}
      title={label}
      className={`mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${tone}`}
    />
  );
}

export function Friends({
  userId,
  onRequestSignIn,
  onlineKeys,
  presenceStatus,
}: {
  userId: string | null;
  onRequestSignIn: () => void;
  onlineKeys: Set<string>;
  presenceStatus: PresenceStatus;
}) {
  const [social, setSocial] = useState<SocialSnapshot>(EMPTY);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A failed request must never be presented as an empty friend list.
  const [loadFailed, setLoadFailed] = useState(false);
  const [onlineFriends, setOnlineFriends] = useState<Set<string>>(new Set());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSocial(EMPTY);
      setLoadFailed(false);
      return;
    }
    const result = await loadSocial();
    if (!mounted.current) return;
    if (result.ok && result.data) {
      setSocial(result.data);
      setLoadFailed(false);
    } else if (!result.ok) {
      setError(result.error ?? 'Friends could not be loaded.');
      setLoadFailed(true);
    }
  }, [userId]);

  useEffect(() => {
    setError(null);
    setQuery('');
    setResults([]);
    void refresh();
  }, [refresh]);

  // Live updates: one shared subscription, and RLS decides which rows this
  // account may see.
  useEffect(() => watchSocial(userId, () => void refresh()), [userId, refresh]);

  // Debounced discovery.
  useEffect(() => {
    const term = normalizeSearchTerm(query);
    if (!userId || !term) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void searchAccounts(term).then((result) => {
        if (cancelled) return;
        setSearching(false);
        if (result.ok) setResults(result.data ?? []);
        else {
          setResults([]);
          setError(result.error ?? null);
        }
      });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, userId]);

  // Which friends are actually connected, from the shared presence keys.
  useEffect(() => {
    let cancelled = false;
    if (presenceStatus !== 'live' || !social.friends.length) {
      setOnlineFriends(new Set());
      return;
    }
    void Promise.all(
      social.friends.map(async (friend) => {
        const key = await presenceKeyFor(friend.userId);
        return [friend.userId, onlineKeys.has(key)] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      setOnlineFriends(new Set(entries.filter(([, online]) => online).map(([id]) => id)));
    });
    return () => {
      cancelled = true;
    };
  }, [social.friends, onlineKeys, presenceStatus]);

  const run = async (tag: string, action: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busy) return;
    setBusy(tag);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) setError(result.error ?? 'That did not work.');
      await refresh();
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const friendIds = useMemo(() => new Set(social.friends.map((f) => f.userId)), [social.friends]);
  const outgoingIds = useMemo(() => new Set(social.outgoing.map((r) => r.userId)), [social.outgoing]);
  const blockedIds = useMemo(() => new Set(social.blocked.map((b) => b.userId)), [social.blocked]);

  if (!userId) {
    return (
      <section aria-label="Friends" className="mx-auto w-full max-w-md">
        <div className="card p-6 text-center">
          <h2 className="mb-1 text-base font-semibold">Friends</h2>
          <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            Sign in to add friends and see who is online.
          </p>
          <button className="btn-primary" onClick={onRequestSignIn}>
            Sign in
          </button>
        </div>
      </section>
    );
  }

  if (loadFailed) {
    return (
      <section aria-label="Friends" className="mx-auto w-full max-w-md">
        <div className="card p-6 text-center" role="alert" data-friends-failed>
          <p className="mb-1 text-sm font-medium">Friends could not be loaded</p>
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            {error ?? 'The service did not answer. Your friends were not changed.'}
          </p>
          <button className="btn-primary" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Friends" className="mx-auto w-full max-w-3xl">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex min-w-48 flex-1 items-center gap-1.5 rounded-md border border-neutral-300 bg-[var(--geegle-card)] px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
          <Search size={15} className="text-neutral-400" aria-hidden="true" />
          <input
            className="w-full bg-transparent text-sm outline-none"
            placeholder="Find someone by username"
            aria-label="Search accounts by username"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {searching && <Loader2 size={14} className="animate-spin text-neutral-400" aria-hidden="true" />}
          {query && !searching && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-3 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {normalizeSearchTerm(query) && (
        <Section
          title="Results"
          empty={searching ? 'Searching…' : 'No accounts found.'}
          showEmpty={results.length === 0}
        >
          {results.map((user) => {
            const friend = friendIds.has(user.userId);
            const sent = outgoingIds.has(user.userId);
            const incoming = social.incoming.find((r) => r.userId === user.userId);
            const blocked = blockedIds.has(user.userId);
            return (
              <div key={user.userId} className={row} data-search-result={user.userId}>
                <span className={name}>{user.username}</span>
                {friend ? (
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">Friends</span>
                ) : blocked ? (
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">Blocked</span>
                ) : incoming ? (
                  <button
                    className={action}
                    disabled={busy !== null}
                    onClick={() => void run(`accept:${user.userId}`, () => respondToRequest(incoming.requestId, true))}
                  >
                    Accept
                  </button>
                ) : sent ? (
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">Requested</span>
                ) : (
                  <button
                    className={action}
                    disabled={busy !== null}
                    onClick={() => void run(`add:${user.userId}`, () => sendFriendRequest(user.userId))}
                  >
                    Add
                  </button>
                )}
              </div>
            );
          })}
        </Section>
      )}

      <Section
        title="Requests"
        empty="No pending requests."
        showEmpty={social.incoming.length + social.outgoing.length === 0}
      >
        {social.incoming.map((request) => (
          <div key={request.requestId} className={row} data-incoming={request.requestId}>
            <span className={name}>{request.username}</span>
            <span className="flex shrink-0 gap-1">
              <button
                className={action}
                disabled={busy !== null}
                onClick={() => void run(`accept:${request.requestId}`, () => respondToRequest(request.requestId, true))}
              >
                Accept
              </button>
              <button
                className={action}
                disabled={busy !== null}
                onClick={() => void run(`decline:${request.requestId}`, () => respondToRequest(request.requestId, false))}
              >
                Decline
              </button>
            </span>
          </div>
        ))}
        {social.outgoing.map((request) => (
          <div key={request.requestId} className={row} data-outgoing={request.requestId}>
            <span className={`${name} text-neutral-500 dark:text-neutral-400`}>
              {request.username} · requested
            </span>
            <button
              className={action}
              disabled={busy !== null}
              onClick={() => void run(`cancel:${request.requestId}`, () => cancelRequest(request.requestId))}
            >
              Cancel
            </button>
          </div>
        ))}
      </Section>

      <Section title="Friends" empty="No friends yet." showEmpty={social.friends.length === 0}>
        {social.friends.map((friend) => (
          <div key={friend.userId} className={row} data-friend={friend.userId}>
            <span className={`${name} flex items-center`}>
              <StatusDot online={onlineFriends.has(friend.userId)} status={presenceStatus} />
              {friend.username}
            </span>
            <span className="flex shrink-0 gap-1">
              <button
                className={action}
                disabled={busy !== null}
                onClick={() => void run(`remove:${friend.userId}`, () => removeFriend(friend.userId))}
              >
                Remove
              </button>
              <button
                className={action}
                disabled={busy !== null}
                onClick={() => {
                  const reason = window.prompt(`Report ${friend.username} to the site owner. What happened?`);
                  if (!reason || !reason.trim()) return;
                  void run(`report:${friend.userId}`, () => reportUser(friend.userId, reason.trim()));
                }}
              >
                Report
              </button>
              <button
                className={action}
                disabled={busy !== null}
                onClick={() => {
                  if (!window.confirm(`Block ${friend.username}? This also removes the friendship.`)) return;
                  void run(`block:${friend.userId}`, () => blockUser(friend.userId));
                }}
              >
                Block
              </button>
            </span>
          </div>
        ))}
      </Section>

      {social.blocked.length > 0 && (
        <Section title="Blocked">
          {social.blocked.map((blocked) => (
            <div key={blocked.userId} className={row} data-blocked={blocked.userId}>
              <span className={name}>{blocked.username}</span>
              <span className="flex shrink-0 gap-1">
                <button
                  className={action}
                  disabled={busy !== null}
                  onClick={() => void run(`unblock:${blocked.userId}`, () => unblockUser(blocked.userId))}
                >
                  Unblock
                </button>
              </span>
            </div>
          ))}
        </Section>
      )}

    </section>
  );
}
