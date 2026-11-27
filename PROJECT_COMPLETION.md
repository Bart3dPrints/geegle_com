# Geegle project completion queue

Track: project development.

Specification: Geegle-final-prompt-7-percent-stop.md, supplied 2026-11-25. Continue PR #2 on `feature/platform-overhaul`; never merge without approval, purchase credits, or modify unrelated production data. Statuses: NOT STARTED, IN PROGRESS, IMPLEMENTED BUT UNVERIFIED, IMPLEMENTED AND VERIFIED, TEMPORARILY BLOCKED, EXTERNALLY BLOCKED. The checklist records work remaining, not claims of overall completion.

## Current artwork status (2026-11-27, supersedes the artwork counts below)

| Measure | Count |
| --- | --- |
| Catalog rows (unique IDs) | 2,710 |
| Verified artwork | 1,036 (38.2%) |
| Awaiting visual review | 0 |
| Unprocessed | 0 |
| Blocked with a recorded reason | 1,674 |

Blockers by rule: `blank-render` 1,146 (the served wrapper rendered only blank, loading or portal content in every captured frame), `capture-rejected` 387 (every frame rejected during visual review), `candidate-unusable` 108 (published candidates failed validation), `no-build` 35 (no local build and no published asset). Every one of the 2,710 entries is therefore either verified or blocked for a stated, re-checkable reason; artwork coverage is **38.2%**, not 100%.

Machine-readable state lives in `scripts/artwork/progress.json`, `captured.json`, `review.json` and `blocked.json`; `docs/ARTWORK_COMPLETION_REPORT.md` is regenerated from them by `scripts/artwork/report.py`. The artwork counts in the sections below are earlier snapshots.

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

## Recovery and remaining-work evidence (2026-11-25, second session)

### 1. Unpushed work recovered and published
`f1d61ad` was intact locally with no remote configured. `origin` was added,
`feature/platform-overhaul` fetched (4 commits ahead of the merge base), and the
local rewrite merged over it: the remote shim/adapters used an ownership ledger,
the local rewrite uses explicit `geegle-game:<gameId>:<userId>:` namespacing, so
the newer implementation won the four conflicting files. Every regression the
remote commits added is covered by `tests/storage-shim.test.mjs` and
`tests/save-isolation.test.mjs` (the older copies of those tests target the
removed ledger API and were not kept). Pushed fast-forward:

- `4c56a5c..d6ae571` merge commit, then `1dae5f3`, then `7a929eb`.
- GitHub PR #2 head confirmed as `d6ae57190902840df3b00523a0e6af3cb48baf89`
  (`GITHUB_GET_A_PULL_REQUEST`), base `main`, still open and unmerged.

Recovery artefacts: branch `backup/f1d61ad`, patch
`/tmp/geegle-recovery/0001-Make-cloud-saves-account-safe-and-evidence-based.patch`.

### 2. Save-support claims now match the evidence
`saveSupportFor` no longer returns `automatic` for every injectable wrapper.
Tiers (`src/lib/saveManifest.ts`), computed over the shipped wrappers:

| Tier | Count | Meaning |
|------|-------|---------|
| verified | 1 (`cl2048`) | played, progress captured, browser storage cleared, restored |
| engine-compatible | 1174 | wrapper's storage mechanism (Unity/Emscripten IndexedDB, Ruffle/localStorage, IndexedDB) is covered by the save tests; this game was not played |
| injectable (experimental) | 1592 | shim injectable, no storage mechanism detected, no claim |
| external-service | 63 | cross-origin frame or proxy/stream |
| unsupported | 26 | single-file build above the 24 MB inject limit |

`ENGINE_BY_GAME` is generated per game (1175 entries; 535 Unity, 575 Ruffle,
64 Emscripten, 8 IndexedDB, 28 localStorage markers). Capture is still attempted
for experimental games — that is real functionality — but their label reads
"Experimental cloud save", never "Automatic".
New coverage: `tests/save-manifest.test.mjs` (6 tests), including "no injectable
game outside the evidence list is reported as verified".

### 3. Same-origin session exposure (defect 9) narrowed
`src/lib/storageGuard.ts` captures the real `Storage` for the Supabase client and
replaces `window.localStorage` / `window.sessionStorage` with a view that hides
`geegle-auth-session`, `sb-*-auth-token` and `geegle-auth-*`: reads return null,
writes and deletes are ignored, enumeration and `clear()` skip them. Tested in
`tests/storage-guard.test.mjs` (4 tests). Verified in the production build served
by `vite preview` on 127.0.0.1:4173: the page rendered, the getter was the guard's,
`setItem('geegle-auth-session', …)` left no value, and no auth key was enumerable.

**Residual risk (not fixed):** games still run on the same origin, so untrusted
code can call platform APIs through `window.parent`, and can frame other platform
pages. A complete boundary needs games served from a separate origin; that is a
deployment change, not something a storage shim can provide.

### 4. Supabase — real database verification
Production project `oizdbkxnzwatytxcrvoo` inspected read-only:
- `geegle_*` tables exist with RLS enabled and per-user policies; `anon`,
  `authenticated`, `service_role` have full DML grants (production was granted
  by hand); `pgcrypto` lives in `extensions`.
- **`0002_game_save_revision.sql` is missing**: `geegle_game_saves` has no
  `revision` column and no `geegle_game_saves_revision` trigger.
- **`0003_entry_gate_pgcrypto.sql` is missing**:
  `geegle_verify_entry_password` still has `search_path=public` while `pgcrypto`
  is in `extensions`.
- Migration history shows only three unrelated `*_preview` migrations.
- **No automatic inactivity deletion**: `cron.job` does not exist (no pg_cron),
  the only trigger on Geegle tables is `geegle_settings_touch`, and no function
  performs date-based deletion. The 8-month deletion stays disabled.

Isolated project `wkdlsaydqyymynoipmhl` ("geegle", separate from production):
- Applied `0001`, `0002`, `0003` — clean; `revision` column and trigger present,
  gate function now `search_path=pg_catalog, extensions`.
- **New defect found and fixed:** `0001` never grants table privileges, so a
  fresh project returns "permission denied for table …" before RLS runs. Added
  `supabase/migrations/0004_api_grants.sql` (own-row DML for `authenticated`,
  no client grants on the two gate tables) and applied it there.
- Verified on that database: `geegle_verify_entry_password` returns
  `{"valid":true}` for `pirate`, `{"valid":false}` for a wrong password, and
  writes an attempt row; as role `authenticated` with a JWT `sub`, a user can
  insert/update their own save, cannot see another user's rows, and an insert
  carrying another user's `user_id` fails with `42501` (RLS). An update wrote
  `revision=eb2db41b-…` and `save_data.score=99`, so the trigger works.
- `tests/` cannot exercise this: the client-side suite is stubbed.

**Blocker for end-to-end account testing:** the isolated project has email
confirmations enabled and rejects/limits the synthetic addresses
(`users.geegle.internal`): signup returns no session and would need mail the
domain can never receive. Testing registration, password change, cross-device
restore and account switching in the browser needs either "Confirm email"
disabled in that project's Auth settings or admin-provisioned users. Not done
here because it is a dashboard setting, not a code change.

### 5. Catalog reconciliation (deterministic scripts)
`node scripts/audit-catalog-paths.mjs` and `node scripts/audit-duplicates.mjs`:
- HTML wrappers in `public/games`: **2856**.
- Catalog rows / unique ids: **2621 / 2621** (no duplicate id rows).
- Distinct launch paths: **2619**; existing local paths: **2610** (2609 distinct);
  external: **6**.
- Missing launch paths: **5** (`clkengriffeyjr`, `clu-can-t-believe`,
  `clgdwaveover100mb`, `clprecisionclient`, `clundertale-gameboy-1`).
