# Geegle project completion queue

Track: project development.

Specification: Geegle-final-prompt-7-percent-stop.md, supplied 2026-11-25. Continue PR #2 on `feature/platform-overhaul`; never merge without approval, purchase credits, or modify unrelated production data. Statuses: NOT STARTED, IN PROGRESS, IMPLEMENTED BUT UNVERIFIED, IMPLEMENTED AND VERIFIED, TEMPORARILY BLOCKED, EXTERNALLY BLOCKED. The checklist records work remaining, not claims of overall completion.

## Work queue

| Requirement / task | Status | Files / evidence | Next action |
| --- | --- | --- | --- |
| Restore corrupted artwork and save adapter source and JSON, fix imports/types | IMPLEMENTED AND VERIFIED | `src/data/artwork.ts`, `scripts/artwork-map.json`, `src/lib/saveAdapters.ts`, `src/components/GamePlayer.tsx`, `src/types.ts`: `npm ci`, `npm run typecheck`, `npm run build` passed locally | Review diff and runtime; retest as changes land |
| Lint errors and warnings; maintainable checks | IMPLEMENTED AND VERIFIED | Baseline `d45a6dd`: 9 errors and 0 warnings. After landing integration and the scoped legacy Edge Function fix, `npm run lint` passed | Rerun against the final combined changes |
| Full design-report point-by-point audit and platform responsive/accessibility improvements | IN PROGRESS | Linked Vibe Coded Websites Report accessible; design audit underway | Review every applicable point, record checklist and implement fixes |
| Restore independent search landing, navigation and customization; account sync | IMPLEMENTED AND VERIFIED | Recovered `eee8a36` as `70f7075`. Chrome with isolated Supabase verified the existing gate, browser Back, web/lucky search dispatch, appearance preview, upload compression and rejection, device persistence, account sync, ownership isolation, and concurrent server-default writes. Desktop, Chromebook-sized, and mobile viewports were exercised | Verify hosted Render behavior only after approved rollout |
| Per-game/app artwork research, source/verification manifest and image display | IN PROGRESS | `scripts/artwork-map.json`: 25 reviewed records retained as evidence but no display rights established; none marked reuse-cleared | Research licensed/authorized images in batches, verify identity, decoding and display; use neutral fallback until cleared |
| Everythingle, 61 proxy endpoints, settings and authorized compatibility | NOT STARTED | `src/components/EverythingleApp.tsx`, `src/data/proxies.ts` | Audit endpoint counts, features and actual supported integrations; test failures, persistence and fallbacks |
| Cloud saves: restore-before-launch, change sync, exit/logout, offline, conflicts, empty-save protection and isolation | IMPLEMENTED AND VERIFIED (local) | `src/lib/cloudSaves.ts`, `src/lib/saveAdapters.ts`: generic adapter now covers every local `/games/*.html` entry; restore-before-launch, 15 s sync, save-on-exit, save-before-logout, manual save/restore, export/import, offline retry and conflict resolution all covered by `tests/cloud-saves.test.mjs` (31 tests pass) | Confirm production Supabase applies `0002` before enabling the revision path in a release |
| IndexedDB schema and data fidelity, engine support and compatibility manifest | IMPLEMENTED AND VERIFIED (local Chromium) | `src/lib/storageSnapshot.ts` dumps/restores database version, object stores, key paths, autoIncrement, indexes, original keys, ArrayBuffer/typed arrays/Blob/Date/Map/Set; verified in Chromium via `scripts/verify-cloud-saves.py` (version 3, index `byLevel`, out-of-line key 41, Blob `[1,2,3]`, Uint8Array `[9,8,7]` all restored) | Re-run the script after storage changes; capture per-game evidence in the compatibility manifest |
| Per-account game storage isolation for same-origin HTML5 games | IMPLEMENTED AND VERIFIED (local Chromium) | `public/games/geegle-storage-shim.js`, `scripts/inject-storage-shim.mjs` (90 wrappers injected, 3 already scoped, idempotent); Chromium confirmed key `geegle-game:<id>:<uuid>:saveSlot`, second account sees `null`, guest writes stay unscoped | Extend to Flash/Unity via IndexedDB capture (already covered by the generic adapter); keep shim script idempotent when wrappers change |
| Accounts, preferences, history, favorites, password changes, entry gate, Supabase security | IN PROGRESS | `src/hooks/useAuth.ts`, `src/services/auth.ts`, `src/lib/userData.ts`; read-only Supabase inspection found Geegle tables with RLS ownership policies | Audit account transitions and schema; verify using isolated test data only when safe; never alter unrelated production data |
| Automatic deletion remains disabled; safe storage optimizations | NOT STARTED | Supabase migration history includes retention preview migrations; current state not yet fully verified | Inspect scoped function/cron definitions read-only, audit source; do not delete unrelated data |
| Legitimate missing games, authorized Pokémon support, Krillion official and backup | NOT STARTED | Specification sections 11–12; `docs/PKMN-EMULATOR.md` | Research authorized sources, verify integrations and distinct stable IDs; never distribute unauthorized ROMs |
| Catalog counts, duplicates, launch paths, categories, aliases, unique games and compatibility | IN PROGRESS | `scripts/audit-catalog-paths.mjs` at b8bfb08: 2,622 unique game IDs, 2,612 local files, one external, nine missing; 218 original same-ID paths restored | Check individual playability and nine missing entries; compare original catalog, fix duplicate audit before acting on it, preserve uncertain entries |
| Preserve prior features, search, categories, YouTube, navigation, fullscreen and Space Waves | NOT STARTED | Specification section 14 | Compare original and current source, verify controls and fix regressions |
| Full code/diff review, build, typecheck, lint, runtime and all game/app/artwork checks | IN PROGRESS | Initial broken branch repaired and built locally; independent runtime audit used scratch copy | Verify current head and responsive layouts, account and game flows; record individual results and limitations |
| PR description, final counts, outstanding blockers and comprehensive final audit | NOT STARTED | PR #2 | Update description after substantial changes; report only evidence-backed completion |

