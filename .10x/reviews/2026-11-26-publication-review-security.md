# Publication review security self-review
Reviewer: Codex acting in security-review role; not an independent human review.
Source: isolated publication-review branch based on8ef89f7.
Checked: authenticated current sessions/CSRF, current staff table and existing production MFA, immutable UUID scope, explicit self acknowledgement, exact content/version binding, retry conflict denial, private Studio history, separate publication, conservative category denial, feature-off edit/checkout/visibility guards.
New proposed receipt table is append-only for PostgreSQL runtime; browser/service roles receive no direct access. SQLite triggers deny mutation. Real PostgreSQL execution remains pending remote CI.
Risks: complete universal taxonomy/legal controls are unfinished; keyword screening is not comprehensive moderation. No production founder role/scope or migration authorized. Real enrollment, provider/device acceptance and broad category activation remain release gates.
