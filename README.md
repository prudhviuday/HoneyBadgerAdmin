# Honeybadger Admin

A clean, responsive admin console for the existing Honeybadger Supabase project. The admin UI reads and writes the existing database; it does not create a second database.

## Deployment

This project is deployed as a Cloudflare Worker with static assets. The Worker entrypoint is `worker/index.ts`; `wrangler.jsonc` configures the Worker, serves the Vite `dist` directory, and routes `/api/*` through the Worker before SPA fallback.

In the Cloudflare dashboard, open the `honeybadgeradmin` Worker and add these runtime variables under **Settings → Variables and Secrets**:

- `VITE_SUPABASE_URL` — the existing Honeybadger Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — the project's public anon/publishable key

Redeploy the Worker after changing variables. Verify `/api/config` returns JSON with non-empty `url` and `anonKey` values. Those are public browser credentials; **never use a Supabase service-role or secret key**.

## Local development

For local Vite development only, copy `.env.example` to `.env.local`, fill in the same public Supabase values, then run:

```sh
npm install
npm run dev
```

## Access and security

Sign in using an existing Supabase Auth account. The UI checks the `is_admin()` RPC before showing the admin console. This UI check is not a substitute for database security: enforce permissions using RLS policies and appropriately protected database functions.

The console displays the existing movies, campaigns, missions, venues, and QR codes. New records can currently be added for movies, campaigns, and venues. The public QR landing pages remain on the main Honeybadger app at `https://honeycomb2.prudhvi123143.workers.dev/q/:code`.
