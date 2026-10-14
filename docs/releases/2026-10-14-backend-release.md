# EcoVibes backend release candidate — 14 October 2026

## Scope

This candidate is based on published commit `9caecd62f632781b10105a0197f92d2698011353` and contains the reviewed Quick&Handi job-transition and support-review fixes. The existing application UI and other features in that published baseline are preserved.

- Job start, finish, completion, dispute and cancellation recheck participant/status under a transaction, with a PostgreSQL row lock and conditional prior-state update. Job state, related support case, domain/audit events, notifications and opted-in signals commit or roll back together. Repeated or losing transitions return 409 without duplicate side effects.
- Support submission saves the case, domain event and audit atomically. Staff review saves the status, reasoned audit and reporter notification together. Conflicted staff cannot review their own reports or related transactions in which they participate. Repeated/closed transitions return 409. Internal notes are not sent to the reporter, and closing a case does not settle a job, order or refund.
- Added isolated HTTP regression scripts for jobs and support; no database migration was needed.

The October 13 Rumble African brief requires explicit research/design/art/integration approvals. Unpublished game implementation and app Games changes are excluded from this candidate. Local work and history remain preserved. Nothing in this backend release approves game integration.

## Verification of this exact candidate

The candidate was built in an isolated export of the published baseline with only the two backend patches applied. Application environment files were not loaded. No hosted database or real external provider was contacted.

| Check | Result |
|---|---|
| Unit/component tests, sequential files | 140 passed in 15 files |
| Production build | Passed; existing communications chunk warning (657.26 kB) |
| Job HTTP workflow | 48 passed |
| Support HTTP workflow | 58 passed |
| Provider/ownership/static-host HTTP workflow | 44 passed |
| Paystack HTTP workflow | 24 passed, mocked test provider |
| Chale HTTP workflow | 15 passed, mocked model |
| Server syntax | Passed |

Counts differ from the local main development tree because the unpublished Games foundation and its checks are excluded. The two regression scripts and package manifest exactly match the tested local implementations. The server differs from local main only by excluding unpublished Games imports/routes. Comparison against the published baseline found no other changed existing application files.

## Release limits

This receipt records local verification, not a live deployment or payment readiness. Hosted PostgreSQL contention, Supabase sign-in/recovery, production staff MFA, payment/refund callbacks, backups/restore and full organization tenancy still need verification. Render workspace confirmation and secret configuration remain outstanding. Payments remain test-only. No provider credentials or application environment files belong in this release.
