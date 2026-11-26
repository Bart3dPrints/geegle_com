# Cloud-save verification

Statuses: NOT STARTED, IN PROGRESS, IMPLEMENTED BUT UNVERIFIED, VERIFIED, BLOCKED.
Environment is stated per row: **production** is `https://bartisawesome.onrender.com`
with project `oizdbkxnzwatytxcrvoo`; **local** is the local Supabase stack
(Postgres + GoTrue with `GOTRUE_MAILER_AUTOCONFIRM=false`, migrations 0002/0005/0006).

Cycle: 2026-11-26, branch `feature/geegle-account-cloud-final`, from `7fe74b0`.

## How saving works

- `src/lib/saveAdapters.ts` — per-game adapters plus a generic adapter for shimmed
  local games. Storage is namespaced per `(game, account)`; IndexedDB database
  names are `geegle-game:<gameId>:<userId>:`, so ownership is a name check.
- `public/games/geegle-storage-shim.js` — the per-account view a game sees.
- `src/lib/cloudSaves.ts` — writes `public.geegle_game_saves` with a `revision`
  column; an update carries `.match({...identity, revision})`, so a stale revision
  matches zero rows and is surfaced as a conflict. Empty snapshots never replace a
  non-empty save, and local progress is kept when a write fails.
- `src/lib/saveManifest.ts` — per-game labels: `verified`, `engine-compatible`,
  `injectable`, `manual`, `unsupported`, `external-service`.

## Defects found and fixed in this cycle

### 1. `geegleSaveKey` was undefined, so three games could not save at all

`clspacebarclicker`, `clQuantumClicker` and `clohflip` were edited in an earlier
cycle to write through `geegleSaveKey(name)`. No file in the repository defined
that function, and `scripts/inject-storage-shim.mjs` skips any wrapper that
mentions it. Every save call in those games therefore threw `ReferenceError`
inside the game, leaving progress in memory only — and their explicit save
adapters could never capture anything.

Fixed in `public/games/geegle-storage-shim.js`: the shim now defines
`geegleSaveKey(key)` for signed-in players **and** guests (a guest must not get a
broken game). The helper returns the name unchanged because the shim already
scopes every key; returning a prefixed name would double-prefix it.

Regression test: `tests/storage-shim.test.mjs` — "the shim provides geegleSaveKey
for signed-in play", "… for guest play too", "a key written through geegleSaveKey
lands in this account namespace". Written first and seen to fail (3 failures,
`win.geegleSaveKey is undefined`) before the fix; the suite is 83 passing after.

### 2. `cl2048` was marked individually verified on fabricated evidence

`VERIFIED_GAMES` contained `cl2048`. Its shipped wrapper loads every script from
`cdn.jsdelivr.net` and contains no storage manager, so the game keeps no progress
at all: a real play run produced `score=16 tiles=9` with **0 storage keys
written**. The previous production run "restored actual gameplay progress" by
writing `e2eProgress` from the test itself — a mechanism probe presented as game
support.

`VERIFIED_GAMES` is now empty and `tests/save-manifest.test.mjs` asserts that
`cl2048` is never advertised as verified again. The production acceptance script
now labels the probe for what it is (account-scoped capture/restore mechanism).

## Behaviour matrix (production unless stated)

| Requirement | Status | Evidence |
| --- | --- | --- |
| Automatic capture and sync of changed storage every 15 s | VERIFIED | `production-cloud-saves.mjs` check 5: storage changed → "Progress saved to cloud." → row revision `3dc57d1c`/`d64fb4f8` read back as the same account |
| Restoration before the game initialises | VERIFIED | production acceptance 20: fresh profile, same account, value present in the frame before play |
| Save before exiting a game / before logout | IMPLEMENTED, EXERCISED | the exit and logout paths await `handle.close()`; the write is not isolated from the same 15-second tick, so it is not claimed separately |
| Safe additional persistence on page lifecycle | IMPLEMENTED BUT UNVERIFIED | `saveNow()` is available to lifecycle handlers; no unload-only dependency, and no scripted check |
| Manual save | VERIFIED | production check 5: "Progress saved to cloud.", row updated |
| Manual restore | VERIFIED | production check 7: confirm → "Cloud save restored." |
| Export | VERIFIED | production check 6: download parses as JSON with `gameId: cl2048` and the game's key |
| Import valid | VERIFIED | production check 10: "Save file imported and synced to the cloud." |
| Import invalid | VERIFIED | production check 8: "Unrecognized cloud save format." |
| Import from another game | VERIFIED | production check 9: "This save file belongs to a different game." |
| Failed cloud upload | VERIFIED | production check 11: offline write → "Offline. Your device still has its progress; sync will retry." |
| A failed save never destroys stored progress | VERIFIED | production check 12: revision unchanged `d64fb4f8 → d64fb4f8` during the failure |
| Network disconnection + reconnection | VERIFIED | production check 13: back online → revision advanced to `53f4adc9` with no on-screen confirmation (the status box was later removed) |
| Conflict detection / stale revision rejected | VERIFIED | `production-data-integrity.mjs`: revision rotates on an accepted write, a stale revision matches 0 rows, newer `{"progress":2}` survives |
| Empty snapshot cannot replace a valid save | VERIFIED (code + tests) | `tests/cloud-saves.test.mjs`; capture returns null for empty storage and upload returns early |
| Account isolation of saves | VERIFIED | A cannot read B's saves, insert as B (`42501`), update or delete them |
| Restored value belongs to the account, not the browser | VERIFIED (mechanism) | the value returns only after signing in; a second account receives `null` |