## Blocker log and checkpoints

- **Usage telemetry:** no remaining-allowance or usage tool is exposed in the available runtime. The 7% stop cannot be monitored automatically. Checkpoint frequently; do not invent a percentage. If telemetry becomes available, stop new work below 7%, safely stop workers, preserve progress, update PR and hand off without automatic resumption.
- **Optional conversation reference:** the Codex conversation read exceeded 70 seconds before being terminated. The recovered Git commits, existing branch, and supplied specification provided the baseline for independent work.
- **Deployment:** GitHub reports Cloudflare Pages and Workers Builds failed; GitHub exposes dashboard links but not their logs. At b8bfb08 Vercel passed while both Cloudflare checks failed after the local build succeeded. No provider token/CLI was found; diagnose with authorized dashboard access and revisit on new heads. No production configuration changes or purchases.
- **Live account/cloud verification:** Supabase MCP read access exists; Geegle tables and own-row policies were inspected without modifying data. No local app Supabase environment was configured. Use safe isolated testing and do not assume read access proves end-to-end behavior.
- **Specification and design:** full specification is attached; linked design report is accessible. The requested exhaustive audit and application verification remain unfinished.

- **Recovered cloud-save patch:** `d3ba148` contains three game-specific adapters and additive revision migration. The local tests cover restore, conflicts, retries, and the missing-migration failure. Real database and browser testing are outstanding. The frontend disables cloud uploads when the migration is absent. Production migration and frontend rollout require coordinated approval after isolated verification.
- **Entry gate:** local code uses the public database RPC, not the separate edge function described in README. Password is public in repository history and static game assets are accessible directly; the gate is not a security boundary. Verify actual RPC behavior and correct documentation without exposing credentials or claiming access control.

