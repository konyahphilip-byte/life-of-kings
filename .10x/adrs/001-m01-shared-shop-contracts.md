# ADR-001: Identity, appearance, routing and one catalogue

Status: Accepted product architecture; local contracts only. Recorded 25 November 2026 after the founder explicitly approved these architecture rules. This is a retrospective capture when the engineering workflow was invoked, not a claim that this file preceded the source.

## Context
A merchant must change a storefront design without losing products, public links, memberships or conversations. Existing EcoVibes already has identity, products, Chale and Connect. GH₵0 extra budget and production changes are prohibited.

## Decision
Keep the existing modular backend. Add stable merchant/shop identity and memberships through reviewed additive migrations later. Appearance is strictly validated data, not executable generated code. Public slug aliases resolve to the same immutable shop. One eligibility projection reads one listing authority for all public surfaces.

## Alternatives
- Copy a standalone shop per template: quick visual independence, but duplicates data, identity and conversations; rejected.
- Use one identical theme globally: simpler, but loses independent merchant expression and universal Discover identity; rejected.
- Use a shared renderer with separate identity/theme/route records: selected. Requires careful tenant authorization, publication coordination and migration/backfill evidence.

## Consequences
Template reuse and switching are independently testable. Existing products must gain explicit publication and shop authority before new public routes activate. Legacy public/Chale filters must converge. An unregistered pure module is not a deployed feature. No new paid dependency, service or separate merchant server is introduced.
