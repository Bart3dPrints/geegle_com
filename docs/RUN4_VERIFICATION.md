# Run 4 verification: production Friends repair and the chat system

Branch: `feature/geegle-run4-chat` (from `origin/main` `88be3ec`).
Preview: `http://127.0.0.1:5173/` (`npm run dev -- --mode qa --port 5173`).
Production: `https://bartisawesome.onrender.com/` (project `oizdbkxnzwatytxcrvoo`).
Isolated test project: `wkdlsaydqyymynoipmhl`.

## 1. Production Friends failure (P0)

### Diagnosis, not a guess

The live site reported `Could not find the function public.geegle_list_social`
on the Friends tab. Probes with the public anon key against production showed:

| Probe | Before | Meaning |
| --- | --- | --- |
| `GET /rest/v1/geegle_friendships` | 404 `PGRST205` | table absent |
| `GET /rest/v1/geegle_blocks` | 404 `PGRST205` | table absent |
| `POST /rpc/geegle_list_social` | 404 `PGRST202` | function absent |

`information_schema` confirmed production held only the 0001–0006 objects, so
migration `0007_geegle_social.sql` had never been applied. This was a missing
migration, not a stale PostgREST cache, and hiding the message in the client
would not have fixed anything.

### Repair (approved by the owner)

1. Verified production had 0001–0006 only, that `geegle_profiles` and its trigger
   existed, and that the `supabase_realtime` publication existed.
2. Applied `supabase/migrations/0007_geegle_social.sql` through the Supabase
   integration, in reviewed parts, then ran its own post-check block.
3. Reloaded the PostgREST schema cache (`notify pgrst, 'reload schema'`).
4. Compared every social function body in production against the isolated
   database: identical after normalising whitespace and comments.
5. Confirmed RLS on all five tables, `SELECT`-only grants, no `anon` access, and
   both social tables present in the `supabase_realtime` publication.
6. Signed in on the live Render site as a new disposable account
   (`qa4live0qbdop`) and opened Friends: the real surface rendered
   ("Show me online", "No pending requests", "No friends yet"), no error card,
   no console errors. The failure is resolved on production, not hidden.

No other application's table was read or modified: every object is
`public.geegle_*`.

### Rollback

`supabase/rollback/0007_geegle_social_rollback.sql` removes the two Realtime
publication entries, the functions and the five tables created by 0007, and
nothing else. It is a single transaction.

## 2. Migration 0008 (`supabase/migrations/0008_geegle_chat.sql`)

Applied to the isolated database, tested, and then applied to production with
the same owner approval (every function body compared afterwards; all 18 match
the reviewed file).

| Table | Purpose | Notes |
| --- | --- | --- |
| `geegle_conversations` | public room, DMs and groups | one row per unordered DM pair (unique index), exactly one `public` row |
| `geegle_conversation_members` | membership, role, read state | primary key `(conversation_id, user_id)`; `last_read_at` drives unread counts |
| `geegle_messages` | message bodies | author, `edited_at`, `unsent_at`, `forwarded_from` |
| `geegle_message_hidden` | delete for me | `(message_id, user_id)`; never delete the message for everyone else |
| `geegle_message_reports` | message abuse reports | reporter is the caller; 1–500 character reason |
| `geegle_dm_backgrounds` | per-account DM background | primary key `(conversation_id, user_id)`; colour, image path, overlay |

An unsend destroys the text (`body = ''`, `unsent_at = now()`), so a forwarded
reference to it can only resolve to "unavailable". A delete-for-me is a private
row, so other participants and forward previews are unaffected.

### Access model

- One helper, `geegle_can_read(conversation)`, decides every read. It derives
  the viewer from `auth.uid()` and never takes a user id, so exposing it cannot
  reveal another account's access. A public room is readable by any signed-in
  account; a group by its current members; a DM only while the friendship is
  active and neither account blocks the other.
- RLS: conversations (readable only), members (own rooms), messages (readable
  only), hidden/reports/backgrounds (own rows only).
- Grants: `SELECT` only, to `authenticated`, on conversations, members,
  messages and backgrounds. No client privilege at all on hidden rows, reports
  or any write. `anon` has nothing.
- Every mutation is a `security definer` function with a fixed `search_path`
  that derives the caller from `auth.uid()`. The migration ends with a
  validation block that aborts if any client write privilege or anonymous
  execute right survives.
- Rate limits reuse `geegle_rate_limit`: messages 40/minute, edits 30/10
  minutes, forwards 30/minute, groups 5/hour, invites 40/hour, reports 5/hour.

## 3. Forwarding matrix

