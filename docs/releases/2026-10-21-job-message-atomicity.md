# October 21 - reliable participant job messages

## Scope and reproduced failure

This continues the October 21 master directive's EcoVibes Connect, access-control, event and notification requirements using the existing job conversation API.

The old send route read participants/status and then saved the message, event, audit and notification separately. A real-HTTP regression reproduced an audit failure returning HTTP 500 while leaving the message and domain event in the disposable database.

The route now reads the job under the same transaction/row lock used by job transitions, checks the current participants and cancellation state, and commits the message, event, audit, notification and response projection together. Input validation and the existing participant policy remain unchanged. A failed write rolls back the send. The existing customer and assigned provider can exchange messages; a staff role alone does not authorize private-chat access.

No new dependency, migration, hosting setting, role grant, payment, general inbox, calling feature or Games integration is included. The private message body is excluded from the event/audit/notification payloads. This is the existing HTTP job conversation, not a new realtime messaging transport.

## Fresh verification

- New audit-failure regression failed against the previous route before implementation, showing a persisted message and event with no audit.
- **95 job HTTP workflow checks passed** against the real local API and temporary SQLite database. The additional checks cover message/audit/event/notification insert failures, successful retry, sender/job/recipient spoofing, raw sender ID redaction, both participant directions, outsider/staff denial, cancelled conversations and concurrent message/cancel arrivals. Child server and database were cleaned up.
- The full dirty checkout passed **243 unit/component tests in 21 files**; unpublished local work is excluded from the release.
- An isolated candidate from published `ebde58091d873b718d810b22cbd09c64ca78e3c3` passed **95 job HTTP checks**, **200 unit/component tests in 19 files**, and the **production build (1,652 modules)**. The existing Communications chunk warning remains.
- The same isolated candidate passed **52 provider HTTP checks** and **58 support HTTP checks**.
- Server syntax and scoped whitespace checks passed. Scope guards confirm only the message route in `server/index.mjs`, `scripts/test-job-workflow.mjs` and this receipt differ from the published baseline. Unrelated dirty work is preserved.

No application environment, real credentials, hosted account or production data was used for local checks. The concurrency check establishes local permitted ordering; PostgreSQL row-lock behavior under hosted contention remains unverified. No production failure injection was performed.

## Publication and deployment

Verified all three uploaded immutable blob hashes and the complete remote tree against the published base. Only the server message route, job fixture and this receipt changed, with no file deletions. Published commit `5f8dc72ce3e63aebedbc2ab4d091924a5be3b3c9`, tree `6b944b4c4be14363655ed53030cc6732b98cb6a5`, through [PR #5](https://github.com/konyahphilip-byte/life-of-kings/pull/5). [PR release checks 39693588065](https://github.com/konyahphilip-byte/life-of-kings/actions/runs/39693588065) passed all steps: install, unit/component suite, build and provider/payment/identity-role/job/support/Chale HTTP fixtures.

Fresh main/PR/mergeability checks and an expected-head guard preceded merge as `356f8e7af5399fe859b3a2e458ff82e3680b2b68`. Independently fetched main confirmed its entire tree equals the verified candidate. [Main release checks 39693719039](https://github.com/konyahphilip-byte/life-of-kings/actions/runs/39693719039) also passed for that exact merge.

Reused the previously approved ECOVIBES workspace and existing Free service, with auto-deploy off. **Render deploy `dep-dbckllbncjis73cp3smg` reached live at 2026-10-21 23:30:35 UTC** on that exact merge commit. **8 anonymous hosted checks passed** after deployment: Postgres health, web shell/security headers, anonymous account isolation, approved-only provider directory, private/staff authentication denial and missing asset/protected-API handling. An error-level application-log query from live time through 23:30:47 UTC returned no entries; this is a bounded check, not proof of error-free operation.

No service settings, credentials, role grants, migrations or hosted test records changed. No hosted private-message exchange, failure injection, PostgreSQL contention experiment, browser screenshot, live payment or real model call was performed. The atomic job-posting runtime is superseded by this deployment. This receipt can be published as a documentation-only update without redeploying the application.

## Remaining boundaries

This adds no transport idempotency key: an unknown network outcome after commit still requires checking history before retrying. It does not implement general direct messages, attachments, blocking, voice/push delivery or cross-organization communication policy. Account recovery/revocation, staff MFA/review, organization isolation, storage/restore, hosted booking/payment/refund and genuine Chale inference remain launch gates.