## Genuine gameplay coverage: no game is verified yet

This cycle tried to produce *game-written* progress and restore it in a destroyed
browser profile. `scripts/qa/production-cloud-saves.mjs` plays a game with real
input, then requires that playing **added storage the game wrote itself**; if it
did not, the run records SKIP with the observation instead of inventing a key.

| Game | Engine / mechanism | Result | Observed |
| --- | --- | --- | --- |
| `cl2048` | HTML5, CDN build | SKIP — no persistence | real play `score=16 tiles=9`; 0 storage keys written; wrapper loads all scripts from a CDN and ships no storage manager |
| `clspacebarclicker` | HTML5 `localStorage` | SKIP — save routine never runs | real play `counter=13`; 0 game keys. Local diagnosis: the page throws during init (`init is not defined`, `Cannot read properties of null (reading 'innerHTML')`), and `loadGame()` returns on a fresh profile **without clearing `this.reloading`**, so `saveGame()` is skipped forever for a first-time player. This is the game's own defect; the wrapper was left unmodified beyond the `geegleSaveKey` fix in the shim |
| `clquantumclicker` | HTML5 `localStorage` | SKIP — no progress written | 18 clicks on its main button added no storage of its own (`#stats` unchanged) |
| `clohflip` | HTML5 `localStorage` (canvas) | SKIP — no progress written | 12 canvas clicks added no storage of its own |
| IndexedDB games | generic adapter | IMPLEMENTED BUT UNVERIFIED | adapter and unit tests only; no game played to a save point |
| Unity WebGL | many wrappers | IMPLEMENTED BUT UNVERIFIED | frames load; automated input produced no game-written storage |
| Ruffle / Flash | many wrappers | IMPLEMENTED BUT UNVERIFIED | as above |
| Emscripten | many wrappers | IMPLEMENTED BUT UNVERIFIED | as above |
| Proxy / stream / cross-origin | catalog proxies | external-service | progress lives on the provider's origin; no cloud-save claim |

What *is* proven for these games is the mechanism: with a key present in the
account's namespaced storage, capture, upload, revision handling, cleared-profile
restore, import/export and failure recovery all work on production.

## Remaining work

1. Per-game play scripts that reach a real save point (finish a level, lose a run,
   beat a score) per engine, then add each id to `VERIFIED_GAMES` with the recorded
   observation.
2. Fix or quarantine `clspacebarclicker`'s init crash before any save claim is made
   for it (it is a game-content defect, not a platform defect).
3. Script the page-lifecycle save path separately from the 15-second tick.

---

## Player feedback after the status overlay removal (2026-11-26)

Branch `fix/geegle-changelog-notifications`, from `fdf2ab3`.

The bottom-right status box is gone from the player: no container, no text and
no reserved space. A routine automatic save is silent. What remains is the one
message line the player already used:

| Situation | What the player shows |
| --- | --- |
| Manual save (`Save progress to cloud`) | `Progress saved to cloud.`, or `No changes to save — already in sync.` |
| Manual restore | `Cloud save restored.` / the reason it could not be |
| Export / import | `Save file downloaded.` / `Save file imported and synced to the cloud.` / the validation error |
| Conflicting cloud and device progress | `Cloud progress differs. Choose Restore from Cloud or Keep This Device.` |
| Failed synchronisation you can act on | `Cloud sync failed. Your device still has its saved progress.` |
| Automatic save success, offline, unsupported | nothing (no standing box, no repeated notice) |

Evidence that saving still runs without the overlay (local backend, 6/6 in
`scripts/qa/check-cloud-save.mjs`): progress written inside the game was
captured on the 15-second tick, the stored row matched it, a fresh browser
restored it for the same account, and a different account received nothing.

`production-cloud-saves.mjs` check 13 now asserts the status container is absent
instead of reading `Saved to Cloud` from it, and check 14 proves reconnection by
the stored revision advancing in the background, without any on-screen
confirmation.

The same checks on production are pending the deploy that follows this merge;
the deployed bundle still contains the old overlay.
