# Production authentication handoff (internal engineering note)

Production: `https://bartisawesome.onrender.com` (Render, not Vercel).
Checked after PR #4 merged (2026-11-26), sanitized evidence only.

## What is wrong

The deployed bundle `/assets/index-CC8Bq6la.js` contains
`https://wkdlsaydqyymynoipmhl.supabase.co` and a `sb_publishable_…` key for that
project. That is the isolated test project, not the project that holds the real
accounts (`oizdbkxnzwatytxcrvoo`). Consequences:

1. Login for an existing Geegle account fails there because the account does not
   exist in the isolated project. Sanitized live result:
   `POST /auth/v1/token?grant_type=password` → **400 `invalid_credentials`**.
2. Signup cannot complete on the isolated project because
   `GET /auth/v1/settings` reports **`mailer_autoconfirm: false`** and Geegle
   collects no email to confirm, so `signUp` creates a user with no session.
   Geegle now reports that state precisely, but it is a configuration problem.

The generic `Something went wrong. Please try again.` in the owner's screenshot
is the fallback for an unrecognized auth response; the configuration above is
the reproducible cause.

## Owner actions (in order)

1. **Render → the `geegle` web service → Environment.**
   - `VITE_SUPABASE_URL` = the intended production project URL
     (`https://oizdbkxnzwatytxcrvoo.supabase.co` unless the owner says otherwise)
   - `VITE_SUPABASE_ANON_KEY` = that project's publishable/anon key (never the
     service-role key)
   - Remove or correct any test-project values and any stray `VITE_*` pointing at
     `wkdlsaydqyymynoipmhl`.
   - Rebuild and redeploy (these are build-time Vite values; a restart alone is
     not enough).
2. **Supabase → the intended project → Authentication → Sign In / Providers →
   Email.** Turn **off** "Confirm email" for this username-only flow. This is a
   project-wide setting: do not disable confirmation for unrelated applications
   that share the project. If that is not acceptable, approve the scoped
   alternative (a Geegle-specific email domain plus an auto-confirm trigger, or
   a server-side signup endpoint that confirms the synthetic address).
3. **Migrations.** `0002`, `0003`, `0004` have not been applied to production.
   Review least-privilege grants and run them in a transaction with a backup, or
   explicitly reject them. `0003` may no longer be necessary if the old gate is
   gone; do not drop unrelated database objects.

## Verification after the owner change

- `curl -s https://bartisawesome.onrender.com/ | grep -o '/assets/index-[^"]*'`
  then grep the asset for `oizdbkxnzwatytxcrvoo` and confirm no
  `wkdlsaydqyymynoipmhl`.
- `npm run check:prod-build` with `GEEGLE_EXPECT_PRODUCTION=1` must pass for the
  bundle that is deployed (it inspects `dist/`, so build with production values).
- Create one disposable authorized account on the real site, sign out, sign in,
  reload and open a new tab. Do not print credentials.

No production credentials, tokens or user data are recorded here.
