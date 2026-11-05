# ADR0001: Evolve the existing modular monolith through tested domain seams

Status: Accepted for this local development increment; not production approval.
Date:5November2026.
Decider: Founder architecture directive; implementation review/production authorization remain separate.

## Context

The working alpha uses React/Vite, one Node API, PostgreSQL and existing domain/event/order/message records. Many rules remain inline in server/index.mjs. Open drafts contain unmerged safety/identity/media work, and the primary workspace is dirty. New innovations need reliable shared workflows, not parallel services.

## Decision

Keep the existing runtime, API contracts, database and deployment. Begin with a pure commerce order-input module injected into the current order transaction, reuse the existing Bag safety fix from PR26, and document current-versus-target boundaries. Do not replace orders/jobs/identity, add an event broker or provision services.

Request Market must orchestrate existing verified services and orders after P0 safety/idempotency prerequisites. Repair & Reuse and Industrial Exchange follow it; speculative modules remain unbuilt.

## Options considered

| Option | Complexity/cost | Benefit | Constraint |
|---|---|---|---|
| Targeted module seams and existing transactions | Low incremental cost, no new service | Preserve tested ownership/state and release small diffs | Inline router remains technical debt |
| Rewrite the application into feature packages now | High migration/retest cost | Uniform structure | Risks working features and ignores open acceptance gates |
| Microservices/broker/cluster now | High operational cost | Independent capacity in theory | No measured need, adds distributed failure/transaction problems |

## Consequences

Validation can be tested without database or provider access, and consistent product ordering supports the existing lock protocol. Authorization, pricing, stock reservation, events and audit stay in the current server transaction. This does not implement idempotent checkout or a completed Request Market.

Further extraction should move one complete tested command at a time behind a service interface, with transaction context explicitly shared. A durable outbox is warranted only when a real critical async consumer requires it; current event rows are not described as an operational bus.

No schema change is necessary for this increment. Compatible rollback is released main56e0c2eb; no drill. Main Bag durable order creation, sensitive-request transaction-time authorization, PostgreSQL concurrent order acceptance, provider sandbox, sender and restoration remain gates.

## Acceptance and follow-up

Local evidence must include malformed-input RED, unchanged successful order semantics, order/event/audit rollback, account isolation, Bag preservation, full regression/build/security and exact-source CI. Production is unchanged until explicit approval. Keep launch fees0.

Next smallest command improvement: owner-bound durable cart identity and idempotent order create/recovery, then a verified service-request→offer→assignment orchestration; avoid speculative feature scaffolding.
