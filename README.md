# Geegle

Browser gaming platform. Vite + React + TypeScript + Tailwind frontend with a
Supabase (free tier) backend for accounts and data sync.

## Local development

```bash
npm ci
npm run dev
```

Optional environment (`.env.local`) — without these the site runs fully in
anonymous/local-only mode:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

## Backend setup (Supabase)

1. Run `supabase/migrations/0001_init.sql` (creates the `geegle` schema,
   tables, triggers, and owner-only RLS policies).
2. Generate the entry-gate secrets:
   `node supabase/functions/_shared/hash-entry-password.mjs <password>`
3. Set them:
   `supabase secrets set ENTRY_PASSWORD_HASH=... ENTRY_SALT=...`
4. Deploy the gate:
   `supabase functions deploy verify-entry-password`
5. In Supabase Auth settings, disable email confirmation (accounts use
   synthetic `@users.geegle.internal` addresses that cannot receive mail).

## Render deployment

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Layout

- `src/data/raw/*.txt` — pipe-delimited game catalog data (id|title|categories)
- `src/data/path-exceptions.txt` — launch paths that differ from `/games/{id}.html`
- `src/data/catalog.ts` — parses the raw data into the runtime catalog
- `src/components/GameArt.tsx` — real game artwork from each game's own asset
  folder, with graceful fallback
- `supabase/` — database schema and edge functions

Build identifier: `overhaul-2026-11-25.2`
