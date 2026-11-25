# M01 foundation security self-review

Review type: role-based self-review, not independent production sign-off.

New code is unregistered and imported by no existing API/application path. No SQL migration, authentication replacement, order writer, checkout, stock mutation, provider key or production flag was changed. No new package or paid service was introduced.

Configuration uses strict known fields/tokens, rejects executable/unknown fields and cross-shop product references, detaches snapshots, invalidates local approval after edits and has a per-shop fallback. Renderer escapes content; fixed code, not model output, chooses components.

Authorization adapter derives actor from existing server context, requires injected current-session checks and current active membership, distinguishes owner/designer/enquiry roles, and rejects prototype/constructor role names explicitly. It is not a deployed authorization system. Real locked membership queries and same-transaction authorized work must be implemented and tested before endpoint registration; returned metadata is not a capability token.

Public projection requires explicit publication, moderation, listing status, merchant and shop visibility/status, category eligibility and matching merchant ownership. It omits private cost/supplier fields. No actual public read or index adapter currently uses it. The baseline Chale/Marketplace SQL needs convergence before activation.

Historical slug aliases are checked against immutable shop identity; unsafe/reserved names, duplicate aliases, hidden/suspended/unpublished destinations fail closed. Database unique constraints, tombstones, transaction races, HTTP response policies and cache revocation are still required. HTTPS origin verification here is an operator configuration assertion, not proof a production shop route exists.

No private records, source images or prompts were sent for model inference. Hugging Face was used for public card research only. No production readiness or exhaustive penetration-test claim follows from these contracts.
