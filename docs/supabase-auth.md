# Supabase Auth and EcoVibes ID

Supabase Auth is the primary sign-in provider. New accounts are created with Supabase email/password authentication and choose a unique EcoVibes ID during signup. Supabase user metadata carries the display name and requested EcoVibes ID to the API; the API validates availability before creating the profile. If no EcoVibes ID is provided by an older client, the API assigns a `member.<id>` fallback.

The API exchanges a verified Supabase access token for an HttpOnly EcoVibes session cookie. That cookie is the server-side session bridge used by the existing EcoVibes services and retains their CSRF checks and role-based authorization. Supabase remains the source of truth for sign-in credentials.

Existing password-based EcoVibes IDs can be migrated by signing in with the old EcoVibes ID and password, then signing in with Supabase in the same browser. The server links only that already-authenticated EcoVibes ID. Email matches never claim or merge an account. When `SUPABASE_URL` is configured, new registrations through the legacy `/auth/register` endpoint are disabled, and unlinked legacy sessions can only view their EcoVibes ID or complete linking/sign out. `/auth/login` remains available to start this explicit migration flow.

The API exposes `GET /api/v1/auth/supabase/me` for requests authenticated with a Supabase access token:

```http
GET /api/v1/auth/supabase/me
Authorization: Bearer <supabase-access-token>
```

The endpoint verifies the token signature and issuer using `@supabase/server`, then fetches the authoritative user record through a caller-scoped Supabase client. It returns only the user's ID, email, and email confirmation time. It does not accept publishable or secret API keys as user tokens.

The EcoVibes ID workspace uses Supabase email/password sign-up and sign-in through `@supabase/supabase-js`. After Supabase authenticates the user, the browser sends the access token to `POST /api/v1/auth/supabase/session`. The API verifies it, links the identity to the currently signed-in EcoVibes ID or creates a new customer profile, then issues the same HttpOnly EcoVibes session cookie used by existing protected routes.

Identity linking is explicit: a Supabase identity links to an existing EcoVibes ID only when that EcoVibes ID is already signed in in the same browser. Matching email addresses are never used to claim an existing account. A first-time Supabase user receives the requested EcoVibes ID if it is valid and available, or a generated `member.<id>` ID when no ID was supplied. The private `supabase_identities` table stores the link and is not exposed to browser database roles.

Required server environment:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_JWKS_URL` (optional; the SDK can derive the standard endpoint from `SUPABASE_URL`)
- `VITE_SUPABASE_URL` (browser-safe project URL)
- `VITE_SUPABASE_PUBLISHABLE_KEY` (browser-safe key; never put a secret key in a `VITE_*` variable)

This user-scoped flow does not need `SUPABASE_SECRET_KEY`; it keeps Row Level Security in force. Keep any secret key server-only and leave it unset until a server operation actually needs administrative access.

`/auth/me` reports the bridged EcoVibes session. `/auth/login` remains available to authenticate an existing password-based EcoVibes ID for explicit linking; until linked, that session cannot access protected services. `/auth/register` is available only when Supabase Auth is not configured; new production accounts use Supabase Auth. A verified Supabase identity exchanged through `/auth/supabase/session` authorizes the same profile-backed actions.

For a local Supabase CLI project, `supabase/config.toml` allows `http://localhost:5173/**`, `http://localhost:5177/**`, and `http://localhost:5178/**`. The cloud project's Auth URL Configuration is separate: enable Email sign-in and add `http://localhost:5178/**` (the current preview) plus `http://localhost:5173/**` under the redirect allow list. Keep the cloud project's production Site URL as its real deployed URL. The values in `supabase/config.toml` do not modify cloud dashboard settings.
