# Nonfunctional game removals

This file records removals the owner authorised: games that are genuinely
nonfunctional, proven by evidence rather than by an artwork classification.
Nothing is removed because artwork was hard to find.

## Removal conditions

A game is removed only when **all** of these hold:

1. Independent artwork research (exact title, alternate names, developer,
   publisher, editions) found no usable image.
2. Its actual served HTML build was executed in a real browser.
3. It was observed for approximately ten minutes.
4. The final rendering was still completely blank or nonfunctional.
5. No meaningful progress happened between the initial and final rendering.
6. A clean retry confirmed the result.
7. The cause is the game or its unavailable dependencies, not the capture
   environment (headless/WebGL/Unity/Ruffle/emulator interactions were ruled
   out first).

## Current state: no game has completed the protocol yet

No catalog entry has been removed in this pass, because at the time of this
commit no entry had satisfied all seven conditions. The previous 1,676-entry
"blocked" list was **reopened** rather than converted into removals — a blank
early frame is evidence of a capture problem, not of a broken game.

Evidence that the old blanket "blank-render" label was wrong (both entries had
been marked `blank-render`):

| Game ID | Title | What the ten-minute observation showed |
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
