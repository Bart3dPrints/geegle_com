# Production authentication handoff (internal engineering note)

Production: `https://bartisawesome.onrender.com` (Render, static build served by
`npx serve dist`).
Project under test: `oizdbkxnzwatytxcrvoo` (`https://oizdbkxnzwatytxcrvoo.supabase.co`).
Isolated test project: `wkdlsaydqyymynoipmhl`.
Investigated 2026-11-26 after the owner updated the Render environment variables.

No credentials, tokens or user data are recorded here.

## 1. What the live site does now

| Probe | Result |
| --- | --- |
| `GET /` | 200, bundle `/assets/index-BkXO0FIe.js`, `last-modified: 2026-11-26 04:35 UTC` |
| Project reference in the deployed bundle | `https://oizdbkxnzwatytxcrvoo.supabase.co` only — the isolated ref is gone |
| Public key in the bundle | `sb_publishable_zRLU8…` (public publishable key, no `service_role`) |
| `GET /auth/v1/settings` for that URL + key | 200, so the URL and key belong to the same project |
| `POST /auth/v1/signup` with a disposable synthetic account | **HTTP 500 `23503`** — see below |
| `GET /rest/v1/geegle_*` as anon | 200 with `[]` for every table (RLS holds) |

The environment-variable problem from the previous cycle **is fixed**: Render did
rebuild, and the correct project is compiled in. The remaining failure is in the
database, not in the deployment configuration.

## 2. The actual cause (verified, reproducible)

Signup returns:

```
{"code":"23503",
 "message":"insert or update on table \"geegle_profiles\" violates foreign key constraint \"geegle_profiles_id_fkey\"",
 "detail":"Key (id)=(3aacf448-…) is not present in table \"users\"."}
```

The frontend can only show its fallback message for an unrecognised reply, which
is the owner's `Something went wrong. Please try again.`

Reproduced exactly, on a real GoTrue + Postgres stack, in `supabase/migrations`
order:

1. Correct schema (trigger `AFTER INSERT`), project with
   `mailer_autoconfirm = false`: signup → **HTTP 500 `Error sending confirmation
   email`**, because GoTrue asks the mailer to confirm `…@users.geegle.internal`,
   a domain that can never receive mail. (The hosted isolated project answers
   `429 over_email_send_rate_limit` for the same reason.)
2. Trigger changed to `BEFORE INSERT`, i.e. the production shape: signup →
   **HTTP 500 `23503`, byte-identical to production**.

So production has two independent defects:

- **D1 (why the button fails):** the profile row is inserted before the
  `auth.users` row exists, so the foreign key rejects it and GoTrue aborts the
  whole signup with 500.
- **D2 (why a fixed trigger alone would still not sign anyone in):** the shared
  project requires email confirmation, and username-only accounts have no
  mailbox. `signUp` then returns a user without a session, which is unusable.

`mailer_autoconfirm` is `false` on both hosted projects. Every earlier "isolated
authentication passes" run used `signInWithPassword` on accounts that already
existed, and the local stack used for development had `GOTRUE_MAILER_AUTOCONFIRM=true`.
That is how this reached production.

## 3. The fix (branch `feature/geegle-auth-cloud-completion`)

`supabase/migrations/0005_geegle_signup_confirmation.sql`, plus client changes:

- Recreates `geegle_profiles_id_fkey` against `auth.users(id) on delete cascade`
  (repairs a constraint that drifted to another table) and recreates
  `geegle_on_auth_user_created` as `AFTER INSERT`.
- Adds a `BEFORE INSERT` trigger on `auth.users` that sets `email_confirmed_at`
  only for `%@users.geegle.internal`, only when it is still null.
  GoTrue reloads the row after insert and, when it is already confirmed, skips
  the confirmation mail and issues a session (`supabase/auth internal/api/signup.go`).
  No project-wide setting changes; real addresses of the other application keep
  their confirmation requirement.
- Adds a case-insensitive unique index on `lower(username)`.
- Backfills `email_confirmed_at`, `geegle_profiles` and `geegle_user_settings`
  for existing Geegle accounts. Nothing is deleted, recreated or re-passworded.