| From | To | Result |
| --- | --- | --- |
| Public | DM with an accepted friend | allowed |
| Group | DM whose recipient is an accepted friend **and** a current member of that group | allowed |
| DM | anywhere | refused (`forward_not_allowed`) |
| any | public room | refused |
| any | group | refused |
| any | unsent message | refused (`message_not_found`) |

A forward stores `forwarded_from = coalesce(original.forwarded_from,
original.id)`, so a chain always points at the original; chaining cannot be used
to walk content around a permission check. The preview carries the original
message id, author, time, conversation and an `available` flag computed for the
reader, so a reader who cannot see the original gets "no longer available"
instead of a dead link. Clicking an available original switches conversation
and highlights the message.

## 4. DM background

- Only DMs: the server refuses `not_a_dm` for the public room and groups.
- Per conversation **and per account**: the other participant never sees it
  (`geegle_chat_background` returns null for them).
- Default, six solid presets, a custom colour picker plus hex field (validated
  `^#[0-9a-fA-F]{6}$`), and an image upload. Live preview applies to the thread
  before saving; reset returns to default.
- Images are validated (PNG/JPEG/WebP, 15 MB source), decoded, downscaled to
  1600 px, re-encoded at quality 0.85 and uploaded only if the result is under
  3 MB.
- Storage: private bucket `geegle-chat-backgrounds` (public URL refused), 3 MB
  limit, MIME allow-list, objects under `<user id>/<conversation id>/<file>`.
  Storage policies only ever expose an account's own folder, and the database
  re-checks the path prefix, so one account cannot point at another's picture.
  Display uses short-lived signed links; nothing is served from a public URL.
- Synced across devices because it lives in the database and the bucket, keyed
  by the account.

## 5. Client surface

- New `Chat` tab, last: `Games | Apps | Proxies | Friends | Chat`. Header height
  and one-line tab row unchanged at every tested viewport.
- Two-pane on desktop (conversation list + thread), single pane with a back
  button on small screens.
- Conversations: public room, DMs (opened from accepted friends), groups
  (create, rename, invite friends, member list, make owner, leave with ownership
  falling back to the earliest joined member, group closes when the last member
  leaves).
- Unread counts per conversation, cleared on open and for messages arriving in
  the open thread; relative timestamps, day separators and clock times.
- Pagination with "Load earlier messages" (keyset cursor on `(created_at, id)`).
- Three-dot menu offers only permitted actions: Edit and Unsend for your own
  live messages, Delete for me for any visible message, Forward except from a
  DM, Report on other people's messages. The database enforces the same rules.
- Loading, empty and failure states everywhere. A failed read shows a short
  message with Retry and never renders an empty list as success.
- Reduced motion: no animation is added by the chat surface; the existing
  dialogs keep respecting `prefers-reduced-motion`.
- Guests see a single Sign in card and no data is requested.

## 6. Verification evidence

### Database, four disposable accounts (84 checks, all passing)

`bun scripts/qa/run4-chat-check.mjs` signs up four accounts and drives the real
auth and REST endpoints. Covered:

- guests are refused with `42501` on every chat function (no schema-cache 404);
- the public room exists once and is shared; posting works; empty and over-long
  bodies are refused; text is stored verbatim (`<b>` is never interpreted);
- unread counts appear and clear with `mark_read`;
- pagination honours the page size, orders newest first, and continues without
  repeating rows;
- DMs can only be opened with an accepted friend, are never duplicated, and a
  stranger cannot read, post into, or read the rows of one;
- edit, unsend and delete-for-me: author-only, unsent text destroyed, hidden
  rows only affect the account that hid them, an unsent message cannot be edited
  back or forwarded;
- the full forwarding matrix, including the group membership condition, refusal
  into the public room and groups, refusal of DM sources, and root stability so
  a forward cannot be chained;
- groups: naming, owner-only rename, friend-only invites, posting, non-member
  refusal, ownership transfer, leaving with ownership fallback, and closure when
  the last member leaves;
- backgrounds: presets, custom hex, invalid colour, foreign image folder,
  own-folder path, per-account privacy, refusal outside a DM, reset;
- reports accepted, reason required;
- every direct table write refused (insert message/conversation, patch message,
  delete conversation, hide a message), reports unreadable, other accounts'
  backgrounds unreadable;
- message rate limiting triggers;
- blocking closes the DM for both sides.

### Browser journey, three accounts (38 checks, all passing)

`bun scripts/qa/run4-browser-check.mjs` runs three independent browser contexts:

- tab order is `Games | Apps | Proxies | Friends | Chat` on one line with an
  unchanged header height;
- registration, friendship, then a public message delivered to the second
  account live with no reload;
