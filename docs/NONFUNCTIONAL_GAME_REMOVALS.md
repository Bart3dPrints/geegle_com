# Nonfunctional game removals

This file records removals the owner authorised: games that are genuinely
nonfunctional, proven by evidence rather than by an artwork classification.
Nothing is removed because artwork was hard to find.

## Removal conditions

A game is removed only when **all** of these hold:

1. Independent artwork research (exact title, alternate names, developer,
   publisher, editions) found no usable image.
2. Its actual served HTML build was executed in a real browser.
3. It was observed for the owner's current 10–15 second window (the earlier
   ten-minute requirement was cancelled).
4. The final rendering was still completely blank or nonfunctional.
5. No meaningful progress happened between the initial and final rendering.
6. A clean retry confirmed the result.
7. The cause is the game or its unavailable dependencies, not the capture
   environment (headless/WebGL/Unity/Ruffle/emulator interactions were ruled
   out first).

## Current state: no game has completed the protocol yet (0 removals)

No catalog entry has been removed in this pass, because at the time of this
commit no entry had satisfied all seven conditions. The previous 1,676-entry
"blocked" list was **reopened** rather than converted into removals — a blank
early frame is evidence of a capture problem, not of a broken game.

Evidence that the old blanket "blank-render" label was wrong (both entries had
been marked `blank-render`):

| Game ID | Title | What the long observation showed |
| --- | --- | --- |
| `cl10bullets` | 10 Bullets | Once the Ruffle SWF finished downloading, the game's own title screen appeared: "10 BULLETS — A GAME BY MICHEL GERARD", PLAY / SPACEBAR, high-score and Kiz branding. Previously rejected as a "generic play splash". |
| `cl100roomsofenemies` | 100 Rooms Of Enemies | Its wrapper's own green PLAY button appeared, but the EmulatorJS loader and game archive never started the emulator; the frame stayed black for the whole window. This is a dependency failure, and it is **not** yet a confirmed removal: a clean retry under the full protocol is still outstanding. |

Neither entry was removed. `cl10bullets` is functional and now has an authentic
title screen for its card.

## Running the protocol

`scripts/artwork/investigate-render.mjs` implements the required steps: launch
record, timestamp, console errors, failed requests, canvas/engine state, an
initial frame, the wrapper's own start control clicked each poll, the page kept
open for the whole window in bounded parallel batches, a final frame, and the
real elapsed observation time. Results accumulate in
`scripts/artwork/render-investigation.json`, which is resumable and is the only
acceptable basis for a removal.

```bash
GEEGLE_BASE=http://127.0.0.1:5173 node scripts/artwork/investigate-render.mjs \
  --seconds 600 --concurrency 5 --out /tmp/artshots4
```

## Removals

None. This section stays empty until an entry has the full evidence set, at
which point each removed game is listed here with:

- exact game ID and title
- original launch file
- initial and final screenshot paths
- actual observation duration
- artwork research sources
- browser and network errors
- clean-retry result
- the specific removal reason
- the commit that still holds the recoverable source in Git

No entry in this file is provisional, and no removal was performed in bulk from
the old blocker classification.

## Blank observations in the short-window pass

These entries produced no acceptable frame in the owner-approved 10–15 second window.

They were **not** removed: in every case the observation shows a cause outside the game
itself (a browser-blocked loader, a CDN error, a reset connection, or a download still in
progress), so condition 7 — the failure is the game, not the capture environment — does
not hold. They stay in the catalog without artwork.

