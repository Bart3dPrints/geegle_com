# Cloud-save verification

Scope: what Geegle's cloud saves actually do, what was exercised in a browser,
and what is still only engine compatibility. Status values are limited to
NOT STARTED, IN PROGRESS, IMPLEMENTED BUT UNVERIFIED, VERIFIED, BLOCKED.

## How saving works

- `src/lib/saveAdapters.ts` — per-game adapters plus a generic adapter for shimmed
  local games. Keys and IndexedDB databases are namespaced per
  `(game, account)`; IndexedDB ownership is a name check against
  `geegle-game:<gameId>:<userId>:`.
- `src/lib/cloudSaves.ts` — writes to `public.geegle_game_saves` with a
  `revision` column for conflict detection, refuses to overwrite a non-empty saved
  snapshot with an empty one, and keeps local progress when a write fails.
- `src/lib/saveManifest.ts` — labels each game `verified`, `engine-compatible`,
  `injectable`, `manual`, `unsupported` or `external-service`. Only ids in
  `VERIFIED_GAMES` are claimed as verified; today that set is `cl2048`.

## Behaviour matrix

| Requirement | Status | How it was checked | Result |
| --- | --- | --- | --- |
| Automatic save when progress changes (≤15 s) | VERIFIED | `scripts/qa/check-cloud-save.mjs` against a real Supabase backend: write a game's own key in the running frame, wait for the sync, read the row back as the same account | row contains `["e2eProgress"]`, value matches |
| Restoration before initialisation | VERIFIED | fresh browser context, same account, value present before launching the game | `progress-…` restored |
| Save before exiting a game / before logout | IMPLEMENTED BUT UNVERIFIED | code path awaits the final capture in `App.tsx` / `GamePlayer.tsx`; not re-exercised this cycle | — |
| Manual cloud save, restore, import, export | IMPLEMENTED BUT UNVERIFIED | implemented in the settings/player surface; no scripted check this cycle | — |
| Never overwrite a valid save with an empty snapshot | IMPLEMENTED BUT UNVERIFIED | guarded in `cloudSaves.ts`; not re-exercised this cycle | — |
| Failed-save recovery keeps local progress | IMPLEMENTED BUT UNVERIFIED | guarded in `cloudSaves.ts`; not re-exercised this cycle | — |
| Save conflict detection | BLOCKED on production | needs migration `0002` (production lacks `geegle_game_saves.revision`, verified: `select=revision` → `42703`). Works on a migrated backend | — |
| Offline progress preserved and synced after reconnect | IMPLEMENTED BUT UNVERIFIED | local-first capture exists; reconnect path not scripted | — |
| Account isolation of saves | VERIFIED | A inserting `user_id = B` is rejected `42501`; fresh browser for another account restores `null` | rejected / `null` |
| Chromebook flow: progress → Supabase → clear all storage → sign in → launch → restored | VERIFIED for `cl2048` | `check-cloud-save.mjs` fresh-context restore plus the "different account sees nothing" check | restored value matched |
| Clear browser storage then restore | VERIFIED | fresh browser context discards all storage before sign-in | restored |
| Cross-device restoration | VERIFIED | same as above with an independent context | restored |

## Engine coverage

| Engine | Games | Status | Evidence |
| --- | --- | --- | --- |
| HTML5 `localStorage` (shimmed) | `cl2048` | VERIFIED | full capture → clear → restore round trip |
| IndexedDB | generic adapter + namespace contract | IMPLEMENTED BUT UNVERIFIED | adapter and unit tests only |
| Unity WebGL | catalog entries | IMPLEMENTED BUT UNVERIFIED | storage path covered by unit tests; no game played end-to-end this cycle |
| Ruffle / Flash | catalog entries | IMPLEMENTED BUT UNVERIFIED | as above |
| Emscripten | catalog entries | IMPLEMENTED BUT UNVERIFIED | as above |
| Proxy / stream / cross-origin frames | proxy and stream entries | external-service | progress lives on the provider's origin; Geegle makes no cloud-save claim |

One game is verified end to end. Every other engine row above is labelled
engine-compatible or unverified in the UI data and must not be described as
"cloud saves work" until a real play session, storage clear and restore has been
recorded per game id.

## Remaining work

1. Apply migration `0002` to production (owner), then re-run the conflict check.
2. Play one representative game per engine (Unity, Ruffle, Emscripten, IndexedDB),
   record id, mechanism, observed progress and restoration, and add each id to
   `VERIFIED_GAMES` only with that evidence.
3. Script the manual save/restore/import/export and failure-recovery paths.