- Unreferenced HTML wrappers: **248**.
- Identical wrapper files by SHA-256: **9 groups**; same-path groups: **2**
  (`clgranny`/`clgrannyy`, `clcolorboxmustard`/`colorbox-mustard`).
  These were left in place: identical bytes do not prove the catalog entries are
  meant to be one game, and the instruction is to remove only confirmed
  duplicates.
- Coverage table vs catalog: 2830 + 26 oversize + 63 cross-origin only describes
  wrapper files, not catalog entries, which is why its totals differ from 2621.

### 6. Artwork (superseded by "Current artwork status" at the top)
`scripts/artwork/captured.json` holds **73 authentic assets + 30 screenshots =
103 records**, and every referenced file exists with non-zero size (110 files in
`public/artwork`, 11 of them under 1 KB — small but valid 40–500 px thumbnails).
Coverage is therefore 103/2621 catalog entries (~3.9%). The screenshot sweep was
**not** resumed in this session: the browser used for capture wedged on a game
loop and no further captures were taken. No artwork is claimed beyond these 103.

### 7. Design report
The published report was read in full. Code-level audit:
- No purple/violet/indigo/fuchsia utilities, no sparkle icons or emoji in UI,
  no gradient surfaces (`index.css` documents "no gradients, no neon glows";
  the only gradients are the landing page's background-image scrims), only
  `rounded-md`/`rounded-lg` plus intentional `rounded-full` pills, two
  `backdrop-blur` uses.
- Loading states exist in the player, account settings, YouTube, Everythingle and
  the shell (`animate-spin`/`animate-pulse`).
- Missing OG image fixed: added `public/og-image.jpg` and `og:image`,
  `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image` to
  `index.html` (description, og:title/description and favicon already existed).
- Not verified: visual layout at desktop/Chromebook/mobile widths, grid alignment
  and hover behaviour, because the preview browser could not be driven.

### 8. Integrations
`src/data/external.ts` records Everythingle as a direct frame with the official
destination and Krillion from the official embed guide
(`https://krillion.cc/embed-guide/`); Krillion Backup keeps one stable id
(`clkrillion-backup`) across Games and Apps, covered by
`tests/catalog-audit.test.mjs`. Fullscreen controls exist in
`EverythingleApp.tsx`. Browser-level verification of framing, retries and
external fallback was **not** performed this session.

### Checks run (this session, fresh)
`npm run typecheck` 0 · `npm run lint` 0 · `npm run build` 0 (`dist/geegle-sw.js`
present) · `bun test tests` 59 pass / 0 fail across 11 files.

## Final quality pass (2026-11-25, third session)

Branch `fix/final-production-quality`, created from the merged `main` (`b65ffdb`,
PR #2). `HEAD` matched `origin/main` before the branch was cut, so this work is
corrective and additive.

Fresh checks at the end of this pass: `npm run typecheck` 0, `npm run lint` 0,
`npm run build` 0, `bun test tests` 70 pass / 0 fail across 13 files,
`node scripts/qa/journey.mjs` 35 checks pass / 0 fail with no page errors and no
failed same-origin requests.

### Requirement checklist for this specification

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | No unrequested visible elements, content or navigation | IMPLEMENTED AND VERIFIED | Rendered library contains only brand, secondary nav, search, filters, alphabetical rail, cards, Starred, optional Recently Played, account/settings, `docs/qa/library-desktop.png` |
| 2 | No development content in public text, metadata, assets or errors | IMPLEMENTED AND VERIFIED | `tests/public-content.test.mjs` (8 tests); two real leaks found and removed (see below) |
| 3 | Browser title exactly `Geegle` | IMPLEMENTED AND VERIFIED | `index.html`, live `document.title`, test |
| 4 | Circular Geegle G favicon | IMPLEMENTED AND VERIFIED | `public/favicon.svg` is a circle in the neutral palette; assert in the content test |
| 5 | Landing: faithful Google composition, no Games shortcut, no promo text | IMPLEMENTED AND VERIFIED | `docs/qa/landing-desktop.png`; `SearchLanding.tsx` no longer renders the library shortcut |
| 6 | Neutral person silhouette when logged out, landing top-right | IMPLEMENTED AND VERIFIED | `.gl-avatar` in the screenshot; `signedIn` prop keeps it neutral |
| 7 | `pirate` opens the library directly | IMPLEMENTED AND VERIFIED | Journey: "pirate opens the library" (`#games`) |
| 8 | No secondary password page or verification modal | IMPLEMENTED AND VERIFIED | Gate component deleted from `App.tsx`; journey asserts no password input; content test forbids the old gate strings |
| 9 | Only one Games/Apps/Proxies navigation area, without the small duplicate | IMPLEMENTED AND VERIFIED | Header renders one full-width secondary nav; journey counts exactly 3 section buttons |
| 10 | Footer exactly `Bart made this. Thank him` | IMPLEMENTED AND VERIFIED | `src/lib/brand.ts` + live footer text + test |
| 11 | Overhaul/redesign wording removed everywhere public | IMPLEMENTED AND VERIFIED | Footer build string removed; branch name stripped from 30 artwork source URLs; internal comment removed from bundled catalog data |
| 12 | No navy/dark blue/purple/neon/gradient/glow/sparkle/emoji styling | IMPLEMENTED AND VERIFIED | Blue accent replaced with slate-900/slate-100 tokens in `index.css`; screenshots show a neutral grayscale interface |
| 13 | Motion library actually used | IMPLEMENTED AND VERIFIED | `motion/react`: account menu, auth dialog, settings dialog, search dialog, tab underline (`layoutId`), Recently Played reveal, player entrance, star tap |
| 14 | Anime.js actually used | IMPLEMENTED AND VERIFIED | Alphabetical scroll (`animate` on a scroll proxy) and the per-filter card stagger (`stagger`), first 60 cards only |
| 15 | Reduced motion respected | IMPLEMENTED AND VERIFIED (code + CSS) | `useReducedMotion` gates every JS animation; `prefers-reduced-motion` block in `index.css` |
| 16 | Interface responsive during transitions | PARTIALLY VERIFIED | Animations are opacity/translate only, 140–420 ms; responsive layouts measured at 3 widths |
| 17 | Favorites visible without hovering | IMPLEMENTED AND VERIFIED | Always-visible `aria-pressed` star; journey toggles it |
| 18 | Recently Played hidden by default with a settings toggle | IMPLEMENTED AND VERIFIED | Journey: unchecked by default, hidden before any play, visible after a play, persisted across reload |
| 19 | Separate full-width alphabetical sections | IMPLEMENTED AND VERIFIED | 27 sections `#letter-A…`; `tests/library-alphabet.test.mjs` |
| 20 | Working alphabetical sidebar navigation | IMPLEMENTED AND VERIFIED | Journey: clicking M scrolls to the M section; active letter tracks the scroll position |
| 21 | Fuzzy search, misspelling tolerant | IMPLEMENTED AND VERIFIED | Journey: `amogn us` finds Among Us |
| 22 | Category filtering | IMPLEMENTED AND VERIFIED | Journey: Puzzle reduces the grid and All restores it |
| 23 | Separate Games/Apps/Proxies views | IMPLEMENTED AND VERIFIED | One secondary nav, three views |
| 24 | Username/password registration | EXTERNALLY BLOCKED | Deployed build has no Supabase credentials (`placeholder.invalid`) and predates this work; login/session/logout verified against the isolated backend. See the authentication section |
| 25 | Username/password login | IMPLEMENTED AND VERIFIED (isolated backend) | Journey signs in `qauser1`; wrong password rejected by the API |
| 26 | Secure persistent sessions | IMPLEMENTED AND VERIFIED | Session survives reload and a new tab; `storageGuard` hides the session from game frames |
| 27 | Explicit logout | IMPLEMENTED AND VERIFIED | Account menu → Log out returns to signed-out state |
| 28 | Account isolation | IMPLEMENTED AND VERIFIED | `qauser2` starts with no favorites and Recently Played off |
| 29 | Password change | IMPLEMENTED BUT UNVERIFIED IN UI | `AccountSettings` calls `auth.updateUser`; not exercised end-to-end this pass |
| 30 | Cloud-save restoration | IMPLEMENTED AND VERIFIED (earlier + unit) | `tests/cloud-saves.test.mjs`; player mounts only after `sync.restored` |
| 31 | Authentic artwork for every obtainable game | IN PROGRESS | 74 of 2,621 entries carry authentic artwork (71 official assets + 3 licensed); the screenshot tier was withdrawn as inaccurate, see below |
| 32 | Missing-game research | NOT STARTED | No authorized build obtained; unchanged from the prior session |
| 33 | Catalog verification | IMPLEMENTED AND VERIFIED | `node scripts/audit-catalog-paths.mjs`, `audit-duplicates.mjs`; `tests/catalog-audit.test.mjs` |
| 34 | Existing integrations preserved | IMPLEMENTED BUT UNVERIFIED | Everythingle and Krillion code paths unchanged; framing/retry not re-driven this pass |
| 35 | Desktop / Chromebook / mobile layouts | IMPLEMENTED AND VERIFIED | Journey measures all three; no horizontal overflow; screenshots in `docs/qa/` |
| 36 | Automated public-content regression check | IMPLEMENTED AND VERIFIED | `tests/public-content.test.mjs` |
| 37 | Automated browser journey | IMPLEMENTED AND VERIFIED | `scripts/qa/journey.mjs`, 35 checks |
| 38 | Independent design review | IMPLEMENTED (self-review) | No independent review agent is exposed in this runtime; the review below is my own |

### Public content audit: what it caught

The audit scans authored interface text (`src`, comments stripped), served HTML
outside the game wrappers, and the built shell/assets. It found two genuine
leaks, both fixed:

1. `src/data/artwork.ts` carried 30 provenance URLs pointing at
   `blob/feature/platform-overhaul`. They are bundled into the client, so an
   internal branch name was shipping in the JavaScript. Rewritten to `blob/main`.
2. `src/data/raw/path-exceptions.txt` had a comment about "pre-overhaul launch
   files". Raw catalog files are imported at build time, so the comment was
   inside `dist/assets/index-*.js`. Rewritten as a neutral note.

Game titles in `src/data/raw/*.txt` are data, not authored copy, and are
deliberately excluded from the wording scan (the wrappers themselves are
third-party documents). The test therefore cannot delete legitimate game
content to satisfy itself.

### Design review against the published report

| Report requirement | Component | Evidence | Result | Correction |
|---|---|---|---|---|
| No purple/navy/neon accent | Library shell, buttons, chips | `docs/qa/library-desktop.png`; `index.css` uses slate-900/100 | Pass | Blue accent removed |
| No decorative gradients or glows | Surfaces, cards | Screenshots; only the landing page's background scrim remains (Google-style, exempt) | Pass | — |
| No interface emoji or sparkles | All copy | Content test; no emoji in `src` | Pass | — |
| No hero section or promo headline | Library | Header is 56 px with the nav directly beneath | Pass | — |
| Consistent neutral grayscale | Buttons, chips, cards, dialogs | One radius scale (4/6/8 px), one shadow level | Pass | Blue → slate |
| No redundant navigation | Header | One nav area; duplicate small nav deleted | Pass | — |
| No unnecessary descriptions | Apps grid | Removed the duplicated external-fallback paragraph (the player already offers the control) | Pass | — |
| Favorites not hover-only | Cards | Star always visible with a border | Pass | — |
| Authentic artwork not recoloured | Cards | Artwork is `object-contain`, never filtered | Pass | Loading-screen capture removed |
| Loading/empty/error states | Player, search, library | Spinner, "No results", "No games in this category" | Pass | — |
| Spacing rhythm | All | Tailwind 4 px scale only | Pass | — |
| No internal wording | All | Content audit | Pass | Two leaks fixed |

Not assessed visually: hover states on every card, focus rings in a real
keyboard-only session, and the Everythingle/Krillion frames.

### Authentication investigation

The deployed site is `https://geegle-com.vercel.app` (recorded in the repository
homepage field). Fetching it settles the reported failure:

- Its tab title is still `Geegle — Free Web Games`, its bundle still contains
  `Enter the site password` and the `overhaul-2026` footer string, and it has no
  alphabetical sections — **the deployed build predates this work**.
- Its only JavaScript chunk contains `placeholder.invalid` and no
  `*.supabase.co` host at all. Vite inlines `VITE_*` variables at build time, so
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` were **not set when that build
  was produced**. `isSupabaseConfigured` is therefore false and the client falls
  back to the placeholder project, which is why the app reports "Accounts are not
  configured on this deployment" and why both registration and login fail. The
  entry gate cannot verify either, for the same reason.

So the production cause is a **build/deployment configuration defect**, not a
Supabase project defect, and no Supabase setting can repair a bundle with no
credentials.

Required owner actions, in order:

1. Vercel → project for `geegle-com.vercel.app` → Settings → Environment
   Variables → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the
   production environment, using the production project's **anon** (public) key.
   Do not use a service-role key: everything in the client bundle is public.
2. Redeploy from `main` after this branch is merged, so the corrected interface
   ships. Until then, production keeps the old password page and old footer.
3. Check Authentication → Providers → Email → **Confirm email**. This app maps a
   username to a non-deliverable internal address, so if confirmation is on,
   `signUp` returns a user with no session and login then fails. The isolated
   project has `mailer_autoconfirm: false`, which reproduces exactly that
   symptom; production's setting could not be read because its bundle holds no
   key. With confirmation off, registration works with no code change.

Verified against a real Supabase backend (isolated project), not assumed:

- `POST /auth/v1/token?grant_type=password` returns 200 and an access token for a
  confirmed username account; a wrong password returns 400 "Invalid login
  credentials".
- In the browser: sign-in, session across reload and a new tab, logout, and
  isolation between two accounts (favorites, Recently Played and settings are per
  user; the requests appear in the journey's network log).

Production data was only read: 5 auth users, all real Gmail addresses, all
confirmed within ~300 ms of creation (admin-created), and no
`@users.geegle.internal` account — consistent with a deployed build that never
had credentials to create one.

### Animation implementation

- `motion/react` (v14): account menu (enter/exit), auth dialog, settings dialog,
  search dialog, the secondary-nav underline (`layoutId`), the Recently Played
  reveal, the game player's entrance, and the star's tap response.
- `animejs` (v4.5): the alphabetical jump animates `window.scrollTo` through a
  proxy object over 420 ms with `outCubic`; changing category or filter plays a
  5 ms-staggered opacity/translate on the first 60 cards only, never the whole
  grid.
- Reduced motion: `useReducedMotion()` disables every JS animation, and a
  `prefers-reduced-motion` block neutralises CSS transitions.

### Artwork this pass

- Capture toolchain restored in a scratch virtualenv (`pillow`, `playwright`);
  the Node-only runner had lost it.
- Asset pass added 2 official assets (71 official-asset records total). These are
  images the game wrapper declares for itself (official icon, logo, `og:image`),
  and spot checks confirm they are the real brands (2048's icon, Angry Birds
  Slingshot Frenzy's art).
- 50 games were captured through the production preview and 46 passed the
  automated checks. Visual review then rejected the result: the captures were
  mostly **splashes and loading screens** rather than title screens or main
  menus — a "Ren'Py loading…" screen, a "Made with Unity" splash, a shared
  Ruffle "PLAY" button, a shared play-button splash (byte-identical across 20
  games), a GameTop advert, a JavaScript error page, and several near-blank
  grey pages. Four duplicate groups were already detectable by content hash.
- Decision: the whole screenshot tier was **withdrawn** rather than shipped as
  inaccurate coverage. 40 files and records were deleted, plus 35 earlier
  shared or portal captures, plus the Ren'Py loading record. Only official
  assets and licensed images remain: 74 records.
- `scripts/artwork/capture.py` was hardened so a future batch is less noisy: it
  now waits 6 s, dismisses a splash with two clicks, rejects a digest already
  recorded for another game, and rejects near-monochrome captures (< 64
  colours). It still needs per-batch visual review before records are kept.
- Resumable command (repeat, committing each reviewed batch):
  `GEEGLE_BASE=http://127.0.0.1:4173 /tmp/venv-art/bin/python scripts/artwork/capture.py --screens --limit 50`

### Outstanding work and blockers

| Item | Status | Needed |
|---|---|---|
| Artwork for the remaining ~2,490 games | IN PROGRESS | Repeated capture batches; each batch committed |
| Production registration | EXTERNALLY BLOCKED | Owner sets `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` on Vercel, redeploys, and confirms email confirmation is off (exact steps above) |
| Production migrations `0002`, `0003` (and `0004` for parity) | EXTERNALLY BLOCKED | Owner approval; SQL is the repository's migration files, unchanged |
| Password change in the UI | IMPLEMENTED BUT UNVERIFIED | Run after registration is unblocked |
| Everythingle / Krillion framing and retry | IMPLEMENTED BUT UNVERIFIED | Browser pass |
| Missing games (Smashy Road, Wanted 2, HOBO, Henry Stickmin) | NOT STARTED | An authorized build; none was obtained |
| 5 missing launch paths, 248 unreferenced wrappers | NOT STARTED | Owner decision; entries were preserved rather than guessed |

---

## 2026-11-26 — corrective branch `feature/geegle-regression-fixes`

Base `e780686` (latest `main`). Full, evidence-backed status for every contract
row is in [`docs/ACCEPTANCE_EVIDENCE.md`](docs/ACCEPTANCE_EVIDENCE.md); this
section supersedes the artwork count, the production host and the auth cause
recorded above.

### What changed in this pass

- Library search is back inside the library: ranked suggestions, Enter always
  commits the query and filters the grid (a hovered suggestion is never
  launched), Escape closes, empty Enter resets. The separate search overlay and
  the header search button were removed.
- The exact library loading notice is restored (`Please wait if you see nothing
  upon clicking on a Game/Proxy.`, `Don't remind me again`, `Got it`), shown on
  every entry unless permanently suppressed, with a reset in Settings.
- The proxy safety notice is restored on every launch with `Got it`/`Cancel`,
  and no destination opens before confirmation.
- Player chrome is compact again: games get one top-right cluster (back,
  favorites, save controls, open in new window, fullscreen); apps and proxies
  get back bottom-left with fullscreen/open top-right; the reload button is
  gone; no full-width toolbar.
- Settings works signed out and restores solid neutral appearance (mode,
  background, card colour, preview, Apply, Reset), the Recently Played toggle
  and the notice reset. Image and animated backgrounds are no longer offered.
- Every authored colour is true neutral (R=G=B), including Tailwind's default
  border colour; the favicon is a circular G on a pale ground; the landing
  footer and header follow the reference composition without Google links.
- Proxy cards show only provider, `Server 1…N` and Open. Achroma Server 6
  returned 404 and is disabled with a visible reason.
- 90 catalog entries removed by the earlier dedupe pass are restored under their
  original IDs (including the two missing Snow Rider variants); catalog is 2711
  unique IDs.
- Auth: duplicate/dead auth module removed; the live service now distinguishes
  rate limiting and the email-confirmation failure instead of a generic message,
  and logs only status/code in development.
- Everythingle and YouTube no longer use full-width bars; both use the same
  compact floating controls as games. The library notice is shown once per
  visit, so signing in no longer reopens a notice the visitor dismissed.

### Verified in this pass

`npm run typecheck` 0 · `npm run lint` 0 · `bun test tests` 71 pass ·
`npm run build` exit 0 · `node scripts/qa/interface-check.mjs` 54/54 ·
`node scripts/qa/auth-check.mjs` 14/14 against the isolated backend ·
`node --env-file=.env.local scripts/qa/check-session-sync.mjs` 5/5 ·
`node --env-file=.env.local scripts/qa/check-password-change.mjs` 6/6 ·
`node scripts/qa/check-proxies.mjs` 61 endpoints recorded ·
`node scripts/qa/check-services.mjs` 9/9 ·
`node --env-file=.env.local scripts/qa/check-cloud-save.mjs` 6/6 ·
`GEEGLE_EXPECT_PRODUCTION=1 node scripts/qa/check-production-env.mjs` fails on the
isolated build as designed.

### Corrected facts

- Production is **Render** `https://bartisawesome.onrender.com`, not Vercel.
  Its deployed bundle hardcodes the isolated project
  `wkdlsaydqyymynoipmhl.supabase.co` and a publishable key for it, and that
  project requires email confirmation while Geegle collects no email. That is
  the verified reason account creation cannot complete there. Existing
  production users live in `oizdbkxnzwatytxcrvoo`, which the build never talks
  to. Owner action: set the intended `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
  on Render, redeploy, and disable "Confirm email" for this username-only flow.
- Artwork is **73 records for 2711 IDs (2.7%)**: 3 licensed and 70 captured.
  A scan of every local build found no usable bundled icons at all (696 declared
  files absent, 132 remote/inline), which is why the visible grid still shows
  placeholders. Full coverage remains blocked on per-title research or reviewed
  title-screen capture; no placeholder or loading screen is counted as artwork.

### Still open

Artwork for the remaining catalog; full proxy identity review; mirror
classification of the 248 unreferenced wrappers; save verification for engines
other than 2048; game-frame origin isolation; Smashy Road and Wanted 2 (no
authorized build); production migrations awaiting approval.

## Final release cycle (feature/geegle-final-release-fixes)

- **Production sign-in root cause re-confirmed after PR #4 merged.** Render now
  serves `index-CC8Bq6la.js`, still compiled with
  `https://wkdlsaydqyymynoipmhl.supabase.co` (isolated). Live sanitized
  checks: `/auth/v1/settings` 200 with `mailer_autoconfirm: false`; password
  grant 400 `invalid_credentials`. Owner steps are in
  `docs/PRODUCTION_AUTH_HANDOFF.md`; `npm run check:prod-build` now fails a
  production build that points at the isolated project.
- **Search moved into the sticky top header** (wordmark + Settings left,
  search centre, avatar right, Games/Apps/Proxies row, categories below), with
  suggestions anchored under the field and Enter always filtering.
- **Canonical root navigation**: no `#games` fragment; history state carries the
  view; Back/Forward return landing/library at `/`; old `#games` links rewrite.
- **Library brand is text-only**; the circular G badge beside the wordmark is
  gone. Independent circular favicon remains.
- **Player controls**: games show the exit arrow alone at top left and the rest
  at top right; YouTube's viewer is centered at 16:9 with an external fallback.
- **Settings is tabbed** (Theme / Preferences / Tab appearance) with an optional
  user-owned tab title/icon, validated and synced per account.
- **Landing avatar** now opens the account form (the dialog is rendered on both
  surfaces), and Escape closes it.
- Cards lift 1–2 px with a soft neutral shadow over 150 ms.

Verified in this cycle: typecheck 0, lint 0, build 0, interface 54/54, auth
14/14, session/sync 5/5, services 9/9, cloud save 6/6, password change passing,
production guard failing on the isolated build by design.

Still open: artwork (73 verified records of 2711), proxy identity review, mirror
classification, per-engine save verification beyond 2048, real frame origin
isolation, Smashy Road / Wanted 2 builds, production rollout approval.

## 2026-11-26 — account system cycle (`feature/geegle-auth-cloud-completion`)

### Corrected diagnosis

The previous cycle concluded that production authentication failed because Render
compiled the isolated project into the bundle. The owner changed the environment
variables and Render rebuilt: the live bundle
`/assets/index-BkXO0FIe.js` now contains only
`https://oizdbkxnzwatytxcrvoo.supabase.co`, and that project accepts the key. That
part is fixed. The remaining failure is in the database:

```
POST /auth/v1/signup → 500
{"code":"23503","message":"insert or update on table \"geegle_profiles\" violates
 foreign key constraint \"geegle_profiles_id_fkey\"",
 "detail":"Key (id)=(…) is not present in table \"users\"."}
```

Reproduced exactly on a real GoTrue + Postgres stack by making
`geegle_on_auth_user_created` a `BEFORE INSERT` trigger: the profile row is
inserted before the `auth.users` row exists. With the correct `AFTER` trigger the
same stack still fails (HTTP 500 `Error sending confirmation email`), because both
hosted projects run `mailer_autoconfirm = false` and a synthetic
`@users.geegle.internal` address has no mailbox. So registration had two defects,
not one, and no earlier "authentication passes" run used the confirmation-required
condition: local development ran with `GOTRUE_MAILER_AUTOCONFIRM=true`, and hosted
checks only ever signed in to accounts that already existed.

### What changed

- `supabase/migrations/0005_geegle_signup_confirmation.sql`: repairs the FK and
  the `AFTER INSERT` provisioning trigger, adds a case-insensitive unique index,
  confirms **only** `@users.geegle.internal` addresses at creation time so GoTrue
  skips the mailer and issues a session, and backfills existing Geegle accounts.
  The shared project's confirmation setting is untouched.
- `src/services/auth.ts`: duplicate usernames (422, sanitized 200, or a 23505
  race) all report "That username is already taken."; 5xx reports a service
  problem instead of the generic fallback; the typed capitalisation is kept for
  display; registration falls back to a password sign-in when a project returns a
  user without a session.
- `src/App.tsx`: one in-flight submit guard, so Enter plus click cannot send two
  requests.
- `src/components/Settings.tsx`: password change now reauthenticates with the
  current password before `updateUser`.
- `scripts/qa/check-production-env.mjs` + `Procfile`: the release gate now runs on
  every Render deploy, inspects the built artifact, checks the key belongs to the
  project, rejects placeholders and any privileged key. Verified isolated → exit 1,
  correct build → exit 0, mismatched key → exit 1.
- `scripts/qa/check-account-completion.mjs`: new acceptance run against a real
  backend with the production confirmation setting.
- Docs: `docs/PRODUCTION_AUTH_HANDOFF.md` (rewritten),
  `docs/ACCOUNT_ACCEPTANCE_EVIDENCE.md`, `docs/CLOUD_SAVE_VERIFICATION.md`.

### Verified in this cycle (fresh output)

| Check | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `bun test tests` | 71 pass, 0 fail |
| `npm run build` | exit 0 |
| `interface-check.mjs` | 54/54 |
| `check-account-completion.mjs` | 21/21 |
| `auth-check.mjs` | 14/14 |
| `check-session-sync.mjs` | 5/5 |
| `check-password-change.mjs` | 6/6 |
| `check-cloud-save.mjs` | 6/6 |
| production gate, isolated build | exit 1 by design |
| production gate, correct production build | exit 0 |
| production gate, production URL + isolated key | exit 1 (`auth settings returned 401`) |

### Blocked

- Live-site registration and login: needs the owner to apply migration `0005`
  (see `docs/PRODUCTION_AUTH_HANDOFF.md` §4.1). Production account acceptance is
  BLOCKED, not done.
- Cloud-save conflict detection in production: migration `0002` is missing
  (`select=revision` → `42703`).
- Game-frame origin isolation: needs separate-origin hosting.
- Per-engine save verification: only `cl2048` remains verified end to end.

## 2026-11-26 — production account repair applied and verified (`fix/production-account-repair`)

PR #6 merged as `32dab61`. The deployed client was already correct; the database
had never been migrated. Using the connected Supabase integration, the production
project `oizdbkxnzwatytxcrvoo` was inspected, repaired and verified directly.

### Applied to production

| Version | Migration | Effect |
| --- | --- | --- |
| 20261126180218 | `geegle_0005_signup_confirmation_hardened` | FK to `auth.users`, provisioning trigger recreated `AFTER INSERT`, namespace-scoped confirmation (`%@users.geegle.internal`), case-insensitive unique index, backfill |
| 20261126180229 | `geegle_0002_game_save_revision` | `revision` column + rotation trigger |
| 20261126180239 | `geegle_0006_least_privilege_grants` | removed `anon` access to Geegle tables, revoked the retired entry-gate RPC, explicit `authenticated` grants |

Both repo migrations now carry preflight checks and post-migration validation that
abort the migration rather than warn. During the local dry run the new validation
caught a real hole: revoking EXECUTE from `anon` alone left the `PUBLIC` grant in
place, so the entry-gate RPC was still callable. Fixed by revoking from `public`
as well.

### Production verification (fresh output)

| Check | Result |
| --- | --- |
| `production-acceptance.mjs` (live site, real form) | 22/22 |
| `production-data-integrity.mjs` (live project, real sessions) | 17/17 |
| Live `POST /auth/v1/signup` | 200 with session (was 500/23503) |
| Live duplicate sign-up | 200 sanitized user, no session → client reports "already taken" |
| Live bundle | `index-C72ESc1B.js`, intended project only, no privileged key |
| `npm run typecheck` / `lint` / `build` | 0 / 0 / 0 |
| `bun test tests` | 71 pass, 0 fail |

### Shared-project safety verified

The other application's `sync_owner_admin_user_on_auth_users` trigger is intact,
its RLS policies are untouched, and `is_admin()` needs an `admin_users` row plus an
owner-admin email, so a Geegle account cannot reach its data. Only the Geegle
namespace is auto-confirmed; the project-wide confirmation setting is unchanged.

### Still open

- Game-frame origin isolation (needs separate-origin hosting).
- Per-engine cloud-save evidence beyond the `cl2048` capture path; automated input
  did not produce game-written state for 2048, Bloxorz or Slope.
- Manual save/restore/import/export and failed-upload recovery are implemented but
  not scripted.
- Optional cleanup: drop the retired entry-gate objects and enable PITR.

## 2026-11-26 — account verification, cloud saving and final interface corrections

Branch `feature/geegle-account-cloud-final`, cut from `7fe74b0` (PR #7 merged).
Authentication and the production database are untouched; every change is a
corrective one with a failing test first.

### Changes

| Change | File | Why |
| --- | --- | --- |
| Account dropdown reduced to one action, `Sign out` | `src/App.tsx` | the dropdown carried a redundant Settings entry and a repeated username |
| Wordmark 16px → 22px in a self-hosted licensed geometric typeface | `src/index.css`, `public/fonts/poppins-500.woff2` (+ `POPPINS-OFL.txt`), `src/App.tsx` | the mark read as small and generic; the header height is unchanged (194px at both sizes) |
| `geegleSaveKey` defined by the storage shim | `public/games/geegle-storage-shim.js` | three wrappers called it and it existed nowhere, so their save calls threw and their progress was never stored |
| `cl2048` removed from `VERIFIED_GAMES` | `src/lib/saveManifest.ts` | its build keeps no progress at all; the earlier "verified gameplay restore" was a key the test itself wrote |
| Account-dropdown, wordmark and shim regression tests | `tests/account-menu.test.mjs`, `tests/storage-shim.test.mjs`, `tests/save-manifest.test.mjs` | keep the corrections from silently reverting |
| First-party-only failed-request assertion; header height compared at both wordmark sizes | `scripts/qa/interface-check.mjs` | the old assertion counted a third-party beacon fired inside a game frame as our failure, and had no header-height baseline |
| Token refresh + concurrent duplicate registration checks; probe labels corrected; menu checks staged behind `GEEGLE_EXPECT_NEW_MENU=1` | `scripts/qa/production-acceptance.mjs` | the deployed bundle predates the menu change, and the save probe must not be called gameplay |
| New genuine-play cloud-save run | `scripts/qa/production-cloud-saves.mjs` | manual save/restore/import/export, invalid and foreign imports, offline failure, reconnect sync, and per-game evidence |

### Evidence (fresh, this cycle)

| Check | Result |
| --- | --- |
| `production-acceptance.mjs` (production) | 24/24 |
| `production-data-integrity.mjs` (production) | 17/17 |
| `production-cloud-saves.mjs` (production) | 22/22 passed, 3 skipped with recorded evidence |
| `auth-check` / `check-session-sync` / `check-password-change` / `check-account-completion` / `check-cloud-save` (local backend) | 14/14 · 5/5 · 6/6 · 21/21 · 6/6 |
| `interface-check.mjs` (built artifact) | passing, including wordmark size/height and first-party requests |
| `npm run typecheck` / `lint` / `build` | 0 / 0 / 0 |
| `bun test tests` | 83 pass, 0 fail |
| production build + `check:prod-build` | PASS — `oizdbkxnzwatytxcrvoo`, key accepted, no privileged key |

### Findings recorded instead of claimed

- `cl2048`, `clspacebarclicker`, `clquantumclicker` and `clohflip` produced real
  on-screen progress but wrote no progress of their own, so no game is marked
  individually verified. `clspacebarclicker` additionally throws during init
  (`init is not defined`) and never clears its `reloading` flag on a fresh
  profile, so its save routine cannot run at all.
- IndexedDB, Unity, Ruffle and Emscripten saves remain engine-compatible only.
- The account dropdown and wordmark changes are verified on the built artifact,
  not on production: the deployed bundle predates this branch.

### Still open

Per-engine play scripts that reach a real save point; the `clspacebarclicker`
init crash (game content); genuine game-frame origin isolation (needs
separate-origin hosting); production rollout of this branch.

---

## Account notifications and changelog

Cycle: 2026-11-26, branch `fix/geegle-changelog-notifications` from `fdf2ab3`
(the PR #8 merge). Statuses: NOT STARTED, IN PROGRESS, IMPLEMENTED BUT
UNVERIFIED, VERIFIED (environment stated), BLOCKED.

| Requirement | Status | Evidence |
| --- | --- | --- |
| Persistent bottom-right cloud-save status overlay removed (container and text) | VERIFIED (built artifact) | `src/components/GamePlayer.tsx` no longer renders `StatusPill` or its `bottom-3 right-3` container; `cloud-save-status.test.mjs` and `interface-check.mjs` ("the player shows no persistent cloud-save status box") |
| Automatic saving still works in the background | VERIFIED (local backend) | `check-cloud-save.mjs` 6/6: changed progress captured on the 15 s tick, row value matches, fresh browser restores it, another account does not receive it |
| Manual save/restore/export/import feedback kept | VERIFIED (source + local backend) | `Progress saved to cloud.`, `Cloud save restored.`, `Save file downloaded.`, `Save file imported and synced to the cloud.` unchanged; `password`-independent tests in `cloud-save-status.test.mjs` |
| Actionable sync failure still surfaced | VERIFIED (source) | conflict → "Cloud progress differs. Choose Restore from Cloud or Keep This Device."; error → "Cloud sync failed. Your device still has its saved progress." |
| Settings sidebar with Changelog as the last tab | VERIFIED (built artifact) | `interface-check.mjs`: tabs `Theme | Preferences | Tab appearance | Changelog`, geometry check that the sidebar is left of the content and the list runs downward; `docs/qa/changelog-settings.png` |
| Changelog entries: real merge date, time and concise description, newest first | VERIFIED (built artifact + GitHub API) | 8 merged PRs (1–8); newest `November 26, 2026 · 2:56 PM EST`; `docs/qa/changelog-settings.png` |
| Eastern Time with daylight-saving adjustment | VERIFIED (unit) | `formatEastern` tests: EST in November, EDT in July, and the 2026-03-08 switch (`1:59 AM EST` → `3:01 AM EDT`) |
| Duplicate entries prevented | VERIFIED (unit + browser) | entries keyed by PR number; `no release appears twice` in the browser |
| Future merged PRs produce entries; unmerged PRs never appear | IMPLEMENTED BUT UNVERIFIED end-to-end | `scripts/generate-changelog.mjs` runs on every `npm run build` (the Render build command) and is covered by `changelog.test.mjs`; the first post-merge deploy is the end-to-end proof |
| Password visibility toggle on every password field | VERIFIED (built artifact, unit) | `interface-check.mjs`: hidden by default, eye reveals, relabelled Hide password, no submit, hides again; `tests/password-visibility.test.mjs` |
| Account reminder for signed-out launches | VERIFIED (local backend, 21/21) | `scripts/qa/check-account-reminder.mjs`: exact title/message/buttons, destination kept, account creation and sign-in both open the chosen game, closing the form launches nothing, Continue as guest opens it, later launches are not interrupted, signed-in launches never see it |
| Reminder appears at most once per guest session | VERIFIED (local backend) | session-scoped dismissal in `src/lib/accountReminder.ts`, `tests/account-reminder.test.mjs` |
| Account forms carry one short secondary sentence | VERIFIED (built artifact) | `Keep your progress and preferences across devices.` in the sign-in and create-account form only |
| Account dropdown still holds exactly one action (`Sign out`), Settings stays in the header | VERIFIED (built artifact) | `account-menu.test.mjs` (8/8) and `interface-check.mjs` |

### Test summary for this cycle

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 (changelog regenerated: 8 releases) |
| production build + `check:prod-build` | PASS — `oizdbkxnzwatytxcrvoo`, key accepted, no privileged key |
| `bun test tests` | 110 pass, 0 fail |
| `interface-check.mjs` (built artifact) | 78/78 pass |
| `capture-release-ui.mjs` (built artifact) | 8/8 pass; screenshots in `docs/qa/` |
| `check-account-reminder.mjs` (local backend) | 21/21 pass |
| `auth-check` / `check-session-sync` / `check-password-change` / `check-account-completion` / `check-cloud-save` (local backend) | 14/14 · 5/5 · 6/6 · 27/27 · 6/6 |

### Findings recorded instead of claimed

- Production still serves the PR #8 bundle; none of this cycle's UI is on
  `https://bartisawesome.onrender.com` until this branch merges and deploys.
  Every browser result above is from the built artifact or the isolated QA
  backend, and is labelled that way.
- `scripts/qa/journey.mjs` fails before any launch on `fdf2ab3` as well: it
  clicks the letter rail while the library notice overlay is open. The only
  change to that script here is handling the new reminder; it is a stale script
  from before the notice overhaul, not a regression from this branch.
- A future merged pull request cannot be demonstrated in this branch; the
  generator's merge rules are unit-tested and the build step runs on deploy.

### Still open

- Confirm the changelog, reminder and password toggles on production after the
  Render deploy that follows the merge.
- Per-engine play scripts that reach a real save point (unchanged from the
  previous cycle).

## Catalog restoration and guest reminder preference (2026-11-26)

Branch `feature/geegle-catalog-restoration`, based on merged PR #9
(`44494cd`). This cycle restored the historical catalog audit, fixed the
restoration script, removed the unwanted Poly Track entry, repaired the
missing-series wrappers, and added the reminder's permanent dismissal.

### Delivered

- `scripts/restore-catalog.mjs` is idempotent: `restored.txt` is output only,
  previous rows are carried forward, deleted builds are recovered from Git
  history where a commit ever held them, and the Poly Track IDs are excluded
  before restoration. `tests/catalog-restoration.test.mjs` runs it twice.
- Historical audit: 2,697 entries at `2d09055`; no legitimate game entry is
  missing. The 16 rows outside the catalog are apps, proxies, themes and the
  removed chatbot. Full accounting in `docs/CATALOG_RESTORATION_REPORT.md`.
- Poly Track (`clpolytrackbutnotflagged-1`) removed from rows, path
  exceptions, generated overrides and runtime filtering; only
  `clpolytrackworksnow` ("Polytrack (working)") can appear. Saved data is
  untouched.
- All seven HOBO IDs carry their real subtitles. All five original Henry
  Stickmin installments are present. Smashy Road remains blocked: no
  authorized browser build exists (see `docs/MISSING_GAMES_VERIFICATION.md`).
- Eight wrappers that loaded a literal `$1` instead of their SWF now load the
  real file; Escaping the Prison starts muted instead of waiting on a stuck
  splash. Per-title browser evidence is recorded in
  `docs/MISSING_GAMES_VERIFICATION.md`.
- Snow Rider's four required entries use distinct local builds and stable IDs,
  including the two that previously redirected to `gamebiz.com`.
- Guest reminder: unchecked Continue as guest stays session-only; the new
  unchecked-by-default "Don't remind me again" checkbox stores a permanent
  `localStorage` preference; Settings → Preferences has Reset account
  reminder. Wording and the three existing actions are unchanged. Behavior is
  documented in `docs/ACCOUNT_REMINDER.md`.
- `scripts/qa/journey.mjs` was unblocked from the library-notice overlay and
  updated for the current search field, Settings tabs, Back control and root
  URL. It now completes 36/36 checks.

### Evidence

| Check | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 |
| `bun test tests` | 120 pass, 0 fail |
| `scripts/qa/check-catalog-games.mjs` | 16 PASS, 1 FAIL (Goody Gumdrops wrapper is a redirect, no build) |
| `scripts/qa/check-guest-reminder-preference.mjs` | 14/14 pass |
| `scripts/qa/interface-check.mjs` | pass (changelog date updated to PR #9) |
| `scripts/qa/journey.mjs` | 36/36, no console or request problems |

### Still blocked / not claimed

- Smashy Road, Smashy Road: Wanted and Smashy Road: Wanted 2 have no
  authorized browser build.
- Snow Rider Goody Gumdrops has no functional build in the repository; the
  existing row is preserved but its wrapper is a Cookie Love redirect.
- Hobo vs Zombies remains an external iframe and is deferred to the
  catalog-wide wrapper audit.
- Five historical rows point at files that were never committed.
- Production was not redeployed in this cycle; every browser result is from
  the local built artifact.

## Comprehensive artwork pass (2026-11-26, branch `feature/geegle-comprehensive-artwork`)

Artwork only. No catalog ID, launch path, save key, layout, navigation or
authentication behavior was changed. One coherent branch and pull request.

### What was done

- Audited the pre-existing set instead of trusting it. 35 of the 73 records were
  rejected before any coverage was claimed: repeated portal logos assigned to
  unrelated titles (11 and 10 identical files), a watermarked generic banner,
  blank or near-uniform crops, loading screens and mismatched images. Their
  records were pruned from the runtime index and their files deleted, so no
  rejected image stays on display.
- Added a resumable acquisition pipeline that follows the required order:
  wrapper-declared official icon/social image, wrapper game asset, then a
  captured title screen or recognizable gameplay frame from the actual build
  this repository serves. Blank, uniform, duplicated, low-information,
  loading/error and generic play-splash frames are rejected automatically, and
  every accepted frame was also inspected on a generated contact sheet.
- 271 catalog entries now have verified artwork (233 captured screens plus 38
  pre-existing wrapper-declared/licensed records), 10.0% of the 2,710 displayed
  entries. Each record stores its source, identity evidence, reuse basis,
  dimensions, SHA-256 and review result in `scripts/artwork/progress.json`.
- New tooling: `capture-screens.mjs` (Playwright, resumable, browser restart),
  `process-shots.py` (validation, crop-to-game-area, WebP, no upscaling),
  `audit-artwork.py` (decode/hash/uniformity/duplicate checks),
  `review.json` (durable decisions), `prune-rejected.py`,
  `build-progress.py`, `contact-sheet.py`, `report.py`.
- `tests/artwork-integrity.test.mjs` guards that every displayed record exists,
  decodes, matches its hash, carries evidence, has no unrelated-title duplicate
  and never re-displays a rejected file.
- `docs/ARTWORK_COMPLETION_REPORT.md` is generated from the manifests, so its
  counts cannot exceed the evidence.

### Evidence (this session)

| Check | Result |
| --- | --- |
| `python3 scripts/artwork/audit-artwork.py` | 271 records, 271 ok, 0 broken, 0 duplicate groups |
| `node scripts/map-artwork.mjs --check` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 |
| `bun test tests` | 124 pass, 0 fail |
| Library at desktop and 390x844 mobile | artwork renders in cards, lazy loading active (below-fold images not requested), 0 failed, no horizontal overflow |
| Search filter (`snow`) | Snow Rider first, cards keep their artwork |

### Blocked / not claimed

- The seven service screenshots named in the assignment (Helios, Arctic,
  Cherri, Achroma, Xylora, Bull-33, and the unidentified dark-blue service) are
  not present in the workspace or the conversation attachments, so no service
  card artwork was assigned and no proxy card was changed. Supplying the PNGs
  completes that item.
- 2,439 entries remain unprocessed; the exact next batch and resume commands are
  in `docs/ARTWORK_COMPLETION_REPORT.md`. Capture was stopped at a clean
  checkpoint, not because the remaining work was judged complete.
- Favorites and Recently Played were not exercised with a signed-in account in
  this pass; they render through the same `GameArt` component as the library.
- Coverage is not universal and is not claimed to be.

## Artwork completion, phase 2 — internet research first

Resumed after PR #11 merged, on `feature/geegle-artwork-completion`. The
acquisition order is now enforced in code rather than described in a comment:
`scripts/artwork/research-assets.mjs` visits every remaining title's live
distribution pages and their build paths, probes conventional published assets
(`logo.png`, `icon*.png`, `cover.png`, `og.png`, …) and records, per catalog ID,
which methods were attempted and which URLs answered. Only titles with no
obtainable published image fall through to `capture-screens.mjs`, and every
record now carries `methodsInvestigated`.

| Check | Result |
| --- | --- |
| `python3 scripts/artwork/build-progress.py` | 2,710 entries, 452 verified, 16.7% |
| `python3 scripts/artwork/audit-artwork.py` | 0 broken, 0 exact-duplicate groups |
| `node scripts/map-artwork.mjs --check` | exit 0 |
| `npm run typecheck` / `npm run lint` / `npm run build` | exit 0 |
| `bun test tests` | see run below |

Research covered all 2,435 remaining entries; 258 had a published icon, logo or
game asset, and 98 of those survived visual review after rejecting portal logos
(Two Player Games, Unblocked Games G+, Kiz10, Agame, SAWGAMES, Newgrounds),
store badges, publisher splashes, watermarked sketches and shared engine
splashes. Captures added a further 83 verified title screens and gameplay frames
after the play/content-warning gates were passed.

### Not claimed

- 2,175 entries remain unprocessed and 83 captured frames await review. Capture
  was stopped by the execution budget of the session, not because the queue was
  empty; the exact remaining list and resume commands are in
  `docs/ARTWORK_COMPLETION_REPORT.md`.
- The seven service screenshots are still absent from the workspace, so no
  service card artwork was invented or reassigned.

## Artwork completion, phase 3 — reopening the blocked entries

The owner rejected the previous "blocked" result, so the whole 1,676-entry
blocked manifest was reopened rather than treated as finished. Its old rule and
reason are preserved per entry in `scripts/artwork/reopened.json`, `blocked.json`
is empty, and the capture-based `rejected` decisions that made the pipeline skip
those ids were cleared (571 of them, also preserved as evidence).

The reopen is justified by measurement, not assumption: `cl10bullets` had been
labelled `blank-render`, yet after a full ten-minute observation the Ruffle build
finished and showed its own title screen. Ten entries have now been through the
protocol in `scripts/artwork/investigate-render.mjs` — five rendered, two stopped
at their own start gate, three stayed blank — which alone contradicts the old
blanket label.

| Measurement | Value |
| --- | --- |
| Catalog rows (unique IDs) | 2,710 |
| Verified artwork | 1,038 (38.3%) |
| Reopened blocked entries | 1,676 |
| Ten-minute investigations completed | 10 |
| New verified artwork from this pass | 2 (`cl10bullets`, `cl10morebullets`) |
| Games removed as nonfunctional | 0 |
| Service cards with owner-supplied artwork | 5 |

### Service catalog corrections

Helios, Arctic, Cherry, Achroma and Bull-33 now show the owner's own screenshots
(`public/artwork/services/*.webp`, rendered by `src/components/ProxyCard.tsx` from
`src/data/serviceArtwork.ts`). Astra Proxy is removed from the catalog, its search
results and its navigation; its Bull-33 endpoints moved to a real Bull-33 card
instead of being relabelled. `xylora.webp` and `unidentified-dark-blue.webp` are
kept but deliberately unassigned: there is no Xylora endpoint in the repository,
and the dark-blue screenshot carries no branding, so assigning either would be a
guess. Krillion and Krillion (Backup) keep their separate, distinct artwork.

### Not claimed

- 1,672 catalog entries were still unprocessed at that point. The ten-minute
  observation then in force could not finish in one session, and the owner has
  since cancelled it (see phase 4 and phase 5); the queue and evidence remain in
  `scripts/artwork/reopened.json`, `scripts/artwork/render-investigation.json`
  and `docs/ARTWORK_COMPLETION_REPORT.md`.
- No game was removed. The removal protocol requires a completed observation, a
  clean retry and no obtainable artwork; nothing has met all seven conditions
  yet, so `docs/NONFUNCTIONAL_GAME_REMOVALS.md` records zero removals instead of
  converting old labels into deletions.
- Coverage is 38.3%, not complete. "All entries classified" is explicitly not
  accepted as completion.

## Phase 4 — short-window artwork pass and service corrections

The owner cancelled the ten-minute observation requirement, so artwork capture
now uses a 12–15 second window (`scripts/artwork/investigate-render.mjs`, default
`--seconds 12`, plus a per-entry watchdog and automatic browser restart). The old
harness was stopped; its results stay in
`scripts/artwork/render-investigation.json`.

| Measurement | Value |
| --- | --- |
| Catalog rows (unique IDs) | 2,710 |
| Verified artwork | 1,095 (40.4%) |
| Entries investigated in this pass | 590 |
| Entries still unprocessed | 1,615 |
| Games removed as nonfunctional | 0 |
| Service cards with owner-supplied artwork | 7 of 7 |
| Applications with verified artwork | 6 of 7 |

### Service corrections

- **Soluos:** the previously unidentified dark-blue screenshot is now
  `public/artwork/services/soluos.webp` and is shown on the `soluos` card.
- **Xylora:** the repository already ships a supported wrapper
  (`public/games/xylora.html`), so a Xylora card was added with that wrapper as
  its only endpoint and the owner's screenshot attached.
- Helios, Arctic, Cherry, Achroma and Bull-33 keep their existing artwork. Astra
  stays removed. All seven cards were checked in Chromium against the running
  dev server: correct image-to-title pairing, all images decoded, no Astra.

### Application artwork

The Apps grid is audited separately from the games catalog. Official Krillion is
now present in the Apps grid through its supported embed, with the official
`krillion.cc` image, while Krillion (Backup) keeps the distinct
`krillionunlimited.org` image. Everythingle, YouTube, Suggestions and Code Editor
have verified artwork; Soundboard's only captured frame was an empty toolbar, so
it still shows the neutral placeholder.

### Not claimed

- 1,615 entries remain unprocessed. Their queue is preserved in
  `scripts/artwork/reopened.json` minus the ids in
  `scripts/artwork/render-investigation.json`.
- No game was removed. Of the 32 blank or start-gated observations, every one
  traced to a browser-blocked loader, a CDN 403/404, a reset connection or an
  unfinished download, so the failure is not attributable to the game.
- Coverage is 40.4%, not complete.


## Phase 5 — internet image search replaces mass local rendering

The owner stopped mass local rendering because running hundreds of HTML games
overheated the machine, and replaced the acquisition rule: search the internet
for each title first, render only as a last resort, one game at a time.

Search is now the primary method (`scripts/artwork/search-images.mjs`): for each
unprocessed id it queries Bing Images with the exact catalog title plus "game",
downloads the first usable results and records the query, the result rank, the
source page and the saved file. No game, browser engine or WebGL context is
started for this step, so a 100-title batch costs no rendering work at all.
`scripts/artwork/review-sheet.py` renders labelled contact sheets of the first
three results per title, `apply-search-art.py` writes the chosen image as a
640x360 WebP (wide images centre-cropped, tall box art shown whole over a blurred
copy of itself) and records `collectionMethod: internet-image-search` with the
review note that justified the choice.

| Measurement | Value |
| --- | --- |
| Catalog rows (unique IDs) | 2,710 |
| Titles searched in this phase | 400 |
| Verified artwork | 1,459 (53.8%) |
| Artwork obtained through internet search | 364 |
| Artwork obtained through local screenshots in this phase | 0 |
| Titles rejected after review (no identifiable, unwatermarked image) | 12 |
| Games removed as nonfunctional | 0 |
| Remaining titles without artwork | 1,251 |

Rejected searches are recorded with their exact reason in
`scripts/artwork/review.json` — for example results that were a different game
(Bloons TD Battles 2 for Bloons TD 2), a board game, portal watermarks
(plimpl.com, silvergames.com, minigamesville.com), or gameplay video thumbnails
with captions burned over the art. Nothing was accepted because a file merely
existed: every record names the search query, the result rank, the source page
and the note written after looking at the contact sheet.

The seven owner service screenshots (Helios, Arctic, Cherry, Achroma, Bull-33,
Soluos, Xylora) are unchanged, Astra remains removed, and Krillion and Krillion
(Backup) keep separate official artwork in both Games and Apps.

### Verification in this phase

| Check | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 |
| `bun test tests` | 124 pass, 0 fail |
| `node scripts/map-artwork.mjs --check` | exit 0 |
| `python3 scripts/artwork/audit-artwork.py` | 0 broken |

### Not claimed

- 1,251 titles still have no artwork. The queue is not exhausted; the next batch
  continues from the first `not-started` row in `scripts/artwork/progress.json`.
- The 12 rejected titles are not counted as complete. They stay visible as
  "no artwork" in the manifest, with the reason recorded.
- No game was removed: none met all seven removal conditions.
