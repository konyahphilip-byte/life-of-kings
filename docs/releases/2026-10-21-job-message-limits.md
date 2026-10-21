# October 21 - bounded participant job messaging

## Scope and observed behavior

The October 21 directive requires server-side abuse protection and accountable communications. The existing participant-only job conversation had no send limit: a new real-HTTP regression sent twenty messages and observed the twenty-first accepted with HTTP 200 instead of the intended HTTP 429.

The route now uses the existing database-backed limiter to allow **20 successful job-message sends per account in a one-minute window**, shared across all of that account's job conversations. Participant/cancellation checks and body validation run first. The allowance is updated inside the existing message transaction, so a failed message, event, audit or notification write also rolls back its allowance use. A blocked send returns a structured `message_rate_limited` error with a human-readable wait instruction and creates no communication records. It does not extend the window on each rejected retry.

This reuses the current account identity, limiter, transaction and notification infrastructure. No schema, dependency, hosting configuration, credentials, role grants, payment or Games change is included. Existing cancellation/access rules and message-body minimization remain in place.

## Fresh local verification

- The new twenty-first-send assertion failed against the previous implementation: **200 instead of 429**.
- **134 job HTTP checks passed** after implementation. These cover exact-boundary sending, cross-conversation/spoofed-sender bypass attempts, independent participant allowances, expiry reset, denied/invalid sends, four write-failure rollback cases, and concurrent arrivals competing for the final account allowance. Only one of the two competing sends commits.
- The dirty checkout passed **243 unit/component tests across 21 files**, plus server syntax and scoped whitespace checks. Its unrelated unpublished work is excluded from the release.
- An isolated candidate from published `1f7a68ddeef0ca0037e664222ae45efffe84bb05` passed **134 job HTTP checks**, **200 unit/component tests across 19 files**, and the **production build (1,652 modules)**. The existing Communications bundle-size warning remains.
- The same candidate passed **52 provider HTTP checks** and **58 support HTTP checks**.
- Baseline equality and scope guards confirm only the message route, job fixture and this receipt are selected. The root checkout and unpublished Games files are preserved.

Fixtures used the real loopback HTTP API, temporary SQLite and synthetic accounts, without the application .env, hosted records or real credentials. Fixture teardown stopped its child API and removed its temporary database. Expiry and near-boundary state were set only in that disposable database, with no real-time sleep or production failure injection.

## Publication

Verified all three immutable blob uploads and the complete remote tree against the published base: exactly the message route, fixture and this receipt, with no file deletions. Published commit `a2d226013358b5889226fa94d14143360b8c1f9d`, tree `9c794daa1df1060a457548b0651cea70dc753159`, through [PR #6](https://github.com/konyahphilip-byte/life-of-kings/pull/6). [PR release checks 39695630425](https://github.com/konyahphilip-byte/life-of-kings/actions/runs/39695630425) passed every step, including provider/payment/identity-role/job/support/Chale HTTP fixtures.

Fresh main/PR/mergeability checks and an expected-head guard preceded merge as `7eb90aba0170c3813147a3745d70cd04bb1c0803`. An independent main read confirmed that its full tree exactly matches the verified candidate. [Main release checks 39695790104](https://github.com/konyahphilip-byte/life-of-kings/actions/runs/39695790104) also passed for that exact merge.

## Hosted deployment

Reused the approved ECOVIBES workspace and existing Free service, one instance, with auto-deploy off. **Render deployment `dep-dbckuplg1s2s73dl4v90` reached live at 2026-10-21 23:49:59 UTC** on the exact verified merge commit. **8 anonymous hosted checks passed** after deployment: durable Postgres health, web shell/security headers, anonymous account isolation, approved-only provider directory, private/staff authentication denial and missing asset/protected-API handling.

The application error-level log query from live time through 23:50:51 UTC returned no entries. This is a bounded observation, not a claim of error-free operation. No hosted messages, bursts, test records or failure injection were created. No configuration, credential, permission, migration, browser screenshot, payment or real model call was involved. The prior job-message atomicity runtime is superseded by this release. This receipt can be published as a documentation-only update without redeploying the application.

## Limits and open launch gates

This is local SQLite ordering/rollback evidence; hosted PostgreSQL contention and distributed-load behavior remain unverified. The fixed-window limit reduces message/notification bursts but is not comprehensive spam detection, moderation, blocking or an account-creation abuse solution. It adds no retry idempotency key or realtime transport. Hosted recovery/revocation, staff MFA/review, organization isolation, storage/restore, real booking/payment/refund journeys and genuine Chale inference remain separate launch gates.
