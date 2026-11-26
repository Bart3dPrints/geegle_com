# Changelog generation

Settings → Changelog lists real releases, newest first. It is generated from
this repository's merged pull requests and needs no account.

## What produces an entry

`npm run build` runs `node scripts/generate-changelog.mjs && vite build`. The
script asks the GitHub REST API for this repository's closed pull requests
(`Bart3dPrints/geegle_com`), paginating to the end, and keeps only entries with
a `merged_at` timestamp. A pull request that was closed or rejected without
being merged has no such timestamp and therefore never appears.

`npm run build` is the Render build command, so every deployment that follows a
merge already contains that merge's entry. Nothing is committed back to the
repository: there are no bot commits, no recursive workflow triggers and no
GitHub credential in the browser.

## Guarantees

| Rule | Where it is enforced |
| --- | --- |
| Only merged work is listed | `mergedPullEntries` in `src/lib/changelog.ts` drops anything without `merged_at` |
| One entry per pull request | Entries are keyed by PR number; a repeated number collapses to one |
| Newest first | Sorted by merge time descending, then PR number |
| No invented release notes | A short note can be written in `scripts/changelog-notes.json` keyed by PR number; otherwise the PR title is used |
| No credential exposure | Unauthenticated public API; an optional `GITHUB_TOKEN` is read only in the build environment |
| A failed lookup cannot break a deploy | Any error keeps the committed snapshot and exits 0 |
| No internal detail | Notes are reviewed copy; the script and UI never print prompts, logs or database identifiers |

## Files

- `scripts/generate-changelog.mjs` — the generator, also importable logic via
  `src/lib/changelog.ts` (bundled with esbuild) so the UI and the build share
  one definition.
- `scripts/changelog-notes.json` — optional, human-written summaries per PR.
- `src/data/changelog.json` — the committed snapshot the app bundles.
- `src/components/Changelog.tsx` — the list in Settings, dates in Eastern Time
  (`America/New_York`, so EST/EDT follows the release date).

## Adding a release

1. Merge the pull request into `main`.
2. Deploy as usual. The build regenerates the snapshot, and the new entry
   appears under Settings → Changelog with its merge date and time.
3. Optionally add a shorter, user-facing sentence to `scripts/changelog-notes.json`
   under the PR number; the next build picks it up.

## Verified

- The generator ran against the live API: 8 merged releases written, PRs 1–8,
  with PR #8 at `November 26, 2026 · 2:56 PM EST`.
- `tests/changelog.test.mjs`: unmerged pulls excluded, duplicate PR numbers
  collapsed, newest first, DST boundary correct (`1:59 AM EST` → `3:01 AM EDT`
  on 2026-03-08), committed history matches the merged PRs.
- `interface-check.mjs`: Changelog is the last Settings tab, lists 8 releases
  newest first, newest shows `November 26, 2026 · 2:56 PM EST`, no duplicate
  entry, plain text with no badges.

**Limitation:** a future merge is covered by the generator being run on the
deployment build and by unit tests over the merge rules; this branch cannot
demonstrate an entry for a PR that does not exist yet. The first post-merge
deployment is the end-to-end proof.
