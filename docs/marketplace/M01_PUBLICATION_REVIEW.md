# Audited publication review —26November2026

Status: isolated implementation; final qualification pending. No release approval or real founder scope activation.

## Contract and boundaries
The existing sessions, CSRF, current staff_access roles and production MFA, immutable shop ownership, native product revision, media, audit events and separate seller publication are reused. This is not a new checkout or moderation service.

The server-only ECOVIBES_M01_FOUNDER_REVIEW_SCOPE value contains exactly accountId and shopId UUIDs. Absent scope denies self-review. It never matches an editable name/slug, grants an admin role, creates a real shop or changes ownership. Deployment operators must separately verify and authorize the actual founder account/shop binding; no real UUIDs are configured here. Ordinary sellers retain private drafts but cannot review them. Existing authorized trust/admin moderators use the same queue and receipt contract.

Review requires a fresh server snapshot hash, exact revision, explicit approved/rejected decision, reason, unique request ID and, for the scoped owner/admin, explicit self-review acknowledgement. The snapshot contains actual content, ordered owned photo references, creator, shop and version. The same transaction stores the immutable receipt and changes review state. A retry returns its original receipt; changing its meaning under the same request ID is denied. Approval itself leaves the listing in draft. Seller publication separately checks current eligibility, exact receipt/hash/reviewer/policy version and the existing supply/publication confirmations.

Receipt history stores creator, reviewer, timestamp, reason, decision, exact snapshot/hash/version and founder_self_review or moderator_review capacity. Studio reload can inspect the latest20 receipts for its authorized listing. Self-review is visibly not independent third-party verification. SQLite denies receipt UPDATE/DELETE via triggers; the proposed PostgreSQL migration grants the runtime SELECT/INSERT only and denies direct anon/authenticated/service-role access. No hosted migration ran.

## Category controls and unfinished taxonomy
The native pilot's three values are temporary, not the approved comprehensive universal taxonomy. This increment conservatively enables manual review of ordinary Fashion/Home goods; Beauty publication is withheld pending regulatory controls. Known restricted-content screening cannot certify legal compliance or comprehensively detect deceptive classification. Unknown categories fail closed. No founder, moderator, alias or AI client can override these server decisions.

The full TAX-01–TAX-07 registry, category-specific schemas, complete risk policy, incomplete base drafts and Chale assistance remain unfinished and are required before broad Marketplace activation. Do not use this narrow pilot policy as a complete universal taxonomy.

Primary regulatory references reviewed26November2026: [Ghana FDA cosmetics/household product registration](https://fdaghana.gov.gh/services-2/product-registration/cosmetics-household-chemicals/) and [food registration](https://fdaghana.gov.gh/services-2/product-registration/food-registration/). Product-image permission is distinct from applicable regulatory authorization. This implementation does not verify FDA registration.

## Regression and preservation
The enabled native pilot already denied legacy edits. A new exact-parent regression reproduced a feature-off gap: PATCH /marketplace/products/:nativeId returned200 instead of409 and could change an unreviewed price. The existing guard now remains active whenever native records exist. Checkout denial and public visibility isolation also remain active during withdrawal.

Do not describe the first enabled-mode test as a red failure: it passed and is preservation evidence. The retained actual red is work/publication-review/fallback-parent-red.log, run against parent8ef89f7 on a copied synthetic database. The new policy and review-control tests first failed for absent implementation, then passed. All original logs remain retained.

Tests: node scripts/test-publication-review-policy.mjs; node scripts/test-m01-native.mjs; node scripts/test-m01-review.mjs <passing-native-report>; node scripts/test-m01-fallback.mjs <passing-native-report>; node scripts/test-m01-native-postgres.mjs with disposable tooling. Existing unit/type/build/security/identity/payment/message/browser regressions remain required. Final commands, exact hashes and results are in the external receipt; source documents must not imply that pending gates passed.

## Operational and release requirements
No paid dependency or model call added. No source sent to AI. Receipt storage grows with decisions; the schema indexes product/version/history and shop/time. Queue50 and history20 are bounded. No load, free-tier capacity or long-term retention benchmark is claimed. Review history must not be silently deleted to save space.

Keep flags default-off and all draft dependencies unmerged. Production requires independently reviewed scope enrollment, migration/permissions validation, reviewed full taxonomy/activation policy, hosted/account/device verification and separate founder release approval.

Withdrawal must retain the native public/media/edit/checkout guards and hide records while native availability is false. Keep additive records and receipts. Never revert to a build that restores unreviewed legacy mutation, false Bag success, cart clearing or native checkout. No destructive schema rollback or production recovery execution is claimed.

The browser proof uses synthetic local accounts and a green generated test image, not genuine supply or independent staff. It is desktop emulation, not physical-phone or screen-reader acceptance.

Local full-gate exception:695 passed/3 failed in unchanged Bag/navigation tests; all3 also failed on exact parent locally. Parent remote696 passed. A mistyped payment command failed before running any test; corrected to the actual existing scripts/test-paystack-workflow.mjs. These failures remain retained, never counted as passes.

Inventory journey correction: remote RED atbc689e8/run45805008399 had698 passed and only the expected stale-inventory assertion failed. The scoped refresh loads current records on inventory entry and discards a response after unmount/account-generation change. Focused Studio/review UI8 passed after the correction; TypeScript passed. Exact-final CI is recorded separately after commit.

Latest local normal disk-writing build failed with ENOSPC while writing an image asset after the inventory correction. This is retained at work/publication-review/build-final.log, not counted as a passing final build. Focused UI8 and TypeScript passed. An in-memory preview build is being evaluated; exact-final remote normal build remains mandatory.