## Cloud-save hardening audit (2026-11-25)

Independent inspection of `ba0b634` reported ten defects. Status of each, with the
change that addresses it and the evidence that covers it:

| # | Defect | Resolution | Evidence |
|---|--------|------------|----------|
| 1 | Shim read unscoped legacy storage for every account | Legacy keys are adopted **once per game** into the first account's namespace, guarded by `geegle-legacy-adopted:<gameId>`; later accounts read nothing | `tests/storage-shim.test.mjs` "legacy progress is adopted once" |
| 2 | `removeItem` deleted unscoped keys (other games/platform state) | `removeItem` now only touches the scoped key; `clear()` only the game's keys | "removeItem never deletes unscoped keys", "clear only removes this account's keys" |
| 3 | IndexedDB ownership inferred from databases created during play | Ownership is now explicit: the shim prefixes every database name with `geegle-game:<gameId>:<userId>:`, and the adapter only ever reads/deletes names under that prefix | "IndexedDB names are namespaced per game and account", "capture ignores databases that are not this account's" |
| 4 | Restore deleted and recreated arbitrary databases | `validate` + `restore` both reject any database name outside the caller's namespace, plus version/store/record limits | "a save cannot reference a database outside this game/account namespace" |
| 5 | Blocked delete treated as success | `deleteDatabase` rejects on `onblocked`/`onerror`; the restore fails and writes nothing | "a blocked database delete fails the restore instead of reporting success" |
| 6 | Account switch could expose the previous account's progress | Isolation is structural (account in every key and database name), applied before the cloud read; an isolation failure blocks the frame from opening (`canLaunch()`) | Browser check below; "isolation is structural and independent of any delete" |
| 7 | Every local game claimed automatic saves | Support comes from a generated coverage table (`scripts/generate-save-coverage.mjs`); cross-origin embeds and >24 MB single-file builds are reported unsupported/external | `src/data/saveCoverage.ts`, `saveSupportFor` |
| 8 | Dynamic scripts, property access, nested frames, engine storage | Shim is Proxy-based (property get/set/delete/enumeration), installs into same-origin nested frames, scopes `sessionStorage` and `indexedDB`; injection happens before game scripts via the service worker | `tests/storage-shim.test.mjs`; browser check below |
| 9 | Game code could reach platform tokens/unrelated storage | In-page unscoped localStorage/sessionStorage/IndexedDB are hidden from the game. **Residual:** a game can still reach `window.parent` storage because frames are same-origin; closing that requires moving the session off `localStorage`, which is not part of this change | Documented limitation, not claimed as fixed |
| 10 | Imported saves not checked against the game | v3 snapshots carry `gameId`; `validate(snapshot, userId)` rejects other games and the import path passes the signed-in user | "a save from another game is rejected, not restored" |

Coverage mechanism: editing 2,800 wrappers would rewrite ~1.5 GB of game blobs, so
`public/geegle-sw.js` injects `/games/geegle-storage-shim.js` into every
`/games/*.html` navigation at response time (absolute URL, because wrappers set
`<base href>`). Table: 2830 injectable, 63 cross-origin-only wrappers, 26 oversize
builds; engine markers observed: 535 Unity, 575 Ruffle, 64 Emscripten.

Browser verification (local Chromium, Vite dev server, `cl2048.html` which sets a
CDN `<base>`): service worker `activated`; shim present with prefix
`geegle-game:cl2048:1111…:`; probe value written through `localStorage`; IndexedDB
`probeDb` created and then listed from the unshimmed app page as
`geegle-game:cl2048:11111111-…:probeDb`; account `2222…` saw `null`, zero keys and
no databases; account `1111…` read `acct-A` again afterwards.

Checks: `npm run typecheck` 0, `npm run lint` 0, `npm run build` ok,
`npm test` (`bun test tests`) 49 pass / 0 fail across 9 files.