| Game ID | Title | Classification | Observed cause |
| --- | --- | --- | --- |
| `bank-robbery` | Bank Robbery | blank-after-observation | The build asset returns HTTP 403; the host refuses the download. |
| `cl100in1nes` | 100 in 1 NES | start-gate-only | Still at its own start gate or loading state ("PLAY") when the window ended. |
| `cl100roomsofenemies` | 100 Rooms of Enemies | start-gate-only | Still at its own start gate or loading state ("PLAY") when the window ended. |
| `cl10yardfight` | 10 Yard Fight | blank-after-observation | No frame content and no error text; loaders never produced a frame. Cause not attributable to the game. |
| `cl1942nes` | 1942 (NES) | blank-after-observation | No frame content and no error text; loaders never produced a frame. Cause not attributable to the game. |
| `cl40xescape` | 40x Escape | blank-after-observation | No frame content and no error text; loaders never produced a frame. Cause not attributable to the game. |
| `cl64in1nes` | 64 in 1 NES | start-gate-only | Still at its own start gate or loading state ("PLAY") when the window ended. |
| `clAltered Beast` | Altered Beast | start-gate-only | Still at its own start gate or loading state ("PLAY") when the window ended. |
| `clBMX2` | BMX 2 | start-gate-only | Still at its own start gate or loading state ("PLAY") when the window ended. |
| `clFF3` | Final Fantasy III | blank-after-observation | Still at its own start gate or loading state ("Loading: 2/4 First-time loading may take longer...") when the window ended. |
| `clFNAF` | Five Nights at Freddy's | blank-after-observation | Still at its own start gate or loading state ("Downloading... 0% Extracting... 0%") when the window ended. |
| `clFNAF2` | Five Nights at Freddy's 2 | blank-after-observation | Still at its own start gate or loading state ("Downloading... 0% Extracting... 0%") when the window ended. |
| `clFNAF3` | Five Nights at Freddy's 3 | blank-after-observation | Still at its own start gate or loading state ("Downloading... 0% Extracting... 0%") when the window ended. |
| `clFNAF4` | Five Nights at Freddy's 4 | blank-after-observation | Still at its own start gate or loading state ("Downloading... 0% Extracting... 0%") when the window ended. |
| `cla-walk-in-the-forest--v1-0` | A Walk in the Forest | start-gate-only | Still at its own start gate or loading state ("PLAY") when the window ended. |
| `clacecombat2` | Ace Combat 2 | blank-after-observation | Still at its own start gate or loading state ("Loading: 2/17 First-time loading may take longer...") when the window ended. |
| `clblackout` | Blackout | blank-after-observation | The build asset returns HTTP 404; the game files are missing at the source. |
| `clblobsstory2` | Blob's Story 2 | blank-after-observation | No frame content and no error text; loaders never produced a frame. Cause not attributable to the game. |
| `clbloonspp3` | Bloons PP 3 | blank-after-observation | Still at its own start gate or loading state ("]]>") when the window ended. |
| `clbloonstd2` | Bloons TD 2 | blank-after-observation | Still at its own start gate or loading state ("]]>") when the window ended. |
| `clbloonstd4` | Bloons TD 4 | blank-after-observation | Still at its own start gate or loading state ("]]>") when the window ended. |
| `clboxinglive-2` | Boxinglive 2 | blank-after-observation | No frame content and no error text; loaders never produced a frame. Cause not attributable to the game. |
| `clboxinglive2` | Boxing Live 2 | blank-after-observation | No frame content and no error text; loaders never produced a frame. Cause not attributable to the game. |
| `clclearvision4` | Clear Vision 4 | blank-after-observation | No frame content and no error text; loaders never produced a frame. Cause not attributable to the game. |
| `clclearvision5` | Clear Vision 5 | blank-after-observation | No frame content and no error text; loaders never produced a frame. Cause not attributable to the game. |
| `clducklife` | Duck Life | blank-after-observation | Still at its own start gate or loading state ("]]>") when the window ended. |
| `clfivenightsatshrekshotel` | Five Nights at Shrek's Hotel | blank-after-observation | The build asset returns HTTP 403; the host refuses the download. |
| `clfnac1` | FNAC 1 | blank-after-observation | Still at its own start gate or loading state ("Downloading... 43% Extracting... 0%") when the window ended. |
| `clfnaf4halloween` | FNAF 4 Halloween | blank-after-observation | Still at its own start gate or loading state ("Downloading... 0% Extracting... 0%") when the window ended. |
| `clfnafanimatronics` | FNAF Animatronics | blank-after-observation | The build asset returns HTTP 404; the game files are missing at the source. |


## Run 1 (2026-11-27): no removals

Run 1 removed no catalog entries. Nineteen previously unresolved titles gained
verified artwork through deeper image search, and the remaining 31 were searched
three times each (exact title, "box art", "game screenshot") without a match
close enough to use. Missing artwork is not evidence that a game is broken.

No wrapper was classified as nonfunctional in this run, so no entry was removed
from search results, categories, favorites or recently played listings, and no
cloud-save record was touched. The local HTML capture fallback for the 31
titles remains outstanding; the seven-condition protocol above still applies
before any future removal.

## Run 2 (2026-11-28): two removals after individual investigation

Every one of Run 1's remaining 31 titles was run one at a time in a clean
browser context: 12 seconds first, then a second clean context that pressed
Enter/a key and clicked the wrapper's own Play control (Ruffle's green PLAY,
the centred emulator/PICO-8 glyph) and allowed 15–20 more seconds. The frames
were reviewed in contact sheets before any decision.

### Removed

| Game ID | Title | Observed (two clean sessions) | Reason |
| --- | --- | --- | --- |
| `clburritobison2` | Burrito Bison 2 | The wrapper's embedded Google Gadgets iframe returned **404 Not Found**; no game, no further loading. | The served build is missing at its source. Recoverable at `1dcae5f` and earlier. |
| `clfocus` | Focus | Ruffle 0.2.0 nightly: **"Ruffle cannot parse the requested file. The most likely reason is that the requested file is not a valid SWF."** | The served SWF is invalid for the emulator the wrapper ships. Recoverable at `1dcae5f` and earlier. |

Removal touched only the wrapper (`public/games/<id>.html`) and the raw
catalog rows. Both ids are listed in `CONFIRMED_NONFUNCTIONAL` inside
`scripts/restore-catalog.mjs`, so the historical-restore script (which runs in
the test suite) cannot recreate the rows or files; this was verified by running
the restore script and the full test suite after deletion. The catalog was
regenerated with `node scripts/generate-catalog.mjs`; save coverage was
regenerated; artwork progress dropped both ids. No favorites, history or saved
game data were deleted.

### Kept without artwork (24)

These produced no acceptable frame after both passes: a content-warning screen
the canvas never left, a blank frame after the wrapper's Play control, an
engine splash or loading bar, an ad/portal splash, or a build whose title does
not match the catalog. None meets condition 7, so none was removed.

`clblackout`, `clbloonstd2`, `clcreepyinternetstories`, `clclover`, `clcvooc`,
`clfamilyguycorrupted`, `clffaf`, `clfireemblem`, `clgrannycreepy`,
`clinsomniary`, `clloz1`, `clmaddenfootball`, `clmariominusrabbids`,
`clmeowuwu`, `cloddfuture`, `cloutnumbered`, `clpokered`, `clpokerowe`,
`clicantbelievegoogleflaggedmeforthenameofthefilelol`, `clmonsterswing`,
`clthanksforremindingmeihadtofixthis`, `clthereisnofile`, `clvolleyball`,
`clweltling`.

Correction: Run 1's PR text said "19 images"; the actual gain was 25 records
(2,653 → 2,678), one per image (18 + 7). No record was double-counted.
