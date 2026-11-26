# Acceptance evidence — corrective branch

Branch: `feature/geegle-regression-fixes`
Base: `e780686` (latest `main`, PR #3 merged)
Commits: `79b079b` (interface, notices, controls, restored catalog) and the
follow-up commit containing auth/proxy/QA evidence.

Statuses are evidence-based: **VERIFIED** means the check was run in this
session and passed. **IMPLEMENTED UNVERIFIED** means the code exists but the
behaviour was not exercised. **BLOCKED** names the owner action or missing
resource. Nothing is marked complete because code exists.

## Checks actually run

| Check | Command | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | 0 errors |
| Lint | `npm run lint` | 0 errors |
| Unit tests | `bun test tests` | 71 pass, 0 fail, 13 files |
| Production build | `npm run build` | exit 0 |
| Interface journey | `node scripts/qa/interface-check.mjs` | 39/39 checks pass |
| Account journey | `node scripts/qa/auth-check.mjs` (isolated Supabase) | 12/12 checks pass |
| Password change | `node --env-file=.env.local scripts/qa/check-password-change.mjs` | 6/6 checks pass |
| Proxy reachability | `node scripts/qa/check-proxies.mjs` | 61 endpoints recorded in `docs/qa/proxy-endpoints.json` |
| External services | `node scripts/qa/check-services.mjs` | 9/9 checks pass |
| Cloud save round trip | `node --env-file=.env.local scripts/qa/check-cloud-save.mjs` | 6/6 checks pass |

Screenshots inspected after the run: `docs/qa/landing-desktop.png`,
`library-notice.png`, `library-desktop.png`, `library-chromebook.png`,
`library-mobile.png`, `library-signed-in.png`.

## A — Authentication and accounts

| ID | Status | Evidence |
|---|---|---|
| A01 | VERIFIED (diagnosis + release gate) | Re-checked after PR #4 merged: the live Render page serves `/assets/index-CC8Bq6la.js`, which still contains `https://wkdlsaydqyymynoipmhl.supabase.co` and publishable key `sb_publishable_…` (isolated project), not the production project `oizdbkxnzwatytxcrvoo` (5 existing users). It was built with test-project values. On that project `/auth/v1/settings` reports `mailer_autoconfirm: false`, so `signUp` returns a user with no session while Geegle collects no email to confirm — account creation cannot complete, and existing production accounts are "invalid credentials" there. Sanitized live evidence: `/auth/v1/settings` → 200 with `mailer_autoconfirm: false`, `disable_signup: false`; password grant for a random username → 400 `invalid_credentials`. `npm run check:prod-build` now fails a production build that compiles the isolated ref (exit 1 on the current isolated build). Exact owner steps: `docs/PRODUCTION_AUTH_HANDOFF.md`. |
| A02 | PARTIAL | Sign-in from landing and library, wrong password, favorites, Recently Played and second-account isolation verified (14/14) against isolated `wkdlsaydqyymynoipmhl`. New-account signup remains BLOCKED by that project's email-confirmation policy; duplicate-username case was covered in the previous cycle, not re-run. New-account signup is BLOCKED by that project's email-confirmation policy. Owner action: on Render set `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` for the intended project, redeploy, and disable "Confirm email" for the synthetic-username flow (or approve a Geegle-specific policy). |
| A03 | VERIFIED | Session survives reload, a new tab, and a real browser restart (storage state moved to a new browser process): still signed in without reauthentication. Explicit logout verified; no inactivity logout exists. `scripts/qa/check-session-sync.mjs` 5/5. |
| A04 | VERIFIED (representative) | Favorites and Recently Played persist across reload; 2048 cloud-save round trip re-verified (6/6); appearance and tab identity follow the account into a fresh browser with separate storage. Per-engine save verification beyond 2048 remains open. |

Auth errors now distinguish invalid credentials, rate limiting, taken username
and the email-confirmation condition; the dev console logs only status/code.

## H — Landing and identity

| ID | Status | Evidence |
|---|---|---|
| H01 | VERIFIED | Title exactly `Geegle`; landing wordmark neutral; library brand is the text `Geegle` alone with no circular badge; independent circular favicon on a pale ground; search field 53 px tall at 1440; no horizontal overflow at 1440, 1366 and 390. |
| H02 | VERIFIED | No Games shortcut (`gl-library` removed), no Google Images link, generic neutral avatar (button, no initial), ordinary web search unchanged. |
| H03 | VERIFIED | `pirate` + Enter opens the library at the canonical root URL with no gate and no fragment; the view is history state; browser Back returns to landing and Forward returns to the library, both at `/`. Old `#games` links are rewritten to `/`. |
| H04 | VERIFIED | Exact notice, unchecked checkbox, `Got it`; reappears on re-entry when unchecked; stays dismissed after reload when checked; library renders underneath; focus trap + Escape. |
| H05 | VERIFIED | Automated copy scan passes; footer exactly `Bart made this. Thank him` on landing and library. |

## L, P, S, D — Library, player, settings, design

| ID | Status | Evidence |
|---|---|---|
| L01 | VERIFIED | One secondary nav (Games / Apps / Proxies), Settings on the left, avatar top-right. |
| L02 | VERIFIED | `#` section first, then A–Z full-width sections; rail click lands at 197 px, under the measured sticky header (193.5 px); active letter follows scroll; Starred section present. |
| L03 | VERIFIED (sticky) | The search field is inside the sticky header (measured y=9 while scrolled deep), suggestions anchored below it; hovering a suggestion and pressing Enter filters (352 results, no iframe) and never launches; explicit click launches; Escape closes; empty Enter resets; `zeldaa` still suggests; Puzzle narrows to 259. The same sticky field filters Apps (1 result for `youtube`) and Proxies (1 for `achroma`). |
| L04 | VERIFIED | Star always visible and touch-sized; Recently Played hidden by default with a persisted toggle. |
| L05 | VERIFIED | Cards show name/art/stars only (descriptions removed); proxies show name, `Server 1…N` labels and Open, no marketing copy; only Backup shows Unverified. |
| P01 | VERIFIED | Games: exit arrow alone at top left (x=12, y=12); favorite/save/open/fullscreen together at top right (x=1394); apps: back bottom-left, open/fullscreen top-right; no reload control; no full-width toolbar. Everythingle and YouTube were also converted from full-width bars to floating clusters (YouTube keeps only its compact URL form at the top). |
| P02 | VERIFIED | Proxy notice with exact text shown every launch, Got it/Cancel, Cancel opens nothing. |
| P03 | PARTIAL | 61 endpoints checked once at low rate. 54 returned < 400. Achroma Server 6 returned 404 and is now disabled with a visible reason. 5 endpoints failed to connect from this network and are recorded. Astra 1, 2, 5–10 refuse framing, so those launches use the external-open fallback. Backup endpoints serve NASA and Astra 11–15 serve BullBooks as their default proxied page: that is destination content, not provider identity, so identity review remains open. |
| S01 | VERIFIED | Settings is tabbed (Theme / Preferences / Tab appearance). Theme: light/dark/system, background and card colour pickers, live preview, Apply, Reset, persistence across reload; Preferences: Recently Played and notice reset; account actions stay separate. Appearance syncs to the account and follows it into a fresh browser (verified). No image/animated backgrounds. |
| S02 | VERIFIED | Tab appearance tab: user-owned title (≤60 chars) and PNG/JPEG/WebP icon (≤200 KB) with preview, Apply and Reset; defaults restore `Geegle` and the Geegle favicon; persists locally and per account (verified across a fresh browser); no impersonation preset. |
| D01 | VERIFIED | Computed `backgroundColor`/`color`/`borderColor` sampled on body, header, card, chip and primary button are all R=G=B; neutral focus ring; single soft elevation; border default overridden from Tailwind's tinted gray to `#e5e5e5`. |
| D02 | PARTIAL | Anime.js drives the letter-rail scroll; Motion drives dialogs/menus/recents; the 60-card entrance stagger was removed. Reduced-motion CSS and `useReducedMotion` respected. No fresh reduced-motion emulation run this session. |

## G — Catalog

| ID | Status | Evidence |
|---|---|---|
| G01 | VERIFIED (inventory + restore) | `scripts/restore-catalog.mjs` compares the historical `2d09055` catalog with `src/data/raw`: 106 entries were absent, 103 still had files on disk, 90 restored under their original IDs in `src/data/raw/restored.txt` (18 excluded as apps, chatbot, proxy pages or theme files). All four Snow Rider IDs now resolve: `clsnowrider`, `snow-rider`, `clsnowridergoodygumdrops`, `clsnowriderrrr`. Catalog is 2711 unique IDs. |
| G02 | PARTIAL | Restored entries are local builds; no mirrors were added. A full mirror classification of the 248 unreferenced wrappers is not done. |
| G03 | PARTIAL | Counts reconciled (2711 unique IDs, paths resolve by exact on-disk name in `tests/catalog-audit.test.mjs`). HOBO (8) and Henry Stickmin (5) are present. Smashy Road and Wanted 2 have no local build and no authorized source was found — BLOCKED rather than replaced with a mirror. |

## I, W, C — External services, artwork, saves

| ID | Status | Evidence |
|---|---|---|
| I01 | VERIFIED | Everythingle opens its player and frames `https://everythingle.com/` with exit/open/fullscreen controls; YouTube accepts a watch URL and embeds `https://www.youtube-nocookie.com/embed/…`; Krillion official appears exactly once in Games with its own card, and `Krillion (Backup)` is a separate Apps card; no page errors on those surfaces. 9/9 checks. |
| W01/W02 | BLOCKED (coverage) | Runtime artwork is 73 records (3 licensed + 70 captured) for 2711 IDs — 2.7%. The owner's "~20 visible images" is explained: only 73 cards can render artwork. `scripts/artwork/scan-wrapper-art.mjs` scanned every local build and found 0 usable bundled icons (696 declared files absent, 132 remote/inline), so the bundled-asset tier yields nothing; remaining coverage needs per-title research or reviewed title-screen capture. No generic placeholder is counted. |
| W03 | PARTIAL | The capture runner keeps per-item checkpointing and bounded timeouts. Full-catalog research is not complete; individual batches remain to be run and reviewed. |
| C01 | VERIFIED (representative engine) | 2048 (verified save support): progress written in the game frame was saved automatically on the 15-second tick (backend row contains the key and value), a fresh browser context for the same account restored the value before launch, and a second account never received it. 6/6 checks. Other engines remain individually untested. |
| C02 | KNOWN BLOCKER | Same-origin game frames can still reach parent APIs; the JS storage guard is not a security boundary. Real isolation (separate origin) needs owner infrastructure approval. No tokens are exposed to game content and no universal save claim is made. |

## Q — Delivery

| ID | Status | Evidence |
|---|---|---|
| Q01 | VERIFIED | Fresh typecheck, lint, tests, build and 54-check browser journey (1440/1366/390); no console errors or failed first-party requests on the app surface; no horizontal overflow at 1440/1366/390. Game-build console noise is third-party content and is excluded deliberately. |
| Q02 | VERIFIED | Branch and commits pushed; PR opened against `main`; no merge, no shared production database writes, no force-push. |

## Owner actions required

1. Render → Environment: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   to the intended Supabase project (production `oizdbkxnzwatytxcrvoo` if the
   existing accounts are the ones to keep), then redeploy. The current build
   ships the isolated project's URL and key.
2. Supabase → Authentication → Providers → Email: turn off "Confirm email" for
   the username-only flow (Geegle never collects an email), or approve a
   Geegle-specific confirmation policy. Do not apply this to other apps sharing
   the project.
3. Approve or reject the pending production migrations `0002`/`0003`/`0004`;
   nothing was written to production.
