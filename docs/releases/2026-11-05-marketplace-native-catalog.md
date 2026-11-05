# Native Marketplace catalog — 5 November 2026

Status: LOCALLY BUILT; current code branch codex/marketplace-native-catalog-20261105, based draft41/555addb. No parent/new PR merge or hosted deployment is authorized.

Implemented: bounded native catalog query/public projection; literal search/category/seller/source/base-price/availability filters; stable keyset pagination; active seller/member eligibility; private-field exclusion; deny switch. Main Marketplace uses real records first, separates device examples, reports outages honestly and prepares the existing cart review rather than submitting a legacy order. Source badges are derived from actual records. Native seller entry is primary; optional draft tools and supplier examples remain explicit. Selected products beyond the initial window resolve by ID. Low-data image access is deliberate and remote images are omitted.

Files: server/commerce/catalog.mjs and tests; server/index.mjs; PublicCatalog.tsx/test/styles; MarketplaceHub/App; ServerCart/test; HTTP/PostgreSQL/built-browser tests and two CI workflows; audit/directive/readiness records.

Local evidence:
- Missing-module RED retained.
- First focused38 passed; full642/49 passed before the final deny-only test/minor copy/focus refinement.
- Actual synthetic seller-create/buyer-discover HTTP15 passed. First run14 passed then expected403 but actual privacy-preserving404 on another owner's edit; corrected exact contract plus no-mutation assertion passed.
- Two test-only type declarations corrected; pinned Node26.12.1 TypeScript/build1689 and security8 passed. Existing index/Communications chunk warnings remain.
- Initial wrapper syntax error before edits and premature full-report read retained; no deadline/assertion/worker/isolation weakening.
- New PostgreSQL search/price/cursor/source/eligibility checks and1280/390 built-browser flow are in CI, not yet claimed accepted.
- Historical QA001 cause remains undiagnosed.
- Later final-focused39 run passed34/failed5: first existing App guest-online and ServerCart acknowledgment cases timed out at5s, with later App cases reporting duplicate Bag controls after the first timeout. The underlying cause is unestablished; earlier full642/focused38 do not diagnose it. No timeout/assertion/worker/isolation weakening. Exact CI and browser release gate remains required.
- Subsequent source review reproduced3/3 seller-account privacy failures: old owned listings remained after a switch, late responses repopulated old private rows, and a photo read could dispatch an upload under a later account. Added captured-owner epochs, immediate private-state clearing/view gating, abort/body deadlines, owned-row validation and pre-dispatch/post-response guards across existing seller actions. Photo reads abort on account change; late CSV reads are ignored. Fixed3/3 tests pass. This is bounded client isolation, not full native-publishing idempotency or complete privacy/storage certification. One unsupported test-only ByRole exact option was corrected before the final build.

No new migration. Existing44-table metadata is historical; PR41 migration remains UNAPPLIED. Local/CI fixtures use disposable data with external provider access disabled. No hosted/real Auth/physical merchant/photo-storage/connector/provider-sandbox/payment acceptance is implied.

Independent review, exact latest CI and explicit bounded merge/deployment approval remain. Full Milestone1 is PARTIAL: category hierarchy/dynamic attributes, safe publishing/photo storage, storefront/moderation and a genuine merchant-to-buyer journey remain. No fees, purchases, new infrastructure, external-store mutation or real payments.

Current results/fingerprints/retained failures: primary work/marketplace-native-20261105. See docs/marketplace-5/README.md for the authoritative Marketplace audit and integration backlog.
