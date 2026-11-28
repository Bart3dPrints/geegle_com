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
