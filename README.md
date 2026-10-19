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

The console displays the existing movies, campaigns, missions, venues, campaign-specific map placements, QR codes, activations, leads, invoices, and expenses. **Activity & Tasks** is the single task/mission management area; there is no separate duplicate Events & Hunts menu. The app supports adding multiple map placements before returning to a movie campaign, reuses canonical venue details and (once the migration is applied) venue coordinates, validates QR campaign/source relationships, loads table data only when a panel is opened, caches count badges, paginates admin reads, selects only needed columns, and avoids fetching QR code hashes into the browser. The React app under `src/` is the production UI. The older static `admin/` files remain legacy reference code, not a second production entry point. The activity-category write policy migration is in `supabase/migrations/20261018194500_admin_activity_type_policies.sql` and must be applied to the connected Supabase project before category creation will succeed. Venue coordinate support is defined in `supabase/migrations/20261019153000_add_venue_coordinates.sql`; the admin app detects whether those columns exist and keeps existing venue management working if that additive migration has not yet been applied. The Activity & Tasks page detects whether the numbered activity/task-engine schema is installed and warns when event-category-based task progress is not available. The public QR landing pages remain on the main Honeybadger app at `https://honeycomb2.prudhvi123143.workers.dev/q/:code`.
