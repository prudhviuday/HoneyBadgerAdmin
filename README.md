# Honeybadger Admin

Private operator console for the Honeybadger movie-campaign platform. It uses the **same Supabase project** as the main Honeybadger app and does not keep a second copy of movie, campaign, venue, event, or QR data.

## Features*

- Admin-only sign-in through Supabase Auth and the `public.is_admin()` check.
- Movie catalogue: title, language, release date, poster, trailer, notes, active status.
- Campaign management: link each campaign to a movie, set public media/terms URLs and active status.
- Events and hunts: create/edit mission records, reward points/entries, target and date window.
- Venue registry: shops, malls, colleges, cafes and theatres.
- Universal QR manager: create and edit QR codes, link campaign/movie, attach a shop/mall or hunt, assign points, start/expiry dates, max uses, active state, and (for friend-invite QR) the Honeybadger user.
- Public QR links use `https://honeycomb2.prudhvi123143.workers.dev/q/:code`.

## Configuration

For the deployed Cloudflare Pages app, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in **Settings → Variables and Secrets**. The app reads these through the `/api/config` Pages Function at runtime, rather than relying only on values embedded during the Vite build.

For local Vite development, create a `.env.local` file from `.env.example` and fill in the same two values. Cloudflare dashboard variables are not automatically available to a local development process.

## Local development

1. For local Vite development, create a `.env.local` file from `.env.example`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the same Supabase project used by Honeybadger.
3. Install and run:

   ```sh
   npm install
   npm run dev
   ```

4. Sign in with an existing Supabase account that has the admin role. The client-side admin check is only a UI gate; the database RLS policies and admin-only RPCs remain the security boundary.

## Notes

- Never put a Supabase service-role key in this frontend.
- Creating promotion QR codes uses `create_promotion_qr`; friend-invite QR codes use the admin-only `admin_create_friend_invite_qr` RPC.
- The admin app is a separate deployment from the public Honeybadger Worker. Deploy this project independently after setting the environment variables.
- Existing QR codes retain their public codes when edited. Regenerate artwork only if the encoded URL itself has changed.