- Client: duplicate usernames (422, sanitized 200, or a 23505 race) all report
  "That username is already taken."; 5xx is reported as a service problem instead
  of the generic fallback; double submits are ignored; the typed capitalisation is
  kept for display while the stored identity stays lowercase; password change now
  reauthenticates with the current password.

## 4. Owner approval request (one group, in this order)

### 4.1 Apply `0005_geegle_signup_confirmation.sql` — required

- **Where:** Supabase dashboard → project `oizdbkxnzwatytxcrvoo` → SQL Editor
  (or `supabase db push` against that project).
- **Current setting:** the trigger exists but inserts before the user row; the FK
  target is printed by the migration's first `RAISE NOTICE`.
- **Why:** it is the cause of the 500 on every signup.
- **Effect on the other application:** none for its own users. The only objects
  added or replaced are Geegle's own trigger, FK, index and function; the new
  confirmation trigger touches rows whose email ends in `@users.geegle.internal`
  and nothing else.
- **Expected outcome:** signup returns 200 with a session; existing Geegle
  accounts become confirmed.
- **Rollback:**

  ```sql
  drop trigger if exists geegle_confirm_synthetic_email on auth.users;
  drop function if exists public.geegle_confirm_synthetic_email();
  drop index if exists public.geegle_profiles_username_lower_key;
  -- the provisioning trigger and FK are restored by re-running 0001
  ```

- **Prerequisite:** take a backup (Supabase → Database → Backups) before running.

### 4.2 Apply `0002_game_save_revision.sql` — required for save conflicts

`revision` is missing in production (`select=revision` → `42703`), so the conflict
detection in `src/lib/cloudSaves.ts` cannot work there. Non-destructive: adds one
column with a default and one `BEFORE UPDATE` trigger on `public.geegle_game_saves`.

### 4.3 `0003_entry_gate_pgcrypto.sql` — already applied, now unnecessary

`rpc/geegle_verify_entry_password` answers 200 in production, but the entry gate
was removed from the interface. It is callable by `anon` and writes a rate-limit
row per call. Recommended cleanup once the owner approves (not part of 0005, and
not applied by this branch):

```sql
drop function if exists public.geegle_verify_entry_password(text, text);
drop table if exists public.geegle_entry_attempts;
drop table if exists public.geegle_entry_config;
```

### 4.4 `0004_api_grants.sql` — optional, idempotent

Production already answers authenticated/anon reads with RLS-filtered `200`, so
the grants are effectively in place. Running 0004 only makes them explicit.

### 4.5 Deployment safeguard — no action needed

`Procfile` now runs `npm run build && GEEGLE_EXPECT_PRODUCTION=1 node
scripts/qa/check-production-env.mjs && npx serve dist`. The gate inspects the
built `dist/assets/*.js`, not the shell environment, and fails the deploy when the
isolated project is compiled in, when placeholders are compiled in, when the
public key does not belong to the project URL, or when a privileged key is in the
bundle. Verified in all three directions locally (isolated → exit 1; correct
production build → exit 0; production URL with the isolated key → exit 1 with
`auth settings returned 401`).

**One thing to confirm on Render:** a service-level *Start Command* overrides the
`Procfile`. If the `geegle` service has one set (Settings → Build & Deploy → Start
Command), replace it with the same chain:

```
npm run build && GEEGLE_EXPECT_PRODUCTION=1 node scripts/qa/check-production-env.mjs && npx serve dist
```

Otherwise the gate never runs and this safeguard is only nominal.

## 5. After the owner applies 0005

1. `curl -s https://bartisawesome.onrender.com/ | grep -o '/assets/index-[^"]*'`
   and confirm the asset contains `oizdbkxnzwatytxcrvoo`.
2. Create one disposable account on the real site (do not use the owner's
   password), sign out, sign in, reload, open a new tab.
3. Repeat the account checks with the hosted project:
   `GEEGLE_AUTH_BASE=https://bartisawesome.onrender.com node --env-file=.env.local scripts/qa/check-account-completion.mjs`
   — this creates two disposable accounts and never touches existing ones.
4. Record the result in `docs/ACCOUNT_ACCEPTANCE_EVIDENCE.md`.

Until step 1–3 pass on the live site, production account acceptance is
**BLOCKED**, not done.
