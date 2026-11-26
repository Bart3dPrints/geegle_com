# Account acceptance evidence

Cycle: 2026-11-26, branch `fix/production-account-repair`.
Statuses: NOT STARTED, IN PROGRESS, IMPLEMENTED BUT UNVERIFIED, VERIFIED, BLOCKED.

Environments:

- **production** — `https://bartisawesome.onrender.com` against project
  `oizdbkxnzwatytxcrvoo`, deployed bundle `/assets/index-C72ESc1B.js`.
- **local** — local Supabase stack (Postgres 17 + GoTrue 2.188.1 + PostgREST 14)
  with `GOTRUE_MAILER_AUTOCONFIRM=false` and migrations 0002/0005/0006 applied.

All accounts used below were created for the test with randomized usernames and
passwords and are disposable. No existing account was touched, and no credential
is recorded in the repository.

## Results

| Requirement | Status | Environment | Method | Result |
| --- | --- | --- | --- | --- |
| Registration (username + password only) | VERIFIED | production | `scripts/qa/production-acceptance.mjs` drives the real form | account created, session issued, interface switches to signed-in |
| Profile + preferences row created | VERIFIED | production | authenticated query as the new account + DB read | `geegle_profiles.username` matches, one `geegle_user_settings` row |
| No email / phone / third party required | VERIFIED | production | sign-up payload contains only username, password and display metadata | accepted |
| Duplicate username rejected | VERIFIED | production | register the same name through the form | "That username is already taken." |
| Case-insensitive duplicate rejected | VERIFIED | production | register `USERNAME` after `username` | refused |
| Whitespace normalised | VERIFIED | local | register `"  name  "` | refused, no second account |
| Concurrent duplicate registration | VERIFIED | local + production DB | parallel sign-ups of one name | exactly one account; the rest `23505` on `users_email_partial_key` |
| Invalid characters / length / empty | VERIFIED | local | client regex + DB `check (3..32)` | rejected before any request |
| Invalid password | VERIFIED | production | short password in the form | refused |
| Login from landing page and library | VERIFIED | production | both surfaces | succeeds |
| Wrong password / unknown account | VERIFIED | production | form and API | `invalid_credentials`, identical wording, no account disclosure |
| No overlapping submissions | VERIFIED | production | single in-flight guard | one request per submit |
| Session across refresh | VERIFIED | production | reload | still signed in |
| Session across new tab | VERIFIED | production | second page, same context | still signed in |
| Session across full browser restart | VERIFIED | production | browser closed, relaunched with the stored profile | still signed in |
| Explicit logout | VERIFIED | production | account menu → Log out | signed out, account surfaces gone |
| Password change requires current password | VERIFIED | production | Settings → Preferences | wrong current refused; correct accepted ("Password updated.") |
| Old password rejected / new accepted | VERIFIED | production | sign-in attempts after the change | old `Invalid username or password`, new signs in |
| Favorites sync | VERIFIED | production | star a game, clear storage, sign in again | restored |
| Recently Played visibility | VERIFIED | production | toggle in Preferences, persisted | restored |
| Appearance (background colour) sync | VERIFIED | production | set `#203a2f`, clear storage, sign in | `rgb(32, 58, 47)` restored |
| Game progress save + restore | VERIFIED | production | play path, automatic sync, cleared storage, relaunch | value restored in the game frame |
| Save revision rotation | VERIFIED | production | accepted write vs stale write | revision rotates; stale revision matches 0 rows; newer data survives |
| Account isolation — reads | VERIFIED | production | A queries B's favorites, saves, profile, settings while B's rows exist | 0 rows |
| Account isolation — writes | VERIFIED | production | A inserts with B's `user_id` | `42501` |
| Account isolation — update/delete | VERIFIED | production | A patches B's settings/saves, deletes B's favorites | 0 rows affected |
| Authorization comes from the session | VERIFIED | production | A's JWT with B's id in payload/query | refused |
| Anonymous cannot reach Geegle tables | VERIFIED | production | `has_table_privilege('anon', …)` after migration 0006 | no privileges, RPC not executable |
| Shared project unaffected | VERIFIED | production | trigger/constraint/policy review | other app's trigger intact, its RLS untouched, `is_admin()` unreachable for Geegle accounts |
| Account deletion disabled | VERIFIED (repository) | — | no deletion job, no scheduled function in `supabase/migrations` or `src` | none exists; production `pg_cron` not inspectable through the integration |
| Game-frame origin isolation | BLOCKED | — | same-origin iframe architecture | a storage guard is not a security boundary; needs separate-origin hosting |
| Other game engines' saves | IMPLEMENTED BUT UNVERIFIED | production | see `docs/CLOUD_SAVE_VERIFICATION.md` | only `cl2048` has a verified capture/restore path |

## Command transcript (fresh, this cycle)

```
$ node --env-file=.env.prod.local scripts/qa/production-acceptance.mjs
22/22 production acceptance checks passed

$ node --env-file=.env.prod.local scripts/qa/production-data-integrity.mjs
17/17 production data-integrity checks passed

$ node --env-file=.env.qa.local scripts/qa/check-account-completion.mjs
21/21 account checks passed                (local backend, after migrations)

$ npm run typecheck     # exit 0
$ npm run lint          # exit 0
$ bun test tests        # 71 pass, 0 fail
$ npm run build         # exit 0
$ npm run check:prod-build   # FAIL on the isolated artifact, exit 0 outside release mode
                             # (exit 1 with GEEGLE_EXPECT_PRODUCTION=1, verified earlier)
```

## Live production evidence (sanitized)

- Bundle `/assets/index-C72ESc1B.js` contains `oizdbkxnzwatytxcrvoo` only, no
  isolated reference, no privileged key.
- `POST /auth/v1/signup` now returns `200` with a session; before the migration it
  returned `500 / 23503`.
- Duplicate sign-up returns `200` with a sanitized user that has no identities and
  no session; the client reports the username as taken.
- `GET /auth/v1/settings` reports `mailer_autoconfirm: false`; registration works
  anyway because only the Geegle namespace is confirmed at insert time.

## Not claimed

- Game-frame origin isolation is not implemented.
- Cloud saves are not verified for engines other than the `cl2048` capture path.
- The production database has no restorable backup entry, so rollback relies on
  the documented reverse migrations.
