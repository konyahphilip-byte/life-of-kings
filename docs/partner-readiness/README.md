# EcoVibes capability and readiness dashboard

Authoritative current report — 5 November 2026. The [master architecture directive](../directives/2026-11-05-master-system-architecture.md) now governs development: stabilize real journeys, reuse the modular monolith and existing domain records, then Request Market, Repair & Reuse and Industrial Exchange. Games and unrelated expansion remain paused. [Earlier readiness snapshot](2026-11-05-before-architecture.md) is historical evidence.

Deployment and acceptance are separate. The [architecture implementation matrix](../architecture/implementation-matrix.md) uses the founder's WORKING/PARTIAL/BROKEN/MISSING/BLOCKED/NOT VERIFIED vocabulary with explicit evidence scope. No whole-platform completion or launch certification is implied.

## Marketplace 5.0 native catalog increment — 5 November 2026

Founder focus is now independent native Marketplace selling. LOCALLY BUILT on codex/marketplace-native-catalog-20261105, stacked on draft41/555addb, not merged/deployed. New bounded public catalog uses existing products/roles/users, canonical source/price/stock and safe projection; main Shop separates real listings from explicit device examples. Product review reuses PR41 cart including selected IDs beyond the initial window. Native Add My Products is primary; optional import/store tools remain separate. No migration, paid service, external-store mutation or real payment.

Local full642/49 and focused38 passed before final deny-switch test/minor refinement; catalogHTTP15, TypeScript/build1689/security8 pass. Missing-module RED, HTTP14 then expected403/actual404 fixture contract, two test-only type failures, preexecution wrapper and premature report-read failures retained. Final focused and exact CI/PostgreSQL/browser evidence are tracked separately; QA001 cause undiagnosed. Milestone1 remains PARTIAL: hierarchy/attributes/category restrictions, safe photo/publication/storefront and real merchant acceptance are open. Parent40/41 review/migration/release and explicit new release approval remain.145 protected primary source/assets unchanged.

[Marketplace audit](marketplace-5/README.md); [receipt](releases/2026-11-05-marketplace-native-catalog.md); evidence work/marketplace-native-20261105.

## Current production

Last approved source is PR39 main `56e0c2ebf83dfc2c89fccd0bc552691e4ae42b9b`, tree `e957b8480f63014d611ac620d24eeb85066fb99a`. Existing Render deployment `dep-dbm05nm1egvs73atcvh0` was live at 5 November 04:16:40 UTC. Free / Frankfurt / one instance / autodeploy off unchanged.

Exact main CI41966280163/41966280204 passed565 tests /43 files, build1685, audit0, security8, existing HTTP suites, disposable PostgreSQL18.6-84 and39 browser checks.33 anonymous hosted guards passed. Layout stylesheet bytes match; full served JavaScript byte identity and fresh live browser/phone acceptance remain unverified. Browser control is unavailable. Bounded zero-error queries are not sustained monitoring.

No architecture/commerce source below is merged or deployed.

## Account-cart increment — draft PR41

LOCALLY BUILT on codex/commerce-cart-20261105, stacked on draft PR40/e6a0e689; not merged/deployed. Canonical account cart, absolute revisioned updates, immutable checkout requests and per-revision duplicate guard reuse the extracted existing order writer. Current app session/CSRF/actor/seller checks are transaction-bound. Signed-in Bag/catalog review flow preserves separate device previews. Three API-only additive tables are proposed in generated20261105084536 migration, UNAPPLIED; no provider/money activation.

