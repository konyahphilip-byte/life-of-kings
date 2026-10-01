# EcoVibes hosted setup

The API is configured for private Supabase Postgres. The browser talks to the API, and the API owns database access and authorization. CSV imports remain available alongside Shopify.

## 1. Create the hosted database

1. Create a Supabase project and choose a database password.
2. In the Supabase SQL connection settings, copy a PostgreSQL connection string for the API host. Keep the password private.
3. From this project directory, authenticate with the Supabase CLI and link the project. The project reference is visible in the Supabase project URL and settings.
4. Apply the checked-in migration with `npx supabase db push`.
5. In Supabase, check that the migration is recorded and the API tables exist. The migration enables row-level security and revokes direct browser roles; requests go through EcoVibes API.

The API needs the database connection string as `DATABASE_URL`. For Render's IPv4 service, use Supabase's shared **session pooler** connection (port 5432); use the direct connection only when your host has IPv6 or you have enabled Supabase's IPv4 add-on. Do not use the browser-facing Supabase anon key for the server database connection. [Supabase documents the connection modes and IP support here](https://supabase.com/docs/guides/database/connecting-to-postgres).

## 2. Deploy API and web app on Render

1. Push this project to a Git provider and connect it to Render.
2. Choose **New > Blueprint** and select this repository. [`render.yaml`](./render.yaml) defines the API service and the static web app.
3. In the `ecovibes-api` service's **Environment** settings, add the private `DATABASE_URL` value from Supabase.
4. Set `ECOVIBES_ADMIN_ECO_IDS` to the comma-separated EcoVibes IDs that should receive the initial `admin` capability. This value is read by the API and must stay in Render's secret settings.
5. Deploy both services. The API health check is `/api/v1/health`. The web app uses the configured API URL.
6. If you attach a custom web domain, update the API's `APP_ORIGINS` value to that exact origin. Also update the Shopify callback URL if the API domain changes.

## 3. Turn on Paystack test checkout and refunds

1. Create or use a Paystack account and switch to test mode.
2. Copy the test secret key from Paystack's developer settings into Render's `PAYSTACK_SECRET_KEY` setting. The application rejects keys that do not begin with `sk_test_`.
3. Set the Paystack webhook URL to `https://ecovibes-api.onrender.com/api/v1/webhooks/paystack` (replace the hostname if you use a custom API domain).
4. Keep the API service deployed while Paystack sends a test `charge.success` callback. The API verifies the signature, then independently verifies the transaction, amount, currency, and reference before marking the order paid. Refund requests require staff approval and remain pending until a refund callback arrives.

## 4. Connect the first Shopify store

1. Create a Shopify app in the Shopify Dev Dashboard and set its app URL to the deployed EcoVibes web URL.
2. Add this exact allowed redirect URL: `https://ecovibes-api.onrender.com/api/v1/connectors/shopify/callback` (or your custom API domain).
3. Request only `read_products` and `read_inventory` scopes for this first connector.
4. Add the Shopify client ID and client secret to Render's `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` secret settings. Set `SHOPIFY_REDIRECT_URI` to the same callback URL.
5. Generate a random 32-byte encryption key locally with `openssl rand -base64 32`, and paste it directly into Render's `TOKEN_ENCRYPTION_KEY` secret setting. Never add it to `.env`, source control, or chat.
6. Deploy. A seller can connect a `*.myshopify.com` store from Marketplace. Imported products are paused until the seller reviews them.

## Provider secret handling

Enter provider keys, database passwords, the initial staff ID list, and the token-encryption key in the hosting provider's secret settings. Do not put their values in this repository or in chat. The committed `.env.example` contains variable names only.

Deployment still requires the owner to create/link the provider accounts and enter their private settings. No live account credentials are stored in this project.
