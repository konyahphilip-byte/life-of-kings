# Supabase bearer authentication

The API exposes `GET /api/v1/auth/supabase/me` for requests authenticated with a Supabase access token:

```http
GET /api/v1/auth/supabase/me
Authorization: Bearer <supabase-access-token>
```

The endpoint verifies the token signature and issuer using `@supabase/server`, then fetches the authoritative user record through a caller-scoped Supabase client. It returns only the user's ID, email, and email confirmation time. It does not accept publishable or secret API keys as user tokens.

The EcoVibes ID workspace also supports Supabase email/password sign-up and sign-in through `@supabase/supabase-js`. After Supabase authenticates the user, the browser sends the access token to `POST /api/v1/auth/supabase/session`. The API verifies it, links the identity to the currently signed-in EcoVibes ID or creates a new customer profile, then issues the same HttpOnly EcoVibes session cookie used by existing protected routes.

Identity linking is explicit: a Supabase identity links to an existing EcoVibes ID only when that EcoVibes ID is already signed in in the same browser. Matching email addresses are never used to claim an existing account. A first-time Supabase user who is not signed in to an EcoVibes ID gets a new `member.<id>` EcoVibes ID. The private `supabase_identities` table stores the link and is not exposed to browser database roles.

Required server environment:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_JWKS_URL` (the SDK can also derive the standard endpoint from `SUPABASE_URL`)
- `VITE_SUPABASE_URL` (browser-safe project URL)
- `VITE_SUPABASE_PUBLISHABLE_KEY` (browser-safe key; never put a secret key in a `VITE_*` variable)

This user-scoped flow does not need `SUPABASE_SECRET_KEY`; it keeps Row Level Security in force. Keep any secret key server-only and leave it unset until a server operation actually needs administrative access.

EcoVibes' existing `/auth/me`, `/auth/login`, and `/auth/register` cookie-session flow remains available. Once a verified Supabase identity is exchanged through `/auth/supabase/session`, the resulting EcoVibes session authorizes the same profile-backed actions.

For a local Supabase CLI project, `supabase/config.toml` allows `http://localhost:5173/**`, `http://localhost:5177/**`, and `http://localhost:5178/**`. The cloud project's Auth URL Configuration is separate: enable Email sign-in and add `http://localhost:5178/**` (the current preview) plus `http://localhost:5173/**` under the redirect allow list. Keep the cloud project's production Site URL as its real deployed URL. The values in `supabase/config.toml` do not modify cloud dashboard settings.