- a DM opened from the friend list, an unread badge for the recipient, reading
  it clears the badge, and an open conversation never shows a badge for a
  message that arrives while it is open;
- edit and unsend propagate live; "edited" is marked; the unsent text is gone;
- a public message forwarded into the DM shows "Forwarded from" with the
  original author and text, and clicking the original switches to the public
  room with the message highlighted;
- a solid background applies live, survives a reload, and is restored;
- a group is created, the friend is invited and joins, a group message arrives
  live, and the member list shows both accounts;
- a signed-in stranger sees only the public room;
- no horizontal overflow at 1024×600, 1280×720, 1366×768, 1440×900, 1920×1080
  and 390×844; the composer is reachable and the tab row fits at 390 px;
- no console errors.

Screenshots were captured and inspected at 1440×900 and 390×844. The inspection
caught one real defect the assertions had not: the open conversation kept its
unread badge when a new message arrived. It was fixed (the open thread marks the
conversation read after each live update) and a check now guards it.

## 7. Gates

- `npm run typecheck` — 0
- `npm run lint` — 0
- `npm run build` — 0
- `bun test tests` — 178 pass, 0 fail (including the new `tests/chat.test.mjs`)
- `bun scripts/qa/run4-chat-check.mjs` — 84/84
- `bun scripts/qa/run4-browser-check.mjs` — 38/38

The changelog guard now expects PR 18 as the latest release; written notes were
added for PR 18 (Run 3) and PR 19 (this run), so no raw development title is
ever shown.

## 8. Production state

| Item | Status |
| --- | --- |
| `0007_geegle_social.sql` on `oizdbkxnzwatytxcrvoo` | APPLIED, verified; live Friends works |
| `0008_geegle_chat.sql` on `oizdbkxnzwatytxcrvoo` | APPLIED, verified; 18 function bodies match the reviewed file |
| Realtime publication | friend requests, friendships, messages, conversations, members |
| Storage bucket `geegle-chat-backgrounds` | private, 3 MB, PNG/JPEG/WebP, four owner-folder policies |
| Anonymous access | refused (`42501`) on every chat function |
| Public room | exactly one row |

Production checks performed: table/RLS/policy/grant catalog queries, function
body comparison, publication membership, bucket and policy presence, anon REST
probes, a public-URL storage probe (refused), and a signed-in
`geegle_chat_overview` call returning the public room for the disposable account
`qa4live0qbdop`.

The chat **interface** reaches production when this branch is merged: Render
deploys `main`. The backend is already live, so the deployed client will not hit
a missing-function error for chat.

## 9. Rollback

- `supabase/rollback/0007_geegle_social_rollback.sql`
- `supabase/rollback/0008_geegle_chat_rollback.sql`

Each is one transaction, drops only the objects its migration created, and
touches no other application's data. Rolling back chat also removes the
background bucket and its objects; friends and saved games are unaffected.

## 10. Limitations

- Supabase security/performance advisors were not run: no CLI or service-role
  credential is available here. The equivalent guarantees were checked in SQL
  (RLS everywhere, no client writes, no anon access, fixed `search_path`,
  storage policies).
- Realtime was exercised on the isolated stack, where the service needs the auth
  stack's JWKS because tokens are asymmetric. Production Supabase provides
  Realtime and already carries the tables.
- Background upload was exercised through the API and storage policies; the
  browser journey applied solid presets and verified persistence, but no
  automated test uploads a real photograph through the file picker.
- Editing is unlimited in time by design (the brief set no window); unsend is
  author-only, with no moderator tool.
- The public room is a single global conversation. There is no per-topic channel
  list, and no message search.
- DM history becomes unreadable while a friendship is removed or a block is in
  place. It returns if the friendship is restored; nothing is deleted.

## 11. Files

New: `supabase/migrations/0008_geegle_chat.sql`,
`supabase/rollback/000*.sql`, `src/lib/chat.ts`, `src/components/Chat.tsx`,
`src/components/chat/ChatBackgroundEditor.tsx`,
`src/components/chat/ForwardDialog.tsx`, `tests/chat.test.mjs`,
`scripts/qa/run4-chat-check.mjs`, `scripts/qa/run4-browser-check.mjs`,
`docs/RUN4_VERIFICATION.md`.

Changed: `src/App.tsx` (tab), `src/lib/friends.ts` (schema-cache error mapping),
`src/components/Friends.tsx` (failure card with Retry instead of an empty list),
`src/data/changelog.json`, `scripts/changelog-notes.json`,
`tests/changelog.test.mjs`, `PROJECT_COMPLETION.md`.
