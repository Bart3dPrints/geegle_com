# Run 1 verification

Branch `feature/geegle-run1-settings-personalization`, based on `main`
`342609b` (PR #14 merged). Pull request #15.

## Automated checks

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Production build | `npm run build` | exit 0 |
| Unit and regression tests | `bun test tests` | 148 pass, 0 fail, 22 files |
| Browser acceptance | `node scripts/qa/run1-interface-check.mjs` | 48/48 |
| Artwork integrity (inside the suite) | `tests/artwork-integrity.test.mjs` | decodable WebP, no unrelated shared art |
| Artwork mapping | `node scripts/map-artwork.mjs` | 3 licensed + 2,681 captured records |
| Artwork audit | `python3 scripts/artwork/audit-artwork.py` | 0 broken files |
| Artwork coverage | `python3 scripts/artwork/report.py` | 2,678 of 2,710 (98.8%) |

## Browser acceptance detail

Chromium drove the real application at `http://127.0.0.1:5173`.

**Navigational rail.** At 1024×600, 1280×720, 1366×768, 1440×900 and
1920×1080 the rail contained all 28 entries in order (FAV, #, A–Z); the first
and last entries were inside the viewport and the rail reported no internal
scroll. Measurements were taken from the rendered page, not from CSS alone.

**Settings window.** Theme, Appearance, Preferences, Tab appearance and
Changelog each measured 640.0 × 672.0 px at 1440×900. The window fits 1024×600
(568 × 672) and 390×844 (640 × 358) with no horizontal scrolling, and its
content scrolls internally. Closing it animates out (opacity observed mid-exit)
rather than disappearing.

**Personalization.** An accent preset set `--geegle-accent` and the active
chip's computed background to the same colour with white text for contrast. A
typeface change altered the computed body font, a text colour change altered
the computed body colour, and an uploaded image was re-encoded to WebP, applied
behind a scrim and recorded in the stored appearance. Clock and date widgets
rendered in the header while the header height stayed 193.5 px. All of it
survived a reload.

**Resets.** "Reset all personalization" cleared the inline accent and text
variables, restored the default font, removed the wallpaper and hid the
widgets. A favorited game (id recorded) remained favorited with its Starred card
present.

**Account.** Two disposable accounts were registered on the isolated backend.
The dropdown showed Preferences then Sign out, Preferences opened the account
section, the current password was required, a wrong current password was
rejected, the correct one changed the password, the new password then signed in,
and the second account did not inherit the first account's accent.

**Changelog.** Fourteen merged releases appeared newest first and reversed to
oldest on request; the explanatory sorting sentence is gone.

**Preserved behaviour.** Fuzzy search still filtered to a small result set, the
Apps view still rendered its cards, and alphabetical sections collapsed and
expanded.

## Database changes

Only the isolated test project `wkdlsaydqyymynoipmhl` changed: migration 0005
(the repository's existing signup-confirmation migration) was applied so
username-only test registration does not need a mailbox. Production
`oizdbkxnzwatytxcrvoo` was not written to.

## Artwork phase

Every one of the 57 previously unresolved titles was searched again with at
least two independent queries and reviewed beyond the first three results
(`--per-query 8`). 19 images matched closely enough to use; the rest remain
without artwork rather than being mislabelled. Soundboard now uses the
owner-supplied cover image. Details and per-title reasons are in
`docs/ARTWORK_COMPLETION_REPORT.md` and `scripts/artwork/no-artwork.json`.

## Not verified / remaining

- The 31 titles still without artwork, and the local-capture fallback for them.
- Live production (Render): Run 1 was not deployed from this branch.
- Real two-device synchronization; account preference sync was verified across
  reload on one device.
