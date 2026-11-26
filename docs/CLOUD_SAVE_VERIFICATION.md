# Cloud-save verification

Statuses: NOT STARTED, IN PROGRESS, IMPLEMENTED BUT UNVERIFIED, VERIFIED, BLOCKED.
Environment is stated per row: **production** is `https://bartisawesome.onrender.com`
with project `oizdbkxnzwatytxcrvoo`; **local** is a local Supabase stack with the
same migrations.

## How saving works

- `src/lib/saveAdapters.ts` — per-game adapters plus a generic adapter for shimmed
  local games. Storage is namespaced per `(game, account)`; IndexedDB database
  names are `geegle-game:<gameId>:<userId>:`, so ownership is a name check.
- `src/lib/cloudSaves.ts` — writes `public.geegle_game_saves` with a `revision`
  column; an update carries `.match({...identity, revision})`, so a stale revision
  matches zero rows and is surfaced as a conflict. Empty snapshots never replace
  a non-empty save, and local progress is kept when a write fails.
- `src/lib/saveManifest.ts` — per-game labels: `verified`, `engine-compatible`,
  `injectable`, `manual`, `unsupported`, `external-service`. `VERIFIED_GAMES`
  currently contains `cl2048` only.

## Behaviour matrix

| Requirement | Status | Environment | Evidence |
| --- | --- | --- | --- |
| Automatic save when progress changes (≤15 s) | VERIFIED | production | live run: progress saved to the account, `revision` present, row read back as the same account |
| Restoration before initialisation | VERIFIED | production | fresh browser profile, same account, stored value present in the game frame before play |
| Save before exiting a game / before logout | IMPLEMENTED BUT UNVERIFIED | — | code path awaits the final capture; not re-exercised this cycle |
| Manual save, restore, import, export | IMPLEMENTED BUT UNVERIFIED | — | controls exist in the player; no scripted check this cycle |
| Never overwrite a valid save with an empty snapshot | IMPLEMENTED BUT UNVERIFIED | — | guarded in `cloudSaves.ts`; not re-exercised |
| Failed-save recovery keeps local progress | IMPLEMENTED BUT UNVERIFIED | — | guarded in `cloudSaves.ts`; not re-exercised |
| Conflict detection | VERIFIED | production | new save gets a revision, an accepted write rotates it (`869f5edf → 0aa565a2` and `updated_at` advances), a stale revision matches zero rows, and the newer `{"progress":2}` survives the stale write |
| Account isolation of saves | VERIFIED | production | A cannot read, insert (`42501`), update or delete B's saves; a second account restores `null` |
| Cleared storage → sign in → launch → restored | VERIFIED | production | appearance, favorites and the game value all returned after storage was discarded |
| Cross-device / cross-browser restoration | VERIFIED | production | independent browser context restored the account's progress |

## Engine coverage

| Engine | Representative game | Status | What was actually observed |
| --- | --- | --- | --- |
| HTML5 `localStorage` (shimmed) | `cl2048` | VERIFIED for the capture/clear/restore mechanism | the account's stored snapshot contains the game frame's storage and a fresh profile restores it. The progress value was written by the test inside the frame, not produced by winning a game |
| IndexedDB | generic adapter | IMPLEMENTED BUT UNVERIFIED | adapter and unit tests only; no game played end to end |
| Unity WebGL | `Slope`, `1v1`, … | IMPLEMENTED BUT UNVERIFIED | frames load in production; automated input did not produce game-written storage |
| Ruffle / Flash | `Bloxorz` | IMPLEMENTED BUT UNVERIFIED | as above |
| Emscripten | `Drive Mad (1) copy` | IMPLEMENTED BUT UNVERIFIED | as above |
| Proxy / stream / cross-origin | proxy entries | external-service | progress lives on the provider's origin; no cloud-save claim is made |

An automated attempt to generate genuine gameplay state on production (arrow-key
input into 2048, Bloxorz and Slope, then comparing the game's own storage before
and after) produced no game-written state: these titles persist on their own
lifecycle events, so each needs a per-game play script to reach a save point. That
attempt was not kept as a test because it cannot fail meaningfully.

Not claimed: "cloud saves work for the library". One game has a verified
capture/restore path, the rest are engine-compatible at best.

## Remaining work

1. Per-engine play scripts that reach a real save point (finish a level, lose a
   run, beat a score), then add each game id to `VERIFIED_GAMES` with the recorded
   observation.
2. Script the manual save/restore/import/export and failed-upload recovery paths.
