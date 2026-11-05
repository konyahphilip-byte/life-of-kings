# Shopify-first reviewed publication — 5 November 2026

LOCALLY BUILT on `codex/marketplace-shopify-journey-20261105`, based on draft PR43 `7f6edfed`. No merge, production migration, storage provisioning, Shopify mutation, payment or deployment occurred. This is a bounded first-publication increment, not complete Marketplace or merchant acceptance.

The founder selected **GR8NESS #8 Black Tee** for the first genuine journey. Earlier read-only connected-Shopify inspection found Life of Kings Store / `lifeofkingsshop.myshopify.com`, GHS220.00 and M/XL/L/S/2XL variants with recorded source inventory. These are source records, not fresh supplier confirmation or EcoVibes stock reservations. The real product has not been seeded into EcoVibes or used as synthetic traction.

## Actual implementation

- Read-only selected-product or bounded active-product import validates exact GHS minor units, complete variants, IDs, inventory and a fixed Shopify image host. Unknown inventory remains unknown; incomplete records are skipped explicitly. All source reads finish before the draft transaction. Existing published/removed listings are retained rather than silently overwritten. Maximum four pages is explicitly incomplete when more source products remain; selective IDs are supported for the first journey.
- A shared commerce authorizer reuses current active-account/session/CSRF boundaries. Imported drafts require explicit review, category details, confirmed supply, per-variant EcoVibes allocation and fulfillment/cost terms. Ordinary PATCH cannot activate a never-reviewed Shopify draft.
- Publication changes the existing canonical product, appends its event/audit and saves an immutable owner/operation-bound receipt in one transaction. PostgreSQL uses a seller row lock; retry cannot create another listing, stored object, receipt or order. Receipt replay reports current listing state, not an unconditional current-success claim.
- Optional source-photo copying requires separate public storage/use consent. It uses the existing private media adapter with bounded bytes, image signature checks, fixed source host, no redirects, timeouts and deterministic retry keys. Lost storage acknowledgment can be resolved against the same bytes. Failed deletion keeps metadata; cleanup does not knowingly remove a referenced asset. Public catalog photo access now checks an active product and active seller membership, correcting the guest-photo 401 reproduced in HTTP testing.
- Seller UI replaces the browser domain prompt with an inline domain form, shows connected-store imports and paused review, starts allocation at zero and preserves immutable retries. Captured-account requests and unmount guards prevent late responses from updating a different account. Error notices no longer use a success check icon in this hub.

## Tests and retained failures

- Focused source/storage/review/account-switch checks: **13 passed**. Initial source-module RED retained.
- Actual isolated HTTP/SQLite seller→source draft→consented stored photo→category discovery→selected-size cart→one unpaid order→app restart: **16 passed**, using synthetic accounts, source and storage. The provider-backed photo survives an app restart in this fixture. No hosted or real Shopify import is implied.
- Both generated read-only GraphQL queries validated against Shopify Admin **2026-07**. Official validator notes `featuredImage` is deprecated but supported; a future `featuredMedia` migration remains technical debt.
- TypeScript, Vite production build, eight dependency-security assertions and audit **0 vulnerabilities** passed. Existing large bundle warnings remain.
- Full local run: **659 passed / 19 failed of 678**. Failures include existing 5-second timeouts, duplicate DOM and missing-heading reports; retained in `full.json`. No deadlines, assertions, workers or isolation were weakened. No cause is inferred for QA001 from these runs or subsequent passes.
- Retain initial synthetic connector-field failure; HTTP9-pass/guest-photo401 RED; HTTP13-pass/restart failure; subsequent startup failure and corrected harness callback history. Final HTTP16 passes do not establish the cause of unrelated timing failures.
- New PostgreSQL publication migration/concurrency/rollback/revocation checks and 1280/390 built-browser review checks are added to existing CI. Their exact candidate results must be read before release. Local PostgreSQL binaries are unavailable; no provider database was used as a substitute.

Primary evidence: `work/marketplace-shopify-20261105`, including focused/full reports, GraphQL validation, HTTP attempts/final report and build/security logs.

## Migration, disable and rollback

Proposed additive `20261105170000_product_publications.sql` remains **UNAPPLIED**. It creates only publication receipts; canonical products, order and cart services remain authoritative. RLS, no direct browser/service-role grants and runtime SELECT/INSERT-only receipt access are required and tested in disposable PostgreSQL CI. Parent PR41 cart and PR43 classification migrations remain separate, unapplied prerequisites.

`ECOVIBES_PUBLISHING_DISABLED=true` denies reviewed publication. Missing schema fails closed before imports. Rollback to the reviewed parent preserves products, photo references, receipt history and parent cart/order history; never erase receipts or rerun import over active inventory. Do not roll back parent cart schema while outstanding carts/orders exist. No production rollback drill has been performed.

## Outstanding release and real-merchant gates

1. Resolve or independently assess full regression failures; inspect exact-source CI, PostgreSQL and browser artifacts, then obtain independent source/release review. This draft is not merge-ready or end-to-end verified.
2. Review parents PR40–43 and approve the exact compatible migration/merge/deployment stack. Current production remains PR39 `56e0c2eb`.
3. Approve and configure existing-host private object storage, its access/retention/deletion policy and supported credential workflow. Do not expose keys or substitute ephemeral production disk. Failed-write orphan cleanup, image metadata/sanitization, deletion/recovery and real provider/restart acceptance remain open.
4. Complete the existing EcoVibes app's official Shopify read-only authorization for the seller. The connected chat Shopify account is not an EcoVibes authorization token. Existing refresh/OAuth ownership/concurrency, expired/missing legacy connection fields and actual provider response-loss behavior still need acceptance; this increment does not certify that older credential path.
5. On the authorized seller, selectively import the chosen tee, confirm its actual supply, EcoVibes size allocation, pickup/delivery terms and photo rights, then publish after approved release. Use a distinct real buyer for discovery, selected size, unpaid order/reload/retry/cancellation and stock restoration. No real payment or source-store inventory mutation is authorized.
6. Verify physical phone, low-data/offline/account-switch and production storage behavior. Pausing/reimporting a previously published item requires a new review; automatic cross-channel reservation/sync, large-catalog continuation UI, repricing/republication and full lifecycle acceptance remain future work.

The immediate buyer/seller benefit is a reviewable source import that preserves variants, avoids accidental overselling from resync, and connects one real listing to the existing durable order journey. It adds no EcoVibes fees, fabricated metrics, paid services, new infrastructure or Request Market scaffolding. Request Market remains behind genuine seller-to-buyer acceptance.

## Initial exact CI checkpoint

Code57823e1: releaseCI42106982689 passed678tests/56files/build1693/audit0/security8/all HTTP, PostgreSQL18.6 cart/catalog/classification/publication95 and message84; actual logs read. BrowserCI42106982749 cancelled during dependency installation and is not UI acceptance. A final repair adds a signed-in/guest withdrawn-seller photo check;16 local HTTP checks pass. Latest-head exact CI and browser acceptance remain required. Draft PR44 is open, unmerged and undeployed. Initial local failures remain retained and undiagnosed.
