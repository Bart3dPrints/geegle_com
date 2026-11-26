# Account acceptance evidence

Cycle: 2026-11-26, branch `feature/geegle-auth-cloud-completion`.
Statuses: NOT STARTED, IN PROGRESS, IMPLEMENTED BUT UNVERIFIED, VERIFIED, BLOCKED.

Backends used:

- **Production-simulation backend** — local Supabase stack (Postgres 17 + GoTrue
  v2.188.1 + PostgREST 14 + Kong) with `GOTRUE_MAILER_AUTOCONFIRM=false`, the same
  confirmation requirement as production, and migration `0005` applied. Real HTTP,
  real JWTs, real RLS; nothing mocked.
- **Production** — `https://bartisawesome.onrender.com`, project
  `oizdbkxnzwatytxcrvoo`, read-only probes plus one disposable signup attempt.

## Results

| Requirement | Status | Method | Result |
| --- | --- | --- | --- |
| Root cause of the production signup failure | VERIFIED | live bundle + auth probes, then reproduction on a real GoTrue/Postgres stack | production returns `500 / 23503` on `geegle_profiles_id_fkey`; reproduced byte-identically by making the provisioning trigger `BEFORE INSERT` |
| Production deployment configuration (project URL + key) | VERIFIED | `GET /` asset scan, `GET /auth/v1/settings` | bundle contains only `oizdbkxnzwatytxcrvoo`; key accepted by that project |
| Username + password registration, no email | VERIFIED on a confirmation-required backend | `scripts/qa/check-account-completion.mjs` drives the real form | dialog closes, account button appears, session issued, profile + settings rows created, no mail sent |
| Duplicate username rejected | VERIFIED | same script, real form | "That username is already taken." |
| Case-insensitive duplicate rejected | VERIFIED | register `USER` after `user` | refused |
| Surrounding whitespace normalised | VERIFIED | register `"  user  "` | refused, no second account |
| Concurrent duplicate registration | VERIFIED | 4 parallel signups of one name | exactly one session; others `23505`, no second account |
| Invalid characters / length / empty username | VERIFIED | `validateCredentials` regex `^[a-z0-9_-]{3,32}$` on the trimmed value, plus the DB `check (char_length 3..32)` | rejected before any request |
| Invalid password | VERIFIED | submit a short password in the form | refused with a clear message |
| Login with username + password | VERIFIED | real form, landing and library | succeeds |
| Wrong password / unknown account | VERIFIED | real form and API | both `invalid_credentials`, identical wording, no account disclosure |
| No duplicate requests from Enter + click | VERIFIED | `authBusy` guard in `handleAuth` (single in-flight submit) | one request per submit |
| Session across reload | VERIFIED | reload after sign-in | still signed in |
| Session across a new tab | VERIFIED | second page in the same context | still signed in |
| Session across a full browser restart | VERIFIED | `check-session-sync.mjs` (persistent context, browser closed and reopened) | still signed in |
| Explicit logout | VERIFIED | account menu → Log out | signed out; account surfaces gone |
| Privacy after logout | VERIFIED | second account sees no first-account favorites | 0 rows |
| Password change with reauthentication | VERIFIED | Settings → Preferences: wrong current password, short new password, correct change, then logout | refused / refused / "Password updated." |
| Old password rejected after change | VERIFIED | sign-in with the old password | `Invalid username or password` |
| New password accepted | VERIFIED | sign-in with the new password | succeeds |
| Password never echoed | VERIFIED | session/user table output and scripts | only `email`/`username`/`id` are read; passwords are not printed or stored |
| Favorites sync per account | VERIFIED | `auth-check.mjs` favorite + reload, isolation on account B | persisted; B sees 0 |
| Recently Played visibility preference | VERIFIED | Settings → Preferences, reload | persisted |
| Appearance + tab identity sync to a fresh browser | VERIFIED | `check-session-sync.mjs` | background `rgb(32,32,32)` and tab title follow the account |
| Account data isolation (reads) | VERIFIED | A queries B's favorites, profile, settings | 0 rows |
| Account data isolation (writes) | VERIFIED | A inserts favorite/save with B's `user_id` | refused `42501` |
| Account isolation (update/delete) | VERIFIED | A patches B's settings, deletes B's favorites | 0 rows affected |
| Authorization derives from the session, not the body | VERIFIED | the same requests carry A's JWT and B's id in the payload/query; all are refused by RLS | refused |
| Game-frame isolation from tokens and other data | BLOCKED | storage guard + shim exist; real origin isolation needs separate-origin hosting (owner infrastructure) | not demonstrated |
| Automatic cloud save + restore (2048) | VERIFIED | `check-cloud-save.mjs` | saved, restored in a fresh browser, absent for another account |
| Cloud-save conflict detection | BLOCKED on production | production lacks `geegle_game_saves.revision` (migration 0002) | `42703` live |
| Other game engines | IMPLEMENTED BUT UNVERIFIED | see `docs/CLOUD_SAVE_VERIFICATION.md` | only `cl2048` verified end to end |
| Production safeguard runs on deploy | VERIFIED | `Procfile` runs the gate between build and serve; three-way local test | isolated → exit 1; correct build → exit 0; mismatched key → exit 1 |
| No privileged key in the public bundle | VERIFIED | gate decodes every JWT in the artifact | no `service_role` |
| Automatic account deletion disabled | VERIFIED (repository) | no deletion job or scheduled function in `supabase/migrations` or `src` | none exists; production `pg_cron` not inspectable from here |
| Registration on the live site | BLOCKED | live `POST /auth/v1/signup` | `500 / 23503` until migration 0005 is applied |
| Login on the live site | BLOCKED | no confirmed account exists to sign in with (every Geegle account there failed to confirm) | pending 0005 backfill |
| Production acceptance (§16) | BLOCKED | depends on the owner applying 0005 and deploying | see `docs/PRODUCTION_AUTH_HANDOFF.md` §4 |

## Command transcript (abridged)

```
$ node --env-file=.env.qa.local scripts/qa/check-account-completion.mjs
21/21 account checks passed

$ GEEGLE_AUTH_BASE=http://127.0.0.1:5174 node --env-file=.env.qa.local scripts/qa/auth-check.mjs
14/14 auth checks passed

$ GEEGLE_AUTH_BASE=http://127.0.0.1:5174 node --env-file=.env.qa.local scripts/qa/check-session-sync.mjs
5/5 session/sync checks passed

$ node --env-file=.env.qa.local scripts/qa/check-password-change.mjs
6/6 password checks passed

$ GEEGLE_AUTH_BASE=http://127.0.0.1:5174 node --env-file=.env.qa.local scripts/qa/check-cloud-save.mjs
6/6 cloud-save checks passed

$ npm run typecheck        # exit 0
$ npm run lint             # exit 0
$ bun test tests           # 71 pass, 0 fail
$ npm run build            # exit 0
$ node scripts/qa/interface-check.mjs   # 54/54, exit 0
$ GEEGLE_EXPECT_PRODUCTION=1 node scripts/qa/check-production-env.mjs   # on an isolated build: exit 1 by design
```

## What is explicitly not claimed

- No hosted-project test was used to prove registration; the local Supabase stack
  was used because the hosted isolated project cannot be migrated from here and
  its mailer rate limit (`429`) blocks signup attempts.
- The live site has not been verified to create accounts or sign anyone in. That
  is `BLOCKED` until `0005` is applied.
- Game-frame origin isolation is not demonstrated.
