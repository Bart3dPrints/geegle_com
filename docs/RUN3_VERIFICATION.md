# Run 3 verification: Friends, presence and Everythingle removal

Branch: `feature/geegle-run3-friends` (from `origin/main` `34be029`).
Preview: `http://127.0.0.1:5173/` (`npm run dev -- --mode qa --port 5173`).

## 1. Everythingle removed

Everythingle is gone from the running site, not hidden:

- `src/data/everythingle.ts`, `src/components/EverythingleApp.tsx`,
  `src/components/everythingle/` (WordBoards, MiddleWord), `src/lib/wordGames.ts`
  and `src/lib/wordPuzzle.ts` are deleted.
- The Apps card, the launch branch in `src/App.tsx`, the `EVERYTHINGLE` catalogue
  entry in `src/data/external.ts` and its search aliases are deleted.
- `public/artwork/everythingle.webp` and its records in `src/data/artwork.ts`,
  `scripts/artwork-map.json`, `scripts/artwork/audit.json` and
  `scripts/artwork/captured.json` are removed; `node scripts/map-artwork.mjs`
  reports 4 licensed and 2,683 captured records.
- The Everythingle-only tests (`tests/everythingle.test.mjs`,
  `tests/word-puzzle.test.mjs`) and the Everythingle sections of the Run 2 QA
  scripts are removed.
- The changelog note for PR 16 no longer names Everythingle, and PR 17 now has a
  written, user-facing note.
- Both Krillion entries and every other catalogue entry are untouched.

Stale references cannot break a card: favourites and Recently Played resolve ids
through `SEARCHABLE` and drop anything that no longer exists, so an old
`everythingle` favourite simply stops rendering. No account, save or history row
was deleted.

Verified in the browser: no Everythingle card in Apps, searching "everythingle"
returns nothing, and both Krillion entries remain.

## 2. Database: migration 0007

`supabase/migrations/0007_geegle_social.sql` adds, in `public` with a `geegle_`
prefix so it cannot collide with the other application in this project:

| Table | Purpose | Notes |
| --- | --- | --- |
| `geegle_friend_requests` | pending/declined/cancelled/accepted requests | `sender_id <> recipient_id`; one live request per unordered pair (partial unique index on `least/greatest`); indexes on recipient and sender |
| `geegle_friendships` | accepted friendships | primary key `(user_low, user_high)` with `user_low < user_high`, so a pair can only exist once; `removed_at` records a removal |
| `geegle_blocks` | who blocked whom | primary key `(blocker_id, blocked_id)`, `blocker_id <> blocked_id`, index on `blocked_id` |
| `geegle_reports` | basic abuse reports | 1–500 character reason, reporter is the authenticated user |
| `geegle_social_rate` | fixed-window rate limiting | no client privileges at all |

`removed_at` is deliberate. Realtime cannot deliver a row change it cannot check
against RLS, and a deleted row cannot be checked. Recording the removal lets both
accounts receive it live while keeping the pair row stable for re-adding.

### RLS and grants

RLS is enabled on all five tables.

| Table | SELECT policy | Client writes |
| --- | --- | --- |
| `geegle_friend_requests` | sender or recipient | none (function-only) |
| `geegle_friendships` | `user_low` or `user_high` | none |
| `geegle_blocks` | blocker only | none |
| `geegle_reports` | reporter only | none |
| `geegle_social_rate` | no policy, no grants | none |

`anon` has no privilege on any of them. Every mutation is a `security definer`
function that derives the caller from `auth.uid()`; a client never supplies its
own identity. The functions are executable only by `authenticated`, never
`anon`, and the migration ends with a validation block that aborts if any client
write privilege or anonymous execute right survives.

## 3. Friendship and blocking architecture

| Function | Rule it enforces |
| --- | --- |
| `geegle_search_users(text)` | requires a session; 30 searches/minute; literal two-character prefix only; excludes self; excludes blocked either way; returns only `user_id, username` |
| `geegle_send_friend_request(uuid)` | rejects self, unknown accounts and blocked pairs; 20 requests/hour; returns `duplicate` for a repeat; treats a reciprocal pending request as an acceptance |
| `geegle_respond_friend_request(uuid, boolean)` | only the recipient of a *pending* request in *their* inbox; re-checks blocking before accepting |
| `geegle_cancel_friend_request(uuid)` | only the sender, only while pending |
| `geegle_remove_friend(uuid)` | sets `removed_at`; both accounts see it immediately |
| `geegle_block_user(uuid)` | writes the block, removes the friendship and cancels pending requests in one transaction |
| `geegle_unblock_user(uuid)` | removes only the caller's own block |
| `geegle_report_user(uuid, text)` | 5 reports/hour, reason required, reporter is the caller |
| `geegle_list_social()` | one read returning friends, incoming, outgoing and blocked for the caller only |

A block cannot be bypassed from the client: there is no `INSERT`/`UPDATE`/`DELETE`
grant to reach the tables with, and the functions refuse blocked pairs. A blocked
account also cannot find the blocker through discovery.

## 4. Presence

One shared channel, `geegle:presence`.

- A signed-in account joins under `sha256("geegle-presence:" + userId)` truncated
  to 32 hex characters. Its tabs and devices therefore share one key, so they
  count once and reconnect cleanly.
