# EcoVibes staging candidate, 21 October 2026

## Source and scope

Assembled an isolated release from published Chale review commit `4ce87bccedc948af6127702a3ebdaf68e1a01ad4`, which descends from main `47fe62da84a1345b59c92138939204bf2ae00418`. Added provider review feedback, independent discovery loading, delayed-directory protection, and checkout initialization safety. Included the previously applied runtime-role migration, deployment instructions, a read-only hosted smoke check and GitHub release checks. Local unpublished Games changes and local Git history were not included. Existing working files were preserved.

The Chale gateway supports the owner's selected free Cloudflare path and remains disabled in hosting until private configuration and a real response are verified. Paid adapters remain opt-in; no paid resource or inference was used here. Paystack remains test-only.

## Actual checks

- Current full working copy: 236 tests in 20 files passed, sequential workers.
- Isolated release: **193 tests in 18 files passed**, production build passed.
- Isolated release HTTP checks: **49 provider**, **27 payment**, **39 identity-role**, **48 job**, **58 support**, **19 Chale** checks passed.
- HTTP tests used temporary SQLite, synthetic accounts and simulated payment/model providers; no application .env or hosted database was loaded.
- Production build retains the existing Communications bundle-size warning.
- GitHub workflow is prepared with read-only repository permissions and immutable revisions of the official checkout/setup-node actions. Hosted CI results are recorded separately after publication.

## Hosted facts and limits

Owner confirmed Render workspace `tea-db4bebnlk1mc73fgahtg`. Existing service `srv-db847imq1p3s739gqpr0` uses the Free service plan with one instance, previews off and automatic deployment off. Its last inspected deployment `dep-dbbtjfmi0phs73e699hg` failed on main `47fe62d`; the other Chale chat recorded `DATABASE_URL` missing. No new deployment was triggered here.

Supabase history contains nine migrations. The staged `ecovibes_api_runtime` role has login disabled, is not superuser and does not bypass RLS. The security advisor returned no findings. This is a trusted backend role with application authorization; it does not provide organization isolation by itself. The migration source MD5 `d162e0da2b2054e0a7b628cf0b1c28ce` matches hosted history. Its proposal wording is retained because the migration is an exact historical record; the staging operation has already occurred. No password or database privilege was changed in this release preparation.

## Required before launch

1. Owner privately enables database login, sets its password and saves `DATABASE_URL` in Render. No credentials belong in Git or chat.
2. Confirm public Supabase build/server configuration, exact origin/redirects, media storage settings and the service HTTP health path `/api/v1/health`.
3. Deploy the reviewed commit and verify health, sign-in, recovery, session revocation, provider onboarding, staff MFA and cross-account denial against Postgres.
4. Verify storage, monitoring and an isolated backup restore. Complete test-provider payment callback/refund journeys before any real-payment decision.
5. For live Chale, enter its restricted Cloudflare token in provider settings, confirm the Free-plan gates and test real grounded answers and quota exhaustion. Configuration status and mocked replies are not live inference evidence.

Rollback means redeploying a compatible reviewed commit; it does not undo external writes or database migrations. Keep the scoped runtime-role migration and credentials separate from application rollback. The current release is a staging candidate, not evidence of a public launch.
