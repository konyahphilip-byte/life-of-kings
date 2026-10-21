# October 21 - atomic job posting

## Failure and fix

The existing `POST /api/v1/jobs` route inserted an open job and then wrote its domain event and audit separately. An injected audit failure returned HTTP 500 but left the job and event in the disposable database. The new regression reproduced that failure before the implementation changed.

The route now uses the existing database transaction helper for the job insert, event, audit and response projection. Failure at any of those writes rolls back the transaction. Input validation, session/CSRF/origin requirements, server-selected customer ownership and the public response shape remain unchanged. No dependency, schema, migration, hosting setting, payment or Games change is included.

The fixture verifies failed job insert, failed event and failed audit, then a successful retry with exactly one job, event and audit. It also checks anonymous/missing-CSRF/cross-origin rejection, ignores forged ownership/assignment/status fields, preserves another account's records, keeps raw participant IDs redacted and retrieves the successful job through the API.

## Verification

- The new audit-failure regression failed against the previous route with an open job and domain event left behind.
- The first post-fix run caught a new test's incorrect assumption that private participant IDs were returned. Existing API redaction was correct; ownership assertions were moved to the disposable database and the public Eco ID was checked separately.
- After that test correction: **63 job HTTP workflow checks passed** against the real local API and temporary SQLite database. Cleanup stopped the child API and removed its database.
- Full dirty-checkout unit/component suite: **243 tests in 21 files passed**. This includes unrelated local work and is not the release candidate's count.
- Isolated candidate from published main `0bdb6a76c134319cd755f2276a78a52e183bddbc`: **63 job HTTP checks**, **200 unit/component tests in 19 files**, and the **production build (1,652 modules)** passed. Existing Communications bundle warning remains.
- Server syntax and scoped diff whitespace checks passed. Hash/scope guards confirm only `server/index.mjs`'s posting route and `scripts/test-job-workflow.mjs` changed, plus this receipt.

No application environment, real credentials, hosted account or production database was used for these checks. SQLite evidence does not establish hosted PostgreSQL contention or a complete booking/payment flow. An unknown network outcome after a successful commit can still require checking the job list before retrying; this change adds no idempotency key.

## Release boundaries

Only the posting route was ported onto the published server; unrelated dirty source and unpublished Games remain preserved. No hosted failure injection is authorized by this receipt. Real Chale inference, recovery/revocation, staff MFA/review, cross-account/organization isolation, storage/restore and payment/refund verification remain launch gates.
