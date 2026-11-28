# Run 2 verification

Branch: `feature/geegle-run2-apps-player` (from `origin/main` at PR #15, `cc280c0`).
Date: 2026-11-28. Environment: local Vite dev server at `http://127.0.0.1:5173`
and a local production build, on macOS, headless Chromium 143 via Playwright.

This file records what was built, what was actually executed, and what remains
unverified. Nothing below is inferred from source alone unless it says so.

## REA status

**Unavailable in this environment; no REA evidence was produced.**

- The `rea` CLI is installed (6.8.0) but `rea doctor` reports `healthy: false`.
- No REA MCP tools or engines were exposed to this session (the tool list has
  no `rea_*` entries), and the Ghidra, IDA and JADX engines that `rea doctor`
  expects are missing.
- Work therefore used source inspection plus Playwright. No claim in this
  document depends on REA.

## Playable features

### Everythingle is a real in-Geegle puzzle

- `src/lib/wordPuzzle.ts` implements an original five-letter word puzzle:
  authored word list (no third-party data), answer selection, guess validation,
  scoring, statistics and progression to the next puzzle.
- `src/components/EverythingleApp.tsx` renders the board and keyboard inside
  Geegle, with the game's own fullscreen control. The app stores state under
  `geegle-everythingle:<user|guest>`.
- The old external/CherryProxy selection UI was removed: `public/games/everythingle.html`
  is deleted, `DESTINATION_PROVIDERS`/`cherryDestinationUrl` are gone, and the
  catalog entry (`src/data/external.ts`) now points at the local app with an
  original-cover artwork record.
- Covered by `tests/word-puzzle.test.mjs` (11 tests) and by the browser checks
  listed below (typing, invalid-word rejection, scoring, reload persistence,
  solve, next puzzle).

### Krillion

Both Krillion entries remain (official + backup), with distinct IDs and paths.
`public/games/krillion.html` now frames the service full-bleed with a floating
mode switch, instead of the previous small inset frame. The site's own console
error inside its iframe (`Minified React error #418`) is third-party and is
filtered by origin in the checks.

### Xylora

`exam.grahammurryinsuranceagency.com` resolves to NXDOMAIN, so the endpoint is
marked `available: false` with that reason in `src/data/proxies.ts`, and
`public/games/xylora.html` shows an unavailable message. The card and its
artwork are kept; no replacement endpoint was invented.

### Player chrome

`src/components/GamePlayer.tsx` now offers only **Back** and **Fullscreen**
(plus save controls for games with cloud saves). The external-open button and
its error actions were removed. `src/components/YouTubeApp.tsx` was recentred,
Back moved to the bottom-left, Fullscreen to the top-right, the persistent
"Open on YouTube" control removed, and invalid input now shows an error instead
of leaving the player blank.

### Navigation shortcut

- Default key: Backslash; default destination: `https://manhasset.instructure.com/`.
- Settings → Preferences: enable/disable, capture a new key, edit the
  destination, restore defaults, with inline validation errors.
- The App-level key handler ignores typing contexts and modifier combinations
  and performs normal navigation only. Guards use `isEditableTarget`.
- Persisted for guests (localStorage) and accounts (synced user data) through
  `loadNavigationShortcut`/`saveNavigationShortcut` in `src/lib/userData.ts`.
- Covered by `tests/navigation-shortcut.test.mjs` (7 tests) and the browser
  checks (navigate, disable, typing guard, restore defaults).

### Homepage, announcement, favicon, changelog

- Homepage (`SearchLanding`) no longer shows the footer credit or the
  appearance-save success text. The theme selector is System / Light / Dark.
- Development announcement (`DevelopmentNotice`, `src/lib/developmentNotice.ts`)
  uses the owner's exact text, a single "Give feedback" link to the existing
  Google Form, and a per-user/per-announcement dismissal. Preferences has
  "Show the development announcement again".
- New independent favicon: dark rounded tile with a lens mark
  (`public/favicon.svg`, `public/apple-touch-icon.png`), replacing the
  Google-like circular G.
- Changelog: notes added for PRs 15, 13 and 9; `src/data/changelog.json`
  regenerated (15 releases, PR 15 at 2026-11-27 6:29 PM EST, both sort
  directions retained).

## Artwork

| Measure | Count |
| --- | --- |
| Catalog rows after removals | 2,708 |
| Verified artwork | 2,684 (99.1%) |
| Without artwork | 24 |
| Records pointing at a broken/missing file | 0 |

The 31 titles left at the end of Run 1 were investigated one at a time in a
clean browser context (12 s first pass, then a second pass that pressed or
clicked each wrapper's own start control and allowed 15–20 s more). Five
authentic title/menu screens were captured and accepted:

| ID | Title | What the capture shows |
| --- | --- | --- |
| `clcotlk` | CotLK | The game's own "Curse of the Lich King" title screen |
| `clhighstakes` | High Stakes | "HIGH STAKES — NEW GAME" title screen |
| `clmami` | Mami | "Friday Night Funkin' VS Mami" title screen |
| `clpint` | Pint | In-game menu with PLAY / ABOUT / QUIT |
| `clsd-thewar` | SD: The War | "STICK DUEL THE WAR" main menu |

Accepted only when the frame was the game's own menu or gameplay. Rejected:
engine splashes (Unity/"really cool flash game"), wrapper play buttons, portal
ads (e.g. Kiz10), loading bars with no title, and mismatched builds
(`clthereisnofile` renders "There Is No Game", not this catalog title).

`cladarkroom` is now verified: the cleared A Dark Room logo serves both the
`clAdarkRoom` key and the lowercase alias through the case-insensitive file
system.

### Count reconciliation (19 vs +25)

The Run 1 PR text said 19 images; the actual gain was 25 catalog records
(`progress.json` at the Run 1 base `2653` → `2678`). The ids confirm it is one
record per added image (18 in the first batch, 7 in the second). The "19" in
the PR body was a miscount, not a hidden or duplicate record. This pass adds 5
more verified records (`2684`), with 2 confirmed removals leaving 24 titles
without artwork.

## Confirmed removals

Both were executed twice in clean browser contexts, 15 s each, with the
wrapper's own controls used before judging:

| ID | Title | Evidence | Action |
| --- | --- | --- | --- |
| `clburritobison2` | Burrito Bison 2 | The served wrapper embeds a Google Gadgets iframe whose target returned **404 Not Found** in both sessions; nothing else rendered. | Wrapper and catalog rows removed from `public/games/` and the raw catalog; both ids added to `CONFIRMED_NONFUNCTIONAL` in `scripts/restore-catalog.mjs` so the historical restore cannot bring them back. Recorded in `docs/NONFUNCTIONAL_GAME_REMOVALS.md`. |
| `clfocus` | Focus | Ruffle 0.2.0 nightly reports **"Ruffle cannot parse the requested file… not a valid SWF"** in both sessions. | Wrapper and catalog rows removed from `public/games/` and the raw catalog; both ids added to `CONFIRMED_NONFUNCTIONAL` in `scripts/restore-catalog.mjs`. Recorded in the removals doc. |

No other game was removed. Blank frames after the wrapper's start control were
treated as an unverified dependency or capture limitation, not proof of a
broken game.

## Commands and results

| Check | Command | Result |
| --- | --- | --- |
| Unit tests | `bun test tests` | **166 pass, 0 fail** (24 files) |
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Production build | `npm run build` | exit 0 (prebuild regenerates the catalog) |
| Artwork map check | `node scripts/map-artwork.mjs --check` | exit 0 |
| Artwork audit | `python3 scripts/artwork/audit-artwork.py` | 2,690 records, 0 broken, 0 exact duplicates |
| Artwork report | `python3 scripts/artwork/report.py` | 2,684 verified, 99.1% |
| Run 2 interface checks | `node scripts/qa/run2-interface-check.mjs` | **38/38 checks passed** |

The browser script exercises the homepage selector and footer, the announcement
text/action/dismiss, the 28-entry rail at 1024×600, 1366×768 and 1920×1080,
Everythingle input/validation/scoring/reload persistence/solve/progression,
both Krillion entries and the centered wrapper, the reduced player controls,
the YouTube embed without an external link, the shortcut navigate/disable/
typing-guard/restore-defaults flows, the changelog's PR 15 entry and both sorts,
Xylora's disabled endpoint with artwork retained, the favicon and touch icon,
and asserts no Geegle-origin page errors.

## Limitations

- REA could not be run (see above), so no native/decompiled evidence exists for
  any game.
- The 24 remaining titles have no artwork. Their frames were blank, engine
  splashes or the wrapper's play control after both passes. That is not proof
  they are nonfunctional, so none was removed.
- Captures were taken in headless Chromium; a desktop GPU context could render
  some canvas engines (Ruffle/EmulatorJS/Unity) that stayed black here.
- Third-party iframe errors (krillion.cc React #418) are filtered by origin;
  they are the embedded site's own errors.
- The shortcut browser test uses `https://example.com/shortcut-test` because
  the parser accepts https destinations only.
- The Supabase production environment was not touched. Cloud-save behaviour is
  covered by local tests and earlier local Chromium verification, not by a new
  hosted run in this pass.
- No merge was performed; the pull request is for owner review.

---

# Final pass (2026-11-28, after PR #16 merged)

Branch: `feature/geegle-run2-final`, from `origin/main` at `7df980a`
(PR #16 merged 2026-11-28T01:25:41Z; the only later commit deleted
`public/favicon.svg`). No further pull requests were merged after #16, and none
is open. Environment: local Vite dev server at `http://127.0.0.1:5175` and a
local production build, macOS, headless Chromium via Playwright.

## What changed in this pass

### Everythingle: the whole collection, not one puzzle

The previous pass substituted one five-letter puzzle for the collection. That
was wrong and has been removed.

- `src/data/everythingle.ts` records all **50** games from the provider's own
  `/about` inventory, each with its slug, category and description.
- `src/components/EverythingleApp.tsx` is now a collection hub: 50 tiles, a
  search field and seven category filters. Selecting a game opens it directly —
  no launcher screen, no direct-versus-proxy choice.
- Five word formats are Geegle's own code and word list and are labelled
  **Geegle**: Five Letter, Double Board, Quad Board, Word 500 and Middle Word
  (`src/components/everythingle/WordBoards.tsx`, `MiddleWord.tsx`,
  `src/lib/wordGames.ts`).
- The other 45 load the provider's official page, unmodified, in the player,
  labelled `everythingle.com`.
- The reverse-proxy option was investigated first and rejected on the provider's
  terms, which forbid copying or redistributing its games. Full reasoning,
  the 50-row implementation matrix and the limitations are in
  `docs/EVERYTHINGLE_VERIFICATION.md`.

### Time & Date settings

- New Settings tab **Time & Date**, placed after Preferences so Changelog stays
  last. The window size and header height are unchanged.
- Live preview clock, independent **Show time** and **Show date** toggles,
  **12-hour**/**24-hour** format, and an IANA time-zone picker with
  **Automatic (browser)** detection.
- Default zone is `America/New_York`, applied through `Intl` so daylight saving
  switches by itself; there is no fixed EST offset anywhere. No GPS or Google
  location service is used.
- The library header clock now uses the same settings. Preferences persist
  locally for guests and sync inside the existing `settings.appearance` record
  for signed-in accounts, so no schema change was needed.

### Favicon

- The owner supplied the site icon; it is now the official favicon in every
  required size (`public/favicon.png`, `favicon-32.png`, `favicon.ico`,
  `apple-touch-icon.png`) and is linked from `index.html`.
- Two real defects were found and fixed while wiring it up:
  1. `src/lib/tabIdentity.ts` rewrote the tab icon to `/favicon.svg` on **every**
     page load, and that file had just been deleted by the owner. Every visitor
     therefore received a broken tab icon regardless of `index.html`. It now
     points at the shipped PNG.
  2. `index.html` still linked the deleted SVG.
- No second logo was added beside the wordmark.

## Verification actually run

| Command | Result |
| --- | --- |
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors, 0 warnings |
| `npm run build` | exit 0 (changelog regenerated, then Vite build) |
| `bun test tests` | 182 tests, 0 failures (26 files) |
| `node scripts/map-artwork.mjs --check` | exit 0, 2,690 records (4 licensed, 2,686 captured) |
| `python3 scripts/artwork/audit-artwork.py` | 2,690 records, 0 broken, 0 missing files |
| `python3 scripts/artwork/report.py` | 2,684 verified, 99.1% coverage |
| `node scripts/qa/run2-final-check.mjs` | 30/30 browser checks |
| `node scripts/qa/run2-interface-check.mjs` | updated favicon assertion (see note) |

New or updated tests:

- `tests/everythingle.test.mjs` — 50 unique slugs, one category per game, official
  URL shape, exactly five local implementations, guess validation, multi-board
  win/loss, counts totals, Middle Word bounds, and a source assertion that the
  app has no proxy path.
- `tests/time-settings.test.mjs` — documented defaults, strict parsing, automatic
  detection, EST/EDT behaviour at fixed instants, 12/24-hour output, date
  rollover by zone.
- `tests/public-content.test.mjs` — the supplied icon exists at every size, is
  linked correctly, and no source still references the deleted `favicon.svg`.
- `tests/personalization.test.mjs` — defaults and Settings tab order now include
  Time & Date.
- `tests/changelog.test.mjs` — PR 16 is the newest entry and carries a written
  user-facing note, not its development title.

Browser checks (`run2-final-check.mjs`, 30/30) confirmed: all four icon files
served with the right content types, the icon link in the live DOM, no logo
beside the wordmark, the Settings tab order, a live preview clock, 12/24-hour
output, automatic and manual zone selection, the header clock, 50 Everythingle
tiles with exactly five Geegle labels, a scored guess in Five Letter, Word 500
totals, Middle Word bounds, Chess loading and rendering from everythingle.com,
one Krillion and one Krillion (Backup) in Games and both in Apps, the Xylora
card with its unavailable reason, and no Geegle-origin page errors.

Viewport checks at 1366×768 and 390×844: no horizontal overflow in the library
or the Everythingle hub, 50 tiles reachable at both sizes.

## Counts

- Catalog rows: **2,708** (unchanged; no entries were added or removed).
- Library cards in Games: 2,708 (the two Krillion titles come from the catalogue
  as `clkrillion` and `clkrillion-backup`, exactly once each).
- Artwork records: 2,690; verified artwork: 2,684 (99.1%); without artwork: 24.
- `cladarkroom` is stored as `public/artwork/cladarkroom.webp` and referenced as
  `/artwork/cladarkroom.webp`, so the match is exact on Linux too (the
  `clADarkRoom` alias is a separate duplicate record from the historical
  catalogue and is reported, not deleted).

## A note on one weakened assertion

`tests/public-content.test.mjs` previously asserted that the favicon was an
independent mark with no Google brand colours. The owner deleted that mark and
supplied this artwork as the official site icon, so the assertion was rewritten
to check the supplied file instead. That is a deliberate change of requirement,
not a test relaxed to hide a defect. The artwork is the well-known multicolour
“G”; if the site must avoid that trademark, replacing `public/favicon*.png`
restores the previous position without any code change.

## Limitations

- REA remains unavailable (`rea doctor` reports `healthy: false`, no engines or
  MCP tools). No claim here depends on REA; it was not retried, per the owner's
  instruction.
- The 45 provider-hosted Everythingle games were verified as loading and
  rendering their official pages, not played to completion.
- No hosted production run was performed. All browser evidence is local
  Chromium against the dev server and the local build.
- The Supabase production project was not touched; no account or cloud-save
  testing was repeated in this pass, and the Time & Date preferences ride the
  existing appearance record that was already covered.
- Nothing was merged. The branch is pushed for owner review.
- Searching inside the Games tab uses the shared library index, which
  deliberately also returns Apps (the search box says “games, apps and
  proxies”). A search for “krillion” therefore lists the official Krillion app
  as well as the two Krillion games; the unfiltered Games grid shows exactly
  one Krillion and one Krillion (Backup). This behaviour predates this pass and
  was left alone rather than narrowing the documented search scope.
