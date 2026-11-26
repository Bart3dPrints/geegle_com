# Account acceptance evidence

Cycle: 2026-11-26, branch `feature/geegle-account-cloud-final` from `7fe74b0`.
Statuses: NOT STARTED, IN PROGRESS, IMPLEMENTED BUT UNVERIFIED, VERIFIED, BLOCKED.

Environments:

- **production** — `https://bartisawesome.onrender.com` against project
  `oizdbkxnzwatytxcrvoo` (the deployed bundle is from `main` at `7fe74b0`).
- **local** — local Supabase stack with `GOTRUE_MAILER_AUTOCONFIRM=false` and
  migrations 0002/0005/0006, app served by `vite --mode qa` on 127.0.0.1:5174.

All accounts below were created for the test with randomized usernames and
passwords and are disposable. No existing account was touched and no credential is
recorded in the repository.

## Results (production unless stated)

| Requirement | Status | Method | Result |
| --- | --- | --- | --- |
| Registration through the real form | VERIFIED | `scripts/qa/production-acceptance.mjs` | account created, session issued, interface switches to signed-in |
| Actual Supabase Auth user | VERIFIED | `/auth/v1/user` as the new account | user id returned |
| Profile row | VERIFIED | `geegle_profiles` select as the account | username matches (lower-cased) |
| Preferences row | VERIFIED | `geegle_user_settings` select | one row |
| Login | VERIFIED | form, after logout | succeeds |
| Explicit logout | VERIFIED | account menu → logout action | signed out |
| Subsequent login | VERIFIED | form | succeeds |
| Duplicate username | VERIFIED | register the same name | "That username is already taken." |
| Case-insensitive duplicate | VERIFIED | register the upper-cased name | refused |
| Concurrent duplicate registration | VERIFIED | two simultaneous `signUp` calls for one new name | exactly one session; the other request is refused (`500` from GoTrue's unique violation, sanitized) |
| Password change with reauthentication | VERIFIED | Settings → Preferences | wrong current refused, correct accepted |
| Incorrect password rejected | VERIFIED | old password after the change | `Invalid username or password` |
| Session across refresh | VERIFIED | reload | still signed in |
| Session across a full browser restart | VERIFIED | browser closed, relaunched with the stored profile | still signed in |
| Session token refresh | VERIFIED | `refreshSession()` then a profile read with the new token | new access token reads the same profile |
| Account isolation — reads | VERIFIED | A queries B's favorites, saves, profile, preferences | 0 rows |
| Account isolation — writes | VERIFIED | A inserts with B's `user_id` | `42501` |
| Account isolation — update/delete | VERIFIED | A patches/deletes B's rows | 0 rows affected |
| Save revision rotation and stale rejection | VERIFIED | `production-data-integrity.mjs` | revision rotates, stale write matches 0 rows, newer data survives |
| Favorites, appearance, Recently Played sync | VERIFIED | set values, discard storage, sign in | restored (`rgb(32, 58, 47)`, stars) |
| Account-based game storage capture/restore | VERIFIED (mechanism) | storage written in the game frame, profile destroyed, sign in | value restored before launch; second account receives `null` |
| Genuine gameplay save/restore | NOT VERIFIED — see `docs/CLOUD_SAVE_VERIFICATION.md` | real input in four games | none of them wrote progress of its own; each reason is recorded |
| Game-frame origin isolation | BLOCKED | same-origin iframe architecture | a storage guard is not a security boundary; needs separate-origin hosting |
| Account deletion stays disabled | VERIFIED (repository) | no deletion job or scheduled function in `supabase/migrations` / `src` | none exists |

## Interface corrections in this cycle

| Requirement | Status | Evidence |
| --- | --- | --- |
| Account dropdown holds exactly one action, `Sign out` | IMPLEMENTED, verified locally | `tests/account-menu.test.mjs` (8 tests) + `scripts/qa/interface-check.mjs`; production check `4b-4g` is staged behind `GEEGLE_EXPECT_NEW_MENU=1` because the deployed bundle predates the change |
| Settings entry removed from the dropdown only | IMPLEMENTED, verified locally | the header Settings button is unchanged and still follows the wordmark |
| Dropdown sits under the avatar, outside click and Escape close it | IMPLEMENTED, verified locally | production check `4e-4g` when the flag is set; local `interface-check` passes |
| Wordmark ~30-40% larger, licensed geometric typeface | IMPLEMENTED, verified locally | 16px → 22px (+37.5%), Poppins Medium (SIL OFL 1.1, `public/fonts/`), header height unchanged (194px at both sizes), `docs/qa/wordmark-header.png` and `wordmark-header-mobile.png` |

## Command transcript (fresh, this cycle)

```
$ node --env-file=.env.prod.local scripts/qa/production-acceptance.mjs
24/24 production acceptance checks passed

$ node --env-file=.env.prod.local scripts/qa/production-data-integrity.mjs
17/17 production data-integrity checks passed

$ node --env-file=.env.prod.local scripts/qa/production-cloud-saves.mjs
22/22 gameplay cloud-save checks passed (3 skipped with evidence)

$ GEEGLE_AUTH_BASE=http://127.0.0.1:5174 node --env-file=.env.qa.local scripts/qa/auth-check.mjs
14/14   (local backend)

$ … check-session-sync.mjs      5/5
$ … check-password-change.mjs   6/6
$ … check-account-completion.mjs 21/21
$ … check-cloud-save.mjs        6/6
$ node scripts/qa/interface-check.mjs
all checks pass (landing, library, player, settings, wordmark, viewports)

$ npm run typecheck              exit 0
$ npm run lint                   exit 0
$ bun test tests                 83 pass, 0 fail
$ npm run build                  exit 0
$ node --env-file=.env.prod.local node_modules/vite/bin/vite.js build   exit 0
$ npm run check:prod-build       PASS (production project, key accepted, no privileged key)
```

## Not claimed

- The account-dropdown and wordmark changes are not yet on production: the
  deployed bundle predates this branch. They are verified on the built artifact.
- Genuine gameplay save and restore is not verified for any game; the mechanisms
  are verified, the games' own persistence is not.
- Game-frame origin isolation is not implemented.
