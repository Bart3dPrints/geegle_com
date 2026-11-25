# Pokémon & GBA Emulator Infrastructure

Geegle ships a generic EmulatorJS-backed player so **you** can supply authorized
GBA game files. No ROMs are included in this repository.

## How to add a game file

1. Place your authorized `.gba` file in `public/games/roms/` (this folder is
   git-ignored; add game files through the Render dashboard or your own fork —
   do NOT commit ROMs to GitHub).
2. Create a launcher `public/games/<game-id>.html` using the template in
   `supabase/emulator-template.html`:
   ```html
   <script>
     EJS_player = '#game';
     EJS_core = 'gba';
     EJS_gameUrl = '/games/roms/<your-file>.gba';
     EJS_pathtodata = 'https://cdn.jsdelivr.net/gh/EmulatorJS/EmulatorJS@latest/data/';
   </script>
   <script src="https://cdn.jsdelivr.net/gh/EmulatorJS/EmulatorJS@latest/data/loader.js"></script>
   ```
3. Register the game in the catalog: add one line to `src/data/raw/p.txt`
   (`id|Title|pokemon`) and, if the launch filename differs from
   `/games/<id>.html`, one line to `path-exceptions.txt`.

## Identifiers

Use the official title as the stable ID, e.g. `pokemon-emerald`.
Do not reuse IDs; favorites and cloud saves key on them.

## Cloud saves

EmulatorJS persists battery saves and save states into the page's own
IndexedDB (`ejs-*` databases) because it runs inside the Geegle-origin
launcher. The universal save adapter captures those databases losslessly
(schema, key paths, indexes, binary values, typed arrays, Blobs) and the
15-second cloud sync uploads them, so:

- **Battery saves** (in-game `SAVE`) sync automatically.
- **Save states** (EmulatorJS save/load state menu) sync automatically.

Sign in → play → progress syncs every 15 seconds and on exit. Sign in on any
device → progress restores before the game launches.

## Manual export / import

The generic adapter snapshots IndexedDB, so battery saves and states can also
be moved manually: use the player's Save to Cloud / Restore from Cloud
buttons. Raw `.sav` export/import is not exposed — EmulatorJS keeps its save
data inside IndexedDB, and the adapter syncs that directly.

## Categorization

All registered Pokémon games must carry the `pokemon` category (plus `rpg`
where appropriate) so they appear under the Pokémon category and in search
(`pokmon`, `pokemon`, game titles, aliases).
