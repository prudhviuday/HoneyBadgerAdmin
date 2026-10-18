# Honeybadger Media Admin

Static admin portal for the current Supabase project.

## Run

Because the pages use ES modules, serve the folder through a local web server rather than opening HTML with `file://`.

For example, from the project root:

`python -m http.server 8000`

Then open `/admin/login.html`.

## Authentication

Admin pages require a signed-in Supabase user with `app_metadata.role = "admin"`. The browser contains only the Supabase publishable key. Never put a service-role/secret key in these files.

## Database assumptions

The portal expects these public tables: clients, movies, campaigns, venues, activations, leads, campaign_assets, expenses, invoices.

Movies uses `title`, matching the current database schema.
