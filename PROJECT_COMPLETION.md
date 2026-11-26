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

### 6. Artwork
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
| 24 | Username/password registration | EXTERNALLY BLOCKED | See the authentication section: production needs "Confirm email" off; verified users can log in |
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

Verified facts, not assumptions:

- Isolated project `wkdlsaydqyymynoipmhl`: `GET /auth/v1/settings` returns
  `mailer_autoconfirm: false`, `disable_signup: false`, email provider enabled.
  With confirmation required, `supabase.auth.signUp` returns a user but **no
  session**, and `src/services/auth.ts` then reports "Registration did not
  create a session." The subsequent login fails with "Invalid login
  credentials" because the account is unconfirmed. That is exactly the reported
  symptom, produced by configuration, not by the form.
- Production `oizdbkxnzwatytxcrvoo` (read-only SQL): 5 auth users, all real
  Gmail addresses, every `email_confirmed_at` within ~300 ms of `created_at`
  (admin/dashboard-created, not email-confirmed by a person), and **no**
  `@users.geegle.internal` account at all. Username registration through this
  app has therefore never produced an account in production.
- The public `/auth/v1/settings` endpoint for production needs an API key I do
  not hold, and the deployed site URL is not recorded in the repository, so I
  could not read production's `mailer_autoconfirm` directly or open the
  deployed build. I did not write a test user into production.

What is proven working, end to end against a real Supabase backend:

- `POST /auth/v1/token?grant_type=password` returns 200 and an access token for
  a confirmed username account; a wrong password returns 400 "Invalid login
  credentials".
- In the browser: sign-in, session across reload and a new tab, logout, and
  isolation between two accounts (favorites, Recently Played and settings are
  per user; the requests are visible in the journey's network log).

Required production change (needs the owner, because it is a dashboard setting
and a production change):

1. Supabase → project `oizdbkxnzwatytxcrvoo` → Authentication → Providers →
   Email → turn **Confirm email** off. This app collects only a username and
   maps it to a non-deliverable internal address, so confirmation can never
   complete. With it off, `signUp` returns a session and registration works with
   no other change.
2. Record the deployed site URL in the repository so the deployed build's
   configuration can be inspected.

No data migration is required, and no existing user is affected: the five
existing accounts keep their passwords and can still sign in with their real
email only if the product ever accepts email, which it does not.

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
| Production registration | EXTERNALLY BLOCKED | Owner turns off "Confirm email" (exact steps above) |
| Production migrations `0002`, `0003` (and `0004` for parity) | EXTERNALLY BLOCKED | Owner approval; SQL is the repository's migration files, unchanged |
| Password change in the UI | IMPLEMENTED BUT UNVERIFIED | Run after registration is unblocked |
| Everythingle / Krillion framing and retry | IMPLEMENTED BUT UNVERIFIED | Browser pass |
| Missing games (Smashy Road, Wanted 2, HOBO, Henry Stickmin) | NOT STARTED | An authorized build; none was obtained |
| 5 missing launch paths, 248 unreferenced wrappers | NOT STARTED | Owner decision; entries were preserved rather than guessed |
