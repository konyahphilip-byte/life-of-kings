# ADR004 — Version-bound publication review receipts
Status: Accepted for isolated development. Date:26November2026.
Context: the approved solo-founder exception must be distinguishable from ordinary moderator review and must not become automatic publication.
Decision: exact immutable UUID scope from server environment; current authorized admin plus existing MFA; explicit separate review with content hash/revision/reason; append-only database receipt; publication revalidates policy and receipt. No production scope configured. Product saving and seller publication stay separate.
Alternative: reuse only approved_by/revision. Rejected: loses decision history, reason and reviewer capacity. A separate moderation service is unnecessary for one existing API and zero approved spending.
Consequences: new additive private receipt schema and migration marker; old native approvals without a receipt cannot publish after this increment. Native fallback guards must remain. Large universal taxonomy is not silently folded into this bounded change.
