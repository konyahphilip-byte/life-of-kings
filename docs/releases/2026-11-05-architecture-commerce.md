# 5 November — architecture baseline and commerce boundary repair

Status: LOCALLY BUILT. Based on released main56e0c2ebf83dfc2c89fccd0bc552691e4ae42b9b/treee957b8480f63014d611ac620d24eeb85066fb99a. No production change or deployment approval is included.

## Actual source changes

- Reuse PR26's Bag guard and its unchanged four-case test file on the current release base. The Bag no longer clears items or claims an order. It directs to the existing account marketplace with an honest ordering boundary. PR26 remains preserved; this is current-base integration, not a new durable checkout.
- Extract the existing order-input grouping into server/commerce/order-input.mjs, used by the existing order transaction. Reject malformed envelopes/lines, unsafe/fractional/coerced quantities, invalid variants and aggregate overflow with controlled400 errors. Sort product access consistently. No new database/provider abstraction or state machine.
- Add29 pure boundary tests,23 actual HTTP checks against disposable SQLite/synthetic accounts and browser Bag regression checks. CI includes the new HTTP suite.
- Document the existing seven layers, domain ownership, ERD/data flows, module dependencies, APIs, event/AI contracts, security, operations/flags, cost/scale, debt, current-versus-target matrix and modular-monolith ADR.88 source route branches indexed; not an OpenAPI completeness claim.

## Verification so far

Actual pinned Node26.12.1 commands:
- node node_modules/vitest/vitest.mjs run src/modules/App.checkout.test.tsx server/commerce/order-input.test.mjs:33/33.
- node node_modules/vitest/vitest.mjs run:598/598,45files.
- node scripts/test-commerce-orders.mjs:23/23; canonical actor/price, no-write invalid inputs, atomic audit-failure rollback, stock/cancellation and other-buyer isolation.
- npm run build:TypeScript and1685modules pass; existing large client chunk warnings remain.
- node scripts/test-dependency-security.mjs:8 HTTP assertions pass, fixed installed runtime/dependency versions retained.
- npm audit --audit-level=high --ignore-scripts --json:0 vulnerabilities, exit0.
- Local browser attempt collected0 checks because the required Playwright Chromium executable is missing. Linux CI browser checks are still pending; no local/hosted/device visual pass claimed.

REDs preserved in primary work/architecture-commerce-20261105: original Bag0/4; malformed-null HTTP returned500 after2 guards passed; subsequent33 focused/23 HTTP/full598 passed. Prior QA001 timing history remains undiagnosed. No deadlines, assertions, test isolation or workers weakened.

Read-only Supabase metadata reports44 public tables, all RLS;12 migration-history entries. Browser anon/authenticated roles have no direct grants; runtime grants are broad and require API authorization. This is not complete security/tenant certification. Initial guessed role42704 and FK join correction retained. No private user/Auth rows, credentials, emails or hosted schema/config read/write mutation.

## Limits and release gates

No durable main-Bag checkout, order idempotency, ledger/outbox, organization isolation or new innovation pilot is claimed. SQLite rollback and unit lock ordering are not PostgreSQL concurrent-order, provider sandbox or hosted acceptance. Existing full CI/PostgreSQL/browser checks must pass for the exact candidate. Independent source/release review and explicit owner merge/deployment approval remain. Current production is still PR39 main56e0c2eb/dep-dbm05nm1egvs73atcvh0.

No migration is needed. Previous main56e0c2eb is a schema-compatible source rollback for this increment, not a drill. Existing Auth barrier drafts have separate rollback constraints and are excluded. Dirty primary source/assets and other draft branches are preserved.

No EcoVibes platform fee, commission, paid service, resource, money movement, provider credential or external-user record was introduced.

Next smallest implementation: durable cart items tied to canonical server products/variants and an actor-bound idempotent order command, including ambiguous-response/retry and PostgreSQL concurrency acceptance. Request Market should consume those domain services after existing critical gates, not duplicate checkout/booking.
