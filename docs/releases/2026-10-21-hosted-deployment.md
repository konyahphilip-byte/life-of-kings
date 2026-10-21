# Hosted deployment receipt - 21 October 2026

## Deployed source

- Public app/API: https://ecovibes-api.onrender.com
- Render workspace: ECOVIBES, `tea-db4bebnlk1mc73fgahtg` (owner confirmed).
- Existing Free service: `srv-db847imq1p3s739gqpr0`; one instance; automatic deployment remains off.
- Pull request: https://github.com/konyahphilip-byte/life-of-kings/pull/2, merged.
- Deployed merge commit: `481124e917aac38d4ab30034a633c14e733041fb`.
- Tree: `f53347a663f029d4c370026a34ef9197b3f69fc1`.
- Deploy: `dep-dbce0nqfngtc739tlafg`; Render reported **live**, finished `2026-10-21T15:57:54.176084Z`.

The published release initially matched the exact locally verified tree `b98efc9797b02ce3930b3e32843f1e3916a5c391` (194 tests in 18 files plus build; 240 isolated HTTP checks using SQLite and mocked external providers). The final deployed tree adds only the public Supabase CA, its provenance, and its Blueprint environment entry. GitHub Release checks passed on final PR head `dea945c685924037870ac52e689caf154dd05211`, run `39629464638`: unit/component tests, build, and provider/payment/identity/job/support/Chale HTTP workflows. Unpublished Games changes were excluded; the active local checkout and existing dirty work were preserved.

## Failure diagnosed and fixed

Initial deploy `dep-dbcdn8e1egvs73ab1f20` of `fb2e4d4ff0ad2adab39315893aa8df487aefd9a6` built successfully but failed startup with `SELF_SIGNED_CERT_IN_CHAIN`. The previous missing-credential blocker has been superseded: the owner saved credentials privately, and the database role now permits login without superuser or RLS-bypass privileges.

Downloaded Supabase Root 2021 CA over verified HTTPS from the official download URL, independently matched to Supabase Studio's published configuration. See [certificate provenance](../../server/certs/README.md). Set the service's `NODE_EXTRA_CA_CERTS` to the committed public certificate path, using a merge update that preserved other variables. The same value is recorded in `render.yaml` for future Blueprint use; no Blueprint sync was performed. The Render CLI/schema validators were unavailable locally, so no complete Blueprint-validation claim is made.

Certificate verification remains enabled in the PostgreSQL pool. A credential-free TLS probe against the shared-pooler hostname in Supabase's official documentation failed without the CA and passed with it using TLS 1.3; correct hostname accepted and wrong hostname rejected. This probe was not an application database login. The subsequent hosted API startup and health response provide separate evidence of the actual application connection.

Configured `/api/v1/health` in Render. Runtime logs reported `database postgres`; the public health response returned HTTP 200 with `status: ok` and `database: postgres` at `2026-10-21T16:07:14.681Z`.

## Hosted checks

**Eight anonymous hosted checks passed:** durable Postgres health; HTML app shell and CSP; HTTPS/security headers; anonymous account isolation; approved-only public provider directory; provider-owner and staff-review authentication denials; missing asset 404; and structured authentication denial for an unknown protected API path.

The first smoke run passed seven checks then incorrectly expected 404 from the unknown protected API path. The existing route authenticates before its final route lookup and correctly returned 401 `sign_in_required`. Corrected the smoke assertion and reran all eight successfully; no application authorization behavior was weakened or changed.

Chale status returned `configured: false`, no provider/model, and `paidFallback: false`. Both paid-use and remote-approval flags remain false. Media/live-call status also returned unconfigured. No paid inference, real payment, review submission or staff decision was performed.

## Authenticated account and provider checks

Browser access returned and the owner-approved hosted account became visibly authenticated. A full page reload retained the signed-in identity. The owner entered credentials. Account creation and email confirmation were not independently verified; the observed result establishes hosted sign-in/session persistence, not every authentication journey.

Opened Quick&Handi and Add my service. Saved a private synthetic profile named **EcoVibes QA - not accepting jobs**, explicitly described as a non-operating test service. A zero indicative price was rejected by browser validation; GHS 1 with quote-after-discussion pricing was accepted. The profile remained **unverified**. Changing the service field without saving disabled Submit for staff review. Refresh saved profile reloaded the original persisted service value and discarded the unsaved edit.

An independent anonymous GET confirmed HTTP 200 with zero public providers and no QA profile; anonymous `/providers/me` returned 401. The QA profile remains private on the test account and was not submitted for staff review or offered to customers. These observations do not establish cross-account or cross-organization isolation, staff approval/MFA, or a completed booking.

The approved Supabase Site URL and one exact allowed redirect are saved and visibly verified as `https://ecovibes-api.onrender.com`, with no wildcard. Confirmation/recovery email delivery and callback completion remain untested.

## Still blocked or unverified

- Real sign-up/email confirmation, session revocation, provider review/approval, cross-account/organization isolation and staff MFA still require dedicated hosted verification. The later authenticated observations supersede the initial signed-out/browser-context blocker; provider save/reload and sign-in persistence are now observed.
- Storage configuration/access tests, account recovery and an isolated backup restore remain launch gates.
- Payment callback, reconciliation and refund journeys remain unverified on hosting. Real merchant setup/payment activation remains gated.
- Public Chale inference, real answer quality, quotas and availability remain gated.
- Free hosting remains subject to its service limitations; no paid upgrade or always-on production availability was established.

**Result:** the web/API deployment is live with Postgres. Full customer launch readiness is not established.
