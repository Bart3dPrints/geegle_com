# Production authentication — applied and verified

Project: `oizdbkxnzwatytxcrvoo` (`https://oizdbkxnzwatytxcrvoo.supabase.co`), shared
with one other application.
Site: `https://bartisawesome.onrender.com`.
Applied through the connected Supabase integration on 2026-11-26. No credentials
or user data are recorded here.

## 1. What was wrong

Registration failed with `500 / 23503 ... geegle_profiles_id_fkey ... Key (id)=(…)
is not present in table "users"` because `geegle_on_auth_user_created` was a
**BEFORE INSERT** trigger: it inserted the profile before the `auth.users` row
existed. Fixing only that was not enough — the project runs
`mailer_autoconfirm = false`, so a new username-only account received a
confirmation email it could never answer and no session.

## 2. Migrations applied

Recorded in `supabase_migrations.schema_migrations`:

| Version | Name | Effect |
| --- | --- | --- |
| 20261126180218 | `geegle_0005_signup_confirmation_hardened` | profile FK re-pointed at `auth.users`; provisioning trigger recreated **AFTER INSERT**; `BEFORE INSERT` namespace confirmation for `%@users.geegle.internal`; case-insensitive unique index on `lower(username)`; backfill of confirmation + profile + settings |
| 20261126180229 | `geegle_0002_game_save_revision` | `geegle_game_saves.revision` (uuid, not null, default) + `BEFORE UPDATE` rotation trigger |
| 20261126180239 | `geegle_0006_least_privilege_grants` | removed all `anon` access to Geegle tables; revoked the retired entry-gate RPC and helper from `public/anon/authenticated`; explicit `authenticated` grants |

Both new files carry a preflight block and a post-migration validation block. A
duplicate username, an orphan profile, a missing index, a wrong trigger timing or
a surviving anonymous privilege aborts the migration instead of leaving a partial
repair. The unique index is created without an exception handler on purpose: in
production the preflight found no duplicate groups, so a failure would be a real
defect and must stop the migration.

## 3. Verified production state after the migrations

```
triggers on auth.users: geegle_on_auth_user_created       AFTER INSERT   (Geegle)
                        geegle_confirm_synthetic_email    BEFORE INSERT  (Geegle)
                        sync_owner_admin_user_on_auth_users AFTER        (other app, untouched)
geegle_profiles_id_fkey -> auth.users(id) ON DELETE CASCADE
geegle_profiles_username_lower_key present
geegle_game_saves.revision + geegle_game_saves_revision trigger present
anon: no privileges on any geegle_* table; no EXECUTE on the retired gate RPC
authenticated: select/insert/update(/delete) as required; RLS unchanged
```

## 4. Shared-project safety

- No project-wide authentication setting was changed. "Confirm email" stays on,
  so the other application keeps its confirmation behaviour.
- The confirmation trigger only acts on `%@users.geegle.internal`; every other
  insert passes through unchanged.
- `is_admin()` requires a row in `public.admin_users` **and** an owner-admin
  email, so a Geegle account cannot become an administrator.
- Every table belonging to the other application has RLS enabled with policies
  scoped to `auth.uid()` or `is_admin()`; a new authenticated Geegle account
  therefore gains no read or write access to it. The one pre-existing quirk worth
  knowing is that any authenticated user may insert a `leads` row under the
  other application's own policy; that was true before this work and is not
  changed by it.
- Existing accounts were not deleted or re-passworded. Production had no Geegle
  accounts before this repair, so the backfill was a no-op there.

## 5. Rollback

Reverse order, per migration:

```sql
-- 0006
grant all on public.geegle_profiles, public.geegle_user_settings,
  public.geegle_favorites, public.geegle_recently_played, public.geegle_game_saves to anon;
grant execute on function public.geegle_verify_entry_password(text, text) to public, anon, authenticated;

-- 0002
drop trigger if exists geegle_game_saves_revision on public.geegle_game_saves;
drop function if exists public.geegle_revision_game_save();
alter table public.geegle_game_saves drop column if exists revision;

-- 0005
drop trigger if exists geegle_confirm_synthetic_email on auth.users;
drop function if exists public.geegle_confirm_synthetic_email();
drop index if exists public.geegle_profiles_username_lower_key;
drop trigger if exists geegle_on_auth_user_created on auth.users;
create trigger geegle_on_auth_user_created before insert on auth.users
  for each row execute function public.geegle_handle_new_user();
```

Backups: the project reports `walg_enabled: true` but no restorable backup entry
and `pitr_enabled: false`. Recovery therefore relies on forward fixes; every
step above is additive and reversible without data loss.

## 6. Deployment safeguard

`Procfile` runs `npm run build && GEEGLE_EXPECT_PRODUCTION=1 node
scripts/qa/check-production-env.mjs && npx serve dist`. The gate inspects the
built `dist/assets/*.js` and fails the deploy when the isolated project is
compiled in, when placeholders are compiled in, when the public key does not
belong to the project URL, or when a privileged key is in the bundle. If the
Render service defines its own Start Command it overrides the `Procfile` and must
carry the same chain.

Live bundle checked today: `/assets/index-C72ESc1B.js`, contains
`https://oizdbkxnzwatytxcrvoo.supabase.co`, no isolated reference, no privileged
key. The service worker calls `skipWaiting`/`clients.claim`, and the HTML entry
points at a content-hashed bundle, so it cannot serve stale authentication code
past one reload.

## 7. Optional follow-ups (not required for the account system to work)

1. Drop the retired entry-gate objects (`geegle_entry_config`,
   `geegle_entry_attempts`, `geegle_verify_entry_password`). Their exposure is
   already removed; dropping them is cleanup, not a fix.
2. Replace the `leads` insert policy in the other application if it should not
   be open to every authenticated user of the shared project.
3. Enable PITR if the plan allows it.