- A hidden account (`Settings`-independent checkbox in Friends, stored as
  `socialStatusVisible` in `geegle_user_settings.settings`) joins under a
  different salt. It is still counted as a visitor but no friend can match it.
- A guest joins under a random per-session key kept in `sessionStorage`.
- The payload is `{v:1}`. No username, e-mail, raw account id, game, device,
  location or activity is published.
- The connection is owned by the module, not a component: React 18 mounts
  effects twice in development, and two channels on one topic break each other.
  Only one channel exists per app instance, and it is torn down on sign-out or
  when the library is left.
- If the socket errors, times out or never subscribes within 12 seconds, the
  status becomes `unavailable`; friends show a neutral dot and the counter shows
  a dash. Nothing is reported as "offline" or "0" when the service is down.

## 5. Visitor counter

A compact dot plus the number at the far right of the library header, on every
library tab. The number is `countVisitors(presenceState)` — distinct presence
keys, so a second tab or device of the same account does not add a visitor, and
game iframes/heartbeats never count. Because the viewer's own key is registered
before the count is published, a connected visitor never sees zero. It never
invents a number.

## 6. Multi-account verification (real database)

`bun scripts/qa/run3-social-check.mjs` drives the isolated Supabase stack with
three disposable accounts (38 checks, all passing):

- guest is refused `list_social` and account search (HTTP 401);
- A finds B case-insensitively; the caller is never returned; only
  `user_id, username` come back;
- request → B sees it; duplicate rejected; self rejected;
- C cannot accept a request addressed to B;
- accept → both accounts show the friendship; it survives a fresh sign-in;
- block removes the friendship on both sides, blocks new requests, hides the
  blocker from search; unblock restores requests;
- simultaneous requests resolve to a friendship;
- cancel, decline and remove all behave on both sides;
- A cannot read C's request row; C cannot list another pair's friendship rows;
- direct `INSERT` into friendships and blocks is refused (403);
- `geegle_social_rate` is unreadable;
- search is rate limited;
- reports are accepted and visible only to the reporter.

## 7. Browser verification

`bun scripts/qa/run3-browser-check.mjs` runs two independent browser contexts
plus a guest (all checks passing):

- registration for both accounts; the guest is offered only "Sign in" and gets no
  account search;
- A finds B, sends a request; B receives it **without refreshing** and accepts;
  both sides update live; the friendship survives a reload;
- a connected friend shows an online dot;
- the counter includes the viewer (3 with two accounts and one guest) and a second
  tab of the same account does not raise it;
- blocking through the UI removes the friendship on the other account live;
- no Everythingle card, and searching it returns nothing; both Krillion entries
  remain;
- no console errors during the journey;
- no horizontal overflow at 1024×600, 1280×720, 1366×768, 1440×900, 1920×1080 and
  390×844, with the header's first row no taller than the same row with the
  counter hidden (54 px desktop, 96 px at 390 px where the search legitimately
  wraps).

Screenshots were inspected at 1440×900 and 390×844.

## 8. Gates

- `npm run typecheck` — 0
- `npm run lint` — 0
- `npm run build` — 0
- `bun test tests` — 168 pass, 0 fail
- `node scripts/map-artwork.mjs --check` — 0 (4 licensed, 2,683 captured)
- `python3 scripts/artwork/audit-artwork.py` — 0

## 9. Remaining limitations

- **Production migrations are not applied.** `0007` exists locally and in the
  isolated stack only. Until it is applied to `oizdbkxnzwatytxcrvoo`, the live
  site's Friends tab will report that the feature is unavailable.
- The local stack had no Realtime service. It was started from the shipped image
  for verification, and required the auth stack's JWKS because this stack signs
  tokens asymmetrically. Production Supabase provides Realtime already.
- `php`-style Supabase security advisors were not run: no CLI or service-role
  credential is available here. The equivalent checks were done in SQL (RLS on
  every table, no anon privileges, no client write grants, functions restricted
  to `authenticated`, fixed `search_path`).
- Presence is aggregate only; there is no admin view of who is online.

## 10. Production deployment steps (owner approval required)

1. Apply `supabase/migrations/0007_geegle_social.sql` to
   `oizdbkxnzwatytxcrvoo` (Supabase SQL editor or `supabase db push`).
2. Confirm Realtime is enabled for that project and that
   `geegle_friend_requests` and `geegle_friendships` are in the
   `supabase_realtime` publication (the migration adds them when the publication
   exists).
3. Merge the branch, then verify on `https://bartisawesome.onrender.com/`: two
   disposable accounts, a request, an acceptance, blocking, one online dot and a
   counter above zero.

## 11. Run 4 (chat) contract

Chat must verify both sides with the same primitives, never with client input:

- accepted friendship: `exists (select 1 from geegle_friendships where user_low =
  least(a,b) and user_high = greatest(a,b) and removed_at is null)`;
- blocked pair: `geegle_is_blocked(a, b)` — already `security definer` and
  revoked from clients;
- identity: always `auth.uid()`, never a supplied user id.

A `geegle_conversations` table can reuse the ordered-pair primary key and the
same SELECT-only grant pattern. Messages should be readable only when
`geegle_is_blocked` is false and the pair is an accepted friendship, and writes
should again be function-only so a blocked account cannot post around the UI.

## 12. Final commit

Branch tip at the time of writing is recorded by `git log -1` on
`feature/geegle-run3-friends`; see the pull request for the exact SHA.