[Draft PR41](https://github.com/konyahphilip-byte/life-of-kings/pull/41) is stacked on40. Candidatea713522/tree30ed7aa0 passed exact CI42006534414/42006534388:616 tests/47 files, build1687, audit0/security8, all HTTP including cart21/order23, disposable PostgreSQL18.6 cart64/message84 and47 built-browser checks(6 account-cart checks at1280/390). Actual logs read. The first narrow browser attempt failed on a hidden sidebar selector; corrected visible-cart checks retain the same deadlines/assertions. Final stock-rejection UI refinement passed25 focused after3 retained REDs; current exact checks are tracked on PR41. Review includes a narrow API-only session-lock helper without widened session write grants.

Retain prior UI6/8, full600 worker termination, focused54/1 unchanged Home/Depth5s timeout, wrong npm child-runtime rejection and earlier failures; QA001 cause remains undiagnosed. Independent review, explicit migration/merge/deployment approval and real buyer/seller/phone acceptance remain. Migration UNAPPLIED; no production schema/source/provider change. All145 protected primary source/assets unchanged. Evidence work/commerce-cart-20261105; [release receipt](../releases/2026-11-05-account-cart.md).


## Prior architecture increment

LOCALLY BUILT on `codex/architecture-commerce-20261105`, from current production. Reuses PR26's exact four Bag tests and guard on the current base; the original draft remains preserved. Extracts only the existing order input boundary, retaining the current stock/price/ownership/transaction service. No migration, provider configuration or new infrastructure.

Actual local results:33 focused and598 full tests /45 files,23 isolated order HTTP checks, TypeScript/build1685, audit0/security8. Baseline Bag0/4 and malformed-order500 REDs retained. Local browser attempt collected0 because the required Chromium executable is absent; Initial code candidate CI41972437379/41972437261 passed598/45, build1685, audit0/security8/all HTTP/PG18.6-84 and41 browser checks. Actual logs, matching tree and checksummed1280/390 Bag screenshots verified. Documentation-only follow-up checks are tracked on [PR40](https://github.com/konyahphilip-byte/life-of-kings/pull/40). Source/release review and explicit merge/deployment approval remain. See [execution receipt](../releases/2026-11-05-architecture-commerce.md) and [architecture baseline](../architecture/README.md).

## Capabilities and acceptance gates

| Capability | Evidence state | What works and what remains |
|---|---|---|
| Web/API/dependency baseline | DEPLOYED, bounded verification | Current PR39 plus retained fixed Node/Vite/Undici. This is not complete security or scale certification. |
| Navigation/Home and collection appearance | DEPLOYED | Centred Create, optional personal/None signup purpose, CSS3D/2D and reduced-motion/saver fallback. Visual depth is not geographic maps or GPS. |
| Happening now | DEPLOYED | Fixed attributed Google Ghana trends, Apple Music Ghana and source-linked Ghana/world news; cache expiry refresh previously verified on hosted UI. Source uptime/coverage/fact checking remain distinct. No fabricated popularity or paid X activation. |
| Chale launcher/Stories/post artwork | DEPLOYED | PR39 header slot, compact phone target, panel/keyboard/focus and selector/spacing fixes. CI geometry/screenshots passed; new physical phone check remains. |
| Main Bag false-success | LOCALLY BUILT; production remains broken | PR26 guard reused. Items remain, no unsaved order claim or payment request. Original draft26 preserved, not merged. |
| Main Bag durable checkout | LOCALLY BUILT; not deployed | Draft41 canonical account Bag reuses existing orders/stock/events with owner/revision/quote-bound retries; device previews stay separate.21 HTTP,64 PostgreSQL,6 built-browser and25 focused checks provide bounded evidence; latest CI tracked on PR. Migration, independent review, release and real buyer/seller acceptance remain. No payment taken. |
| Existing API orders | DEPLOYED; wider acceptance UNVERIFIED | Server creates unpaid order/items/groups with stock/event/audit/notice transaction and ownership projection. New input/rollback HTTP checks are local only; real buyer/seller/provider and PostgreSQL order contention need acceptance. |
| Architecture and schema audit | LOCALLY BUILT | Seven layers/domain/data/API/events/Chale/security/operations/ADR/cost/debt documented.44 RLS tables and12 migrations inspected read-only; no private rows. API authority remains essential with broad runtime grants. Targets are not enabled features. |
| Account recovery/security | LOCALLY BUILT, BLOCKED real acceptance | [Draft24](https://github.com/konyahphilip-byte/life-of-kings/pull/24) remains open. Guard migration unapplied; actual provider/browser cleanup, Auth policy, guarded rollout/rollback and two-account/device acceptance remain. Older source ignoring barriers is not a compatible recovery rollback. |
| Confirmation/recovery email | BLOCKED | Approved exact recovery redirect retained. Missing approved sender/domain/SMTP/credential workflow; provider templates locked. No repeated emails, weaker verification or credential handoff. Two real inbox/callback/expiry/new-password login tests remain. |
| Chale greetings/free inference/app updates | DEPLOYED, bounded evidence |40 member/guest requests/day, UTC reset/free-only/no paid fallback; guest allowance network-shared. Historical real responses do not certify all answers. |
| Chale private status tools | LOCALLY BUILT / UNVERIFIED | [Draft25](https://github.com/konyahphilip-byte/life-of-kings/pull/25) remains open. Nonempty own records, two accounts, account switching, malicious selectors, provider failures, catalog/model quality and quotas remain acceptance gates. |
| Chale character | LOCALLY BUILT prototype | Approved artwork/prototype is not a production rig/GLB/GPU integration. Hidden/unavailable character must preserve chat; no private-conversation training. |
| Accepted-friend text | DEPLOYED; founder round-trip reported | Both phones receiving text was reported, supported by screenshots. Saved history/current relationship/revision/block/owner checks remain.5-second foreground conversation/15-second roster polling is not background push. |
| Notices and message ticks | DEPLOYED; phone acknowledgment UNVERIFIED | PR28 retained: saved and recipient-app-confirmed receipt states, bell notices and nav swap. Founder deferred the new two-phone receipt test. App acknowledgment is not read proof. |
| Owned voice/video | BLOCKED | [Draft31](https://github.com/konyahphilip-byte/life-of-kings/pull/31) exists. Owned TLS/media/TURN hosting/cost/credential approval, active relationship, recipient per-call/video consent, strict revocation and physical/slow-network acceptance remain. No Cloud substitution or keys-only legacy enablement. |
| Profile photos/cover/counts | LOCALLY BUILT | [Draft29](https://github.com/konyahphilip-byte/life-of-kings/pull/29) remains open. Durable storage, migration/release and real-device acceptance are incomplete. |
| Privacy/device permissions | LOCALLY BUILT | [Draft30](https://github.com/konyahphilip-byte/life-of-kings/pull/30), stacked on29, remains open. Separate selected-file/device/share/AI choices and lifecycle cleanup are not hosted/hardware acceptance or legal certification. |
| Shared posts/reactions/activity | NOT IMPLEMENTED on main feed | Main composer saves device-local text. Existing Stories/Reels/follows are narrower backend surfaces; do not equate them with shared main-feed publishing. |
| Recommendations | UNVERIFIED wider utility | Existing opt-in/deterministic ranking has narrower inputs. Need genuine shared interactions, eligibility/privacy, feedback/opt-out and measured usefulness; no cross-app monitoring without supported access and separate consent. |
| Quick & Handi | DEPLOYED primitives, UNVERIFIED full journey | Jobs/offers/assignment/messages and role-specific provider review exist. Customer-to-approved-provider booking, scheduling, evidence, completion and dispute acceptance remain. |
| Real collector GPS/customer tracking | LOCALLY BUILT | [Draft32](https://github.com/konyahphilip-byte/life-of-kings/pull/32) remains open, migration unapplied. Assigned/current review, permission/share consent, expiry/stale/owner handling locally tested; no physical GPS/subscription or production proof. |
| Geographic maps/routes/ETA | NOT IMPLEMENTED / UNVERIFIED | CSS depth is not a map. True coordinates, authorized subscriptions, provider routing, stale handling,2D fallback and physical acceptance remain. No simulated movement. |
| Waste-to-Money | UNVERIFIED full journey | Job-backed request/provider forms exist. Weighing/evidence/collector/facility confirmation, separate value/payment states, actual dispatch, payout and disputes remain incomplete. |
| Finance integrity | PARTIAL implementation, UNVERIFIED integration | Existing payments/refunds/signed canonical callback and event primitives; no general ledger, reconciliation service, safe payouts or financial balance certification. Account-cart order idempotency is local only; durable outbox absent. |
| Domestic/remittance/partner sandboxes | BLOCKED / NOT IMPLEMENTED | Requires approved merchant/capability/credential, currency/corridor/partner and isolated end-to-end tests. No real funds, wallet, unsupported corridor or fees enabled. |
| Request Market | NOT IMPLEMENTED | First new pilot after existing critical gates; reuse jobs/offers/provider eligibility and order/assignment commands. No duplicate checkout or booking source. |
| Repair & Reuse | NOT IMPLEMENTED | Condition/case/evidence plus explicit service/resale/recycling handoffs; references existing domains, not independent transactions. |
| Industrial Exchange/enterprise | BLOCKED / NOT IMPLEMENTED | Organization/membership/material compliance/verified quantity/transfer prerequisites missing. Seller approval does not imply B2B tenant authority. |
| Unified Activity Centre | NOT IMPLEMENTED | Reuse authorized domain identifiers/status/history/next actions; no fictional or cross-account records. |
| Low-data/recovery | UNVERIFIED platform-wide | Existing saver modes/drafts/message retries remain. Broader paging/offline states/form recovery/duplicate protection need real-network acceptance. |
| Trust/support/verified impact | PARTIAL or NOT IMPLEMENTED | Existing verification/reports/staff routes are narrower. Complete cases/resolution history, role-backed badges and measured estimate/user/collector/facility distinctions remain. |
| Shared safeguards | UNVERIFIED | Staff/MFA/organization isolation, durable storage/deletion, backups and isolated restore, monitoring/disable/incident response, payment/refund and low-end hardware acceptance remain. |
| Internal demo/Ghana pilot/public launch | UNVERIFIED / BLOCKED | Separate gates; none complete. Controlled rehearsal, genuine integrated journeys, safeguards and appropriate release/launch authorization required. |
| Games/secondary innovations | PAUSED | Existing code/research preserved. No expansion, new speculative tables or service scaffolding. |

## Next smallest task and approvals

Complete independent review and confirm latest exact checks for draft PR41 and its PR40 parent. Then perform a real buyer/seller order/reload/retry/cancel journey after an explicitly approved migration/release. Request Market must consume this existing domain command, not create another checkout. Continue dependency-ready Auth/Chale/communication/tracking acceptance without rebuilding existing drafts.

This architecture/commerce increment needs exact candidate CI and source/release review, then an explicit bounded founder merge/deployment approval before production. No purchase, paid model/resource, domain/DNS migration, real payment or external-user mutation is authorized. Launch core access and EcoVibes platform fees remain GH₵0 by policy; this increment adds no fees.

Current local evidence: primary `work/architecture-commerce-20261105`. Historical failures, source/asset preservation and prior release evidence remain retained; a green rerun does not explain QA001.
