# Geegle

Browser gaming platform. Vite + React + TypeScript + Tailwind frontend with a
Supabase (free tier) backend for accounts and data sync.

## Local development

```bash
npm ci
npm run dev
```

The entry gate and account features require these environment variables
(`.env.local` for local development):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

## Backend setup (Supabase)

1. In an isolated development project, apply `supabase/migrations/0001_init.sql`.
   The migration creates `public.geegle_*` tables, owner-only RLS policies,
   and the `geegle_verify_entry_password` database function used by the app.
2. Configure Supabase Auth to disable email confirmation: accounts use
   synthetic `@users.geegle.internal` addresses that cannot receive mail.
3. Set the frontend environment variables above. Without them the entry gate
   remains locked; it does not fall back to local-only access.

The gate is a convenience screen, not access control: the password is public,
its unlocked state is stored in the browser, and static game files are public.
The function's rate limit uses a client-supplied device identifier, not a
verified IP address. Protect private data with authentication and RLS rather
than relying on this gate. The separate `verify-entry-password` Edge Function
is not used by the current frontend; do not deploy it as a substitute for the
RPC without updating and testing the client and schema together.

## Render deployment

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Layout

- `src/data/raw/*.txt` — pipe-delimited game catalog data (id|title|categories)
- `src/data/raw/path-exceptions.txt` — launch paths that differ from `/games/{id}.html`
- `src/data/catalog.ts` — parses the raw data into the runtime catalog
- `src/components/GameArt.tsx` — reuse-cleared artwork with a neutral fallback
- `supabase/` — database schema and edge functions

Build identifier: `overhaul-2026-11-25.2`
