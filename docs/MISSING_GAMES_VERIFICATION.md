# Missing Games Verification

Date: 2026-11-26
Branch: `feature/geegle-catalog-restoration`
Verification build: `npm run build` at this branch, served by
`vite preview` at `http://127.0.0.1:4180`
Automation: `scripts/qa/check-catalog-games.mjs` (one browser context and one
timeout per title) and `scripts/qa/check-guest-reminder-preference.mjs`

## Verdicts

| Title | Catalog ID | Local launch file | Browser result | Notes |
| --- | --- | --- | --- | --- |
| HOBO | `clhobo` | `clhobo.html` | PASS | Ruffle canvas, SWF 200, frame changes on input |
| HOBO 2: Prison Brawl | `clhobo2` | `clhobo2.html` | PASS | `$1` placeholder fixed; real SWF loads |
| HOBO 3: Wanted | `clhobo3` | `clhobo3.html` | PASS | `$1` fixed |
| HOBO 4: Total War | `clhobo4` | `clhobo4.html` | PASS | `$1` fixed |
| HOBO 5: Space Brawls | `clhobo5` | `clhobo5.html` | PASS | `$1` fixed |
| HOBO 6: Hell | `clhobo6` | `clhobo6.html` | PASS | `$1` fixed |
| HOBO 7: Heaven | `clhobo7` | `clhobo7.html` | PASS | `$1` fixed |
| Henry Stickmin: Breaking the Bank | `clstickminbreakingbank` | `clstickminbreakingbank.html` | PASS | title screen rendered; PLAY starts gameplay |
| Henry Stickmin: Escaping the Prison | `clstickminescapingprison` | `clstickminescapingprison.html` | PASS | `$1` fixed; muted autoplay starts the movie without the stuck splash |
| Henry Stickmin: Stealing the Diamond | `clstickmanstealingdiamond` | `clstickmanstealingdiamond.html` | PASS | `$1` fixed; non-fatal Newgrounds promo CORS warning |
| Henry Stickmin: Infiltrating the Airship | `clstickminairship` | `clstickminairship.html` | PASS | split SWF parts merge and play; same promo warning |
| Henry Stickmin: Fleeing the Complex | `clstickminfleecomplex` | `clstickminfleecomplex.html` | PASS | split SWF parts merge and play |
| Polytrack (working) | `clpolytrackworksnow` | `clpolytrackworksnow.html` | PASS | menu and Settings respond; race starts from Play; profile API 403 is non-fatal |
| Snow Rider | `clsnowrider` | `clsnowrider.html` | PASS | Unity WebGL; TAP TO START responds; GD SDK 404 is a non-fatal analytics script |
| Snow Rider 3D | `snow-rider` | `snow-rider.html` | PASS | local HTML5 build; same non-fatal SDK 404 |
| Snow Rider Goody Gumdrops | `clsnowridergoodygumdrops` | `clsnowridergoodygumdrops.html` | FAIL | wrapper renders "Play on Cookie Love"; no canvas and no game build in the repository |
| Snow Rider Rrr | `clsnowriderrrr` | `clsnowriderrrr.html` | PASS | same Unity build family; same non-fatal SDK 404 |
| Hobo vs Zombies (existing) | `clhobovszombies` | `clhobovszombies.html` | NOT VERIFIED | existing wrapper is a full-page iframe to a Google Apps Script; preserved as-is because the catalog-wide wrapper audit is a later assignment |

PASS means: the game's own build loaded in a real browser, a rendering
surface existed, the SWF/asset responses were 200, real mouse and keyboard
input produced a changed frame, and there were no fatal initialization
errors. Warnings are listed per title above and are third-party analytics or
cross-promotion failures that do not stop gameplay.

## Smashy Road research

| Title | Finding |
| --- | --- |
| Smashy Road | The series name; the released title is **Smashy Road: Wanted** |
| Smashy Road: Wanted | Distinct release (Bearbit Studios B.V., 2015) |
| Smashy Road: Wanted 2 | Distinct sequel (Bearbit Studios B.V., 2020/2021) |

Both released titles are commercial mobile/console games distributed through
the App Store, Google Play and Nintendo Switch, free-to-play with ads and
in-app purchases. No official browser build, authorized HTML5 port, developer
repository or permitted distribution was found. Adding a mirror, an iframe to
a portal, or an imitation would violate the assignment's local-build rules.

**Status: BLOCKED for all three names.** No catalog entry, placeholder or
substitute driving game was added. The blocker is licensing/distribution:
there is no authorized browser-compatible build to host.

## Henry Stickmin research

| Installment | Status |
| --- | --- |
| Breaking the Bank | present and verified |
| Escaping the Prison | present, repaired and verified |
| Stealing the Diamond | present under `clstickmanstealingdiamond` (the alternate filename the assignment asked to investigate) and verified |
| Infiltrating the Airship | present and verified |
| Fleeing the Complex | present and verified |
| Completing the Mission | not added — commercial installment sold in *The Henry Stickmin Collection*; no authorized free browser distribution |
| The Henry Stickmin Collection | not added — commercial bundle, not distributable |

The five original browser installments are the authorized free releases. No
commercial collection content was downloaded or redistributed.

## Build repairs made for verification

Eight wrappers parked the actual SWF behind an unsubstituted `$1` template
placeholder, so the Ruffle player loaded a file named `$1` and the game never
started. Each now loads its own real SWF URL, and the duplicated trailing
`<embed>`/`<param>` tags were removed so only one player is created:

`clhobo2`, `clhobo3`, `clhobo4`, `clhobo5`, `clhobo6`, `clhobo7`,
`clstickminescapingprison`, `clstickmanstealingdiamond`.

`clstickminescapingprison.html` also sets Ruffle's autoplay configuration so
the movie starts muted instead of waiting on a click-to-start splash that
synthetic and keyboard input could not dismiss.

## Other previously requested titles

`PROJECT_COMPLETION.md` named Smashy Road, Smashy Road: Wanted 2, HOBO and
Henry Stickmin as outstanding. HOBO and Henry Stickmin are complete above.
Smashy Road and Wanted 2 are blocked as described. No other outstanding
missing game was documented; the historical audit found no legitimate game
entry missing from the catalog.

Pokémon emulator entries and user-provided authorized game file support were
left untouched. No commercial ROM was downloaded.

## Remaining blockers

1. Smashy Road / Smashy Road: Wanted / Smashy Road: Wanted 2 — no authorized
   browser build.
2. Snow Rider Goody Gumdrops — the only wrapper in the repository is a
   redirect page with no game content; no legitimate build was found.
3. Hobo vs Zombies — existing external iframe, unverified; deferred to the
   catalog-wide wrapper audit.
4. Five historical rows whose HTML files were never committed (see
   `docs/CATALOG_RESTORATION_REPORT.md`).
