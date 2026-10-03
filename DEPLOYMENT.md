# EcoVibes hosted setup

The API is configured for private Supabase Postgres. The browser talks to the API, and the API owns database access and authorization. CSV imports remain available alongside Shopify.

## 1. Create the hosted database

1. Create a Supabase project and choose a database password.
2. In the Supabase SQL connection settings, copy a PostgreSQL connection string for the API host. Keep the password private.
3. From this project directory, authenticate with the Supabase CLI and link the project. The project reference is visible in the Supabase project URL and settings.
4. Apply the checked-in migrations with `npx supabase db push`.
5. In Supabase, confirm the latest marker `20261002000000_eco_language_core` and API tables exist. Production API startup refuses to run until this marker is present. The migrations enable row-level security and revoke direct browser roles; requests go through the EcoVibes API.
6. In **Storage**, create a private bucket named `ecovibes-media`. Keep it private; the API proxies authorized media reads and uploads.

The API needs the database connection string as `DATABASE_URL`. For Render's IPv4 service, use Supabase's shared **session pooler** connection (port 5432); use the direct connection only when your host has IPv6 or you have enabled Supabase's IPv4 add-on. Do not use the browser-facing Supabase anon key for the server database connection. [Supabase documents the connection modes and IP support here](https://supabase.com/docs/guides/database/connecting-to-postgres).

## 2. Deploy API and web app on Render

1. Push this project to a Git provider and connect it to Render.
2. Choose **New > Blueprint** and select this repository. [`render.yaml`](./render.yaml) defines the API service and the static web app.
3. In the `ecovibes-api` service's **Environment** settings, add the private `DATABASE_URL` value from Supabase.
4. Set `STORAGE_URL` to the Supabase project URL, `STORAGE_KEY` to a server-only Supabase secret/service key, and `STORAGE_BUCKET` to `ecovibes-media`. The storage key must never use a `VITE_` prefix or be exposed to the browser.
5. In the `ecovibes-web` static site environment, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from Supabase's API settings. The publishable key is intended for browsers; never use the Supabase secret/service key here.
6. Bootstrap the first admin using the immutable Supabase Auth user UUID (`auth.users.id`) for the owner's signed-in account. Set that UUID in `ECOVIBES_ADMIN_SUPABASE_USER_IDS` in the API service's Render environment. The API grants the linked EcoVibes ID its `admin` role in `staff_access` on sign-in; remove the bootstrap variable after confirming access. Never bootstrap staff from a user-editable EcoVibes ID such as `@username`.
7. In Supabase **Authentication → URL Configuration**, set the deployed web origin as the Site URL and allow the exact web origin plus its `/?recovery=1` password-recovery redirect. Add localhost only for development.
8. Deploy both services. The API health check is `/api/v1/health`. The web app uses the configured API URL.
9. Sign in with each staff ID and open staff review. Production asks staff to enroll or verify a TOTP authenticator; confirm that an AAL1 staff session is denied by the API and that the verified AAL2 session can reach only its role-appropriate queue. Grant trust/support roles through the server-owned `staff_access` table using the API's internal `users.id`; do not grant staff access from browser metadata.
10. If you attach a custom web domain, update the API's `APP_ORIGINS` value and the Supabase redirect allow-list to that exact origin. Also update the Shopify callback URL if the API domain changes.

## 3. Backups, restore and monitoring

1. Check the Supabase project's plan and the **Database → Backups** page before launch. Supabase currently includes daily database backups for paid Pro, Team and Enterprise projects; retention is 7, 14 and up to 30 days respectively. Free projects should export regularly with the Supabase CLI and keep an encrypted off-site copy.
2. Treat the database backup and Storage objects as separate jobs. Supabase database backups preserve Storage metadata, not the uploaded media objects themselves. Back up the private `ecovibes-media` bucket separately and test that its objects can be read after restore.
3. Perform a restore drill against a new/isolated Supabase project or database, never over live production. Restore the database, apply any migrations newer than the backup, configure the isolated app against it, and check sign-in, listing, order, report and media retrieval flows. Record the date and outcome without recording credentials.
4. Confirm Render deploy/health alerts and Supabase database alerts in their dashboards. Add a hosted error-monitoring provider only after choosing its retention and data-redaction settings; do not send passwords, tokens, payment details or private message contents to monitoring.
5. If daily recovery is insufficient, review Supabase PITR pricing and recovery retention in the dashboard before enabling it. This is a recurring paid add-on; do not enable it without an owner-approved budget.

Supabase's current plan backup schedule, restore behavior and Storage exclusions are documented in its [database backup guide](https://supabase.com/docs/guides/platform/backups).

## 4. Turn on Paystack test checkout and refunds

1. Create or use a Paystack account and switch to test mode.
2. Copy the test secret key from Paystack's developer settings into Render's `PAYSTACK_SECRET_KEY` setting. The application rejects keys that do not begin with `sk_test_`.
3. Set the Paystack webhook URL to `https://ecovibes-api.onrender.com/api/v1/webhooks/paystack` (replace the hostname if you use a custom API domain).
4. Keep the API service deployed while Paystack sends a test `charge.success` callback. The API verifies the signature, then independently verifies the transaction, amount, currency, and reference before marking the order paid. Refund requests require staff approval and remain pending until a refund callback arrives.

## 5. Connect the first Shopify store

1. Create a Shopify app in the Shopify Dev Dashboard and set its app URL to the deployed EcoVibes web URL.
2. Add this exact allowed redirect URL: `https://ecovibes-api.onrender.com/api/v1/connectors/shopify/callback` (or your custom API domain).
3. Request only `read_products` and `read_inventory` scopes for this first connector.
4. Add the Shopify client ID and client secret to Render's `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` secret settings. Set `SHOPIFY_REDIRECT_URI` to the same callback URL.
5. Generate a random 32-byte encryption key locally with `openssl rand -base64 32`, and paste it directly into Render's `TOKEN_ENCRYPTION_KEY` secret setting. Never add it to `.env`, source control, or chat.
6. Deploy. A seller can connect a `*.myshopify.com` store from Marketplace. Imported products are paused until the seller reviews them.
7. This connector currently imports catalog and inventory data only. It does not write EcoVibes orders back to Shopify or synchronize reserved EcoVibes stock to the store, so sellers must manually reconcile stock and fulfillment until the write-side connector is implemented.

## Provider secret handling

Enter provider keys, database passwords, the initial staff ID list, and the token-encryption key in the hosting provider's secret settings. Do not put their values in this repository or in chat. The committed `.env.example` contains variable names only.

Deployment still requires the owner to create/link the provider accounts and enter their private settings. No live account credentials are stored in this project.
