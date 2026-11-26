# Catalog Restoration Report

Date: 2026-11-26
Branch: `feature/geegle-catalog-restoration`
Base: `44494cd8091a1d8204589bcf6f1f7cbb245920ae` (PR #9 merged)
Historical reference: `2d09055cf7e7f7031a9d0b24e78670b428782ed8`

## Why this report exists

The owner reversed the earlier duplicate-removal policy. Games must not be
removed because they share a title, a similar title, an identical file, the
same hash, or because they are alternate builds of one game. This report
accounts for every historical catalog entry and every game file discovered
during the audit.

## Method

1. Read all `{ id, name, url }` entries from `src/App.tsx` at the historical
   reference (2,697 entries).
2. Compared those IDs with every row in `src/data/raw/*.txt`, treating
   `restored.txt` as output rather than input (see the script fix below).
3. Compared every historical `/games/...` URL with the current
   `public/games` listing, case-insensitively.
4. Searched the full Git history (`git log --all -- public/games/<file>`)
   for each missing file and attempted `git show <commit>:<path>` recovery.
5. Walked the dedupe commits that changed the raw catalog, especially
   `6ab170e` ("Remove confirmed duplicate Snow Rider entries").
6. Ran `scripts/restore-catalog.mjs` twice to prove idempotency, then read
   every restored row and launch path.

## Counts

| Metric | Count |
| --- | --- |
| Catalog entries before this branch | 2,711 |
| Historical entries at 2d09055 | 2,697 |
| Historical entries already restored in `restored.txt` | 89 |
| Historical entries newly restored by this pass | 0 |
| Legitimate game entries missing from the catalog | 0 |
| Historical rows intentionally excluded (apps, proxies, themes, removed chatbot) | 16 |
| Deleted game files recovered from Git history | 0 |
| Rows whose local launch file is missing and was never committed | 5 |
| Explicitly removed Polytrack entries | 1 |
| Catalog entries after this branch | 2,710 |
| Game HTML files on disk | 2,856 |

The catalog is two rows smaller than the previous 2,711 only because
`clpolytrackbutnotflagged-1` ("Poly Track") is the owner-authorized removal.
No other row was dropped.

## The 16 historical rows that are not in the catalog

These are excluded by `scripts/restore-catalog.mjs` because they were never
games, or because the owner removed them earlier:

| Historical ID | Historical title | Reason |
| --- | --- | --- |
| `suggestions` | Suggestions | interface page |
| `code-editor` | Code Editor | app |
| `soundboard` | Soundboard | app |
| `chat-bot` | Chat Bot (A.I) | removed chatbot; contract forbids revival |
| `celestial`, `doge`, `heilos`, `lucide`, `xylora`, `vapor`, `voidproxy1` | proxy pages | own Proxies section, not Games |
| `proxy1`, `proxy2`, `proxy3` | proxy pages | own Proxies section |
| `nikehub` | Nikehub | page, not a game |
| `peach` | Peach | theme/page file |

## Duplicate-removal commits investigated

`6ab170e` removed five Snow Rider rows from `s1.txt`:

| Historical ID | Historical title | Removal reason | Restoration status | Current launch file | Browser verification |
| --- | --- | --- | --- | --- | --- |
| `clsnowrideee` | Snow Rider | identical-build dedupe | restored (row kept) | `/games/clsnowrideee.html` | not part of the four required builds; file is a Polytrack wrapper (see note) |
| `clsnowrider` | Snow Rider | identical-build dedupe | present with original ID | `/games/clsnowrider.html` | PASS |
| `clsnowridergoodygumdrops` | Snow Rider: Goody Gumdrops | identical-build dedupe | restored (row kept) | `/games/clsnowridergoodygumdrops.html` | FAIL — wrapper is a "Play on Cookie Love" redirect, no game build |
| `clsnowriderrrr` | Snow Rider (Alt) | identical-build dedupe | restored (row kept) | `/games/clsnowriderrrr.html` | PASS |
| `clsnowrid` | Snowrid | identical-build dedupe | restored (row kept) | `/games/clsnowrid.html` | not part of the four required builds; file is a Polytrack wrapper (see note) |

The required four Snow Rider IDs remain distinct and available. Two of them
previously launched an external `gamebiz.com` page; both now use the local
builds that were already in the repository, so the entries are playable
inside the Geegle player rather than being portal redirects.

Note: `clsnowrideee.html` and `clsnowrid.html` are misnamed historical files
that actually load a Polytrack build from jsDelivr. They were left in place
because the owner reversed duplicate removal and this report must not delete
entries. They are not counted as verified Snow Rider builds, and they do not
make the excluded Poly Track files reachable.

## Script defects fixed

`scripts/restore-catalog.mjs` previously:

1. treated `restored.txt` as part of the existing catalog, then overwrote it
   with only the newly discovered rows, so a re-run could quietly delete
   previously restored entries; and
2. skipped any historical entry whose file had been deleted.

Both are fixed. The script now:

- reads `restored.txt` only as previous output and carries those rows forward;
- excludes `restored.txt` from the "already catalogued" input set;
- writes the union of previous and newly discovered rows, sorted by title;
- recovers a deleted build with `git show` when any commit ever contained it;
- records entries whose file never existed in history instead of inventing
  them;
- excludes `clpolytrackbutnotflagged`, `clpolytrackbutnotflagged-1` and
  `clpolytrackbutnotflagged(1)` before any restoration can return them.

`tests/catalog-restoration.test.mjs` runs the script twice and asserts the
row count never changes.

## Rows with a missing launch file (blocked, not invented)

These five catalog rows point at files that are absent and that no commit in
this repository ever contained, so they cannot be recovered:

| ID | Title | Launch path | Blocker |
| --- | --- | --- | --- |
| `clkengriffeyjr` | Ken Griffey Jr. Baseball | `/games/clkengriffeyjr.html` | file never committed; no authorized source |
| `clu-can-t-believe` | Uvuvwevwevwe Onyetenvewve | `/games/clu-can-t-believe.html` | file never committed |
| `clgdwaveover100mb` | GD Wave (100MB+) | `/games/clgdwaveover100mb.html` | file never committed; oversized build |
| `clprecisionclient` | Precision Client | `/games/clprecisionclient.html` | file never committed |
| `clundertale-gameboy-1` | Undertale (Gameboy) | `/games/clundertale-gameboy-1.html` | file never committed |

`tests/catalog-audit.test.mjs` keeps these five as the only allowed
unresolved IDs. No placeholder HTML was created for them.

## Stable identity preserved

- No historical ID was regenerated, merged or renamed.
- HOBO titles changed to their real subtitles while the seven IDs stayed the
  same (`clhobo` … `clhobo7`).
- Snow Rider titles and local paths changed under the original IDs
  (`clsnowrider`, `snow-rider`, `clsnowridergoodygumdrops`,
  `clsnowriderrrr`).
- Existing favorites, Recently Played and account saves key on those IDs, so
  no saved reference is orphaned by the title corrections.

## Polytrack exception

Only `clpolytrackworksnow` ("Polytrack (working)") is visible. The unwanted
`clpolytrackbutnotflagged-1` row and its path exception were deleted, both
unwanted files are hidden in `scripts/catalog-overrides.json`, and
`src/data/catalog.ts` filters the unwanted IDs at runtime so search,
categories, Recently Played and Starred cannot display them even if saved
data still references the ID. No game-save record was deleted.
