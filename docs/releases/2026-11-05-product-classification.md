# Product categories and seller attributes

Status: LOCALLY BUILT on codex/marketplace-categories-20261105, based draft PR42/09a51539. Not merged/deployed. No hosted migration, provider, fee or real-money activation.

Buyer/seller outcome: clearer comparison of condition, storage, material and selling unit, relevant fields without unrelated questions, and predictable category discovery. Required details are validated before photo reading/upload. These are seller declarations, not an inspection, sourcing guarantee or verification. Synthetic seller-to-buyer tests do not establish improved sales, measured time savings or genuine traction.

Implementation:
- One versioned shared taxonomy: six parents/twelve leaves with bounded enum, text and integer attributes and product-type checks. Only declared schema keys persist; private/unknown values, unsupported versions and unsupported category IDs are rejected. This is not automated restricted-content moderation; a malicious title/category mismatch still requires moderation.
- Existing products gain nullable category_id/category_version and bounded attributes_json. Existing free-text categories remain unclassified and are not inferred from names or descriptions. One additive migration is proposed, UNAPPLIED; no new identity/order/payment tables or privileges.
- Native UI requires category-specific fields. Existing legacy API/import clients remain compatible and produce unstructured records; global mandatory classification/legacy migration remains a rollout gate. Structured submissions cannot omit required attributes or clear their classification through a partial update. Missing schema denies structured work, not legacy discovery.
- Product create/edit and import metadata are transactional with product/audit writes. PATCH validates status/price/stock/details before writes and rechecks seller membership. Captured-account protections remain. Consequential publish idempotency/concurrency/session revocation remain broader gates.
- Buyers filter stable category IDs, including parent descendants, and see only saved permitted attributes. Legacy exact-label search remains separate. Paging cursors bind the category; pre-upgrade cursors require refresh. No fake inquiry/request button or metrics added.

Local evidence: initial missing-module RED; first shared/catalog32 tests passed; pre-wiring UI30/31 with missing Condition control, then wired31/31; full666 passed before final two compatibility tests. Actual isolated HTTP15 passed, TypeScript/build1691, audit0/security8 passed. Exact-source CI, PostgreSQL migration/grants/constraints and built browser seller/buyer switching are required before release. Historical QA001 remains undiagnosed; no deadline/assertion/worker/isolation weakening. Initial source write EPERM and missing reference/glob diagnostics retained; no credentials/provider data used.

CI includes exact migration against disposable PostgreSQL, runtime read/write and browser-role denial checks, malformed metadata rollback and real category queries. Browser tests exercise native seller form acknowledgment then a separate synthetic buyer's category filter and visible declarations at1280/390. Those fixtures are not real Auth/merchant/device/provider acceptance.

Release gates: review draft PR40/41/42 parents and this increment; review additive cart/classification migrations and compatible data-preserving rollback; explicit founder migration/merge/deploy approval; exact green candidate/main CI; hosted and two genuine merchant/buyer/phone journeys. Apply the classification migration before new UI publication, or structured submissions return503. Rollback app to PR42 while retaining added metadata/index/marker and all seller data; do not drop columns or erase records. Core platform fees remain GH₵0.

Next smallest implementation: durable native publication retries/confirmation and safe photo storage, then genuine merchant acceptance and actionable request-to-eligible-offer-to-existing-order integration. Categories alone do not complete Marketplace Milestone1 or Request Market.

Exact evidence and retained failures: primary work/marketplace-categories-20261105. Final commit/CI identity is tracked in its checkpoint and draft PR.
