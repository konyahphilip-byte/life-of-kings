# Seller and provider role activation — October 15, 2026

## Defect and change

An isolated October 14 HTTP reproduction injected a failing audit write. The API returned 500, but the provider role, blank profile and domain event remained saved. An account could therefore be partly enabled despite a failed response.

`POST /api/v1/identity/roles` now locks the authenticated applicant, rechecks that the account is active, and commits the role, profile and domain/audit event in one transaction. A failure rolls back all of them. Repeated activation preserves the existing profile and verification state without duplicate grant events. A legacy role with a missing profile is repaired with a distinct `ROLE_PROFILE_REPAIRED` event in the same transaction.

Self-activation remains restricted to seller and provider. Client identity, organization, staff-role and approval fields cannot grant another account access or bypass verification. This change does not introduce organization workspaces, staff elevation, or automatic provider approval. No migration is required.

## Exact release candidate

Base: `926bda1f56ecbd6df335389eacedc1b5c4fe9a55`, tree `e37048067ba7364999b42077f17e1e203b19067c`.

This preserves the independently published Chale incomplete-response fix. Its three files were checked against their published blob hashes before verification. The application changes are limited to `server/index.mjs`, `package.json` and the new `scripts/test-identity-roles.mjs`. This receipt and a continuation note accompany them. Unpublished Games code and local research history are not part of the release candidate.

## Actual verification

The final isolated candidate passed on October 15, completing at 22:10 UTC:

| Check | Result |
|---|---|
| Sequential unit/component suite | 143 passed across 15 files |
| Production build | Passed; existing 657.26 kB communications chunk warning remains |
| Identity role HTTP checks | 39 passed |
| Provider ownership/review and static hosting | 44 passed |
| Job transitions | 48 passed |
| Support submission/review | 58 passed |
| Paystack workflow with mocked provider | 24 passed |
| Chale HTTP workflow with mocked model | 15 passed |

The identity checks include injected audit/profile/event failures, authenticated ownership, invalid role/CSRF/origin denial, preservation of approved profiles, idempotent retries, same-role and different-role arrivals, audited legacy-profile repair, staff-queue denial, and suspended-account denial. All HTTP suites use disposable SQLite and synthetic users. No application environment file, real credentials, hosted data or actual payment/model provider is used.

The broader local development tree separately passed 186 unit/component tests across 17 files and 39 identity HTTP checks. That tree contains unpublished Games work, so those counts must not be substituted for the isolated release counts above.

Earlier interrupted verification and publication attempts are not counted as passes. The October 14 full-suite output was lost; release-snapshot preparation was rejected by automatic approval review at an account usage limit and did not execute. This October 15 run obtained fresh ordinary network permission for local HTTP checks and completed independently.

## Remaining release gates

These are local checks, not proof of hosted PostgreSQL locking/contention, Supabase sign-in/recovery, production staff MFA, or organization tenancy. Render workspace confirmation/deployment, provider secret settings, hosted checkout/callback/refund journeys, backup restore and operational monitoring remain unfinished. Payments remain test-only. Rumble African remains behind Gate A; no game implementation or integration is included.
