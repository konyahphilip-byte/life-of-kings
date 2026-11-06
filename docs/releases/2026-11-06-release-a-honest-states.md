# Release A: evidence-backed interface states — 6 November 2026

LOCALLY BUILT on `codex/release-a-honest-states-20261106`, based on saved PR44 `4759497de95a3f001de3da8810ee30bcc932da2c`. This branch retains the existing PR40–44 commerce stack and excludes the older worktree's uncommitted ShopifyReview visual changes. No merge, production migration, storage configuration or deployment is included in this checkpoint.

## Buyer and user benefit

Unavailable alerts must not look subscribed, an error must not look successful, and example discovery screens must not imply genuine adoption or earned rewards. These corrections protect trust while the durable listing/cart/order journey is prepared for release. They do not implement community membership, rewards, alerts or Games expansion.

## Actual changes

- `src/modules/App.tsx`: opportunity alerts explain that no subscription was created; opportunities are explicitly examples rather than reviewed live offers. Game-launch notices no longer promise future delivery. Communities display example labels instead of fixed membership counts, and creation reports its unavailable state. Rewards show no earned balance or badges instead of the fixed 240-point balance and fabricated progress. Generic notices use a neutral information icon instead of a success check. Screenshot review caught narrow-screen notice clipping; messages now wrap inside the viewport with a fixed icon and bounded text. Badge examples say EXAMPLE GOAL rather than implying tracked progress.
- `src/modules/App.honesty.test.tsx`: four behavioral regressions verify truthful states, retained example/navigation content and no attempted writes for unsupported actions.
- `scripts/test-navigation-browser.mjs`: retains existing desktop/narrow checks and adds four rendered-page scenarios at each width, no-overflow checks and eight screenshot artifacts. Toast bounds and text overflow are checked at both widths. No test deadline, worker or assertion is weakened.

## Local verification at this checkpoint

- Actual baseline RED: all four new regressions failed before the source correction; retained in primary `work/release-a-20261106/honesty-red.json`.
- Focused combined UI/checkout/routes/Shopify review: 29 passed, zero failed.
- Full regression: 682 passed, zero failed. Earlier 659/678 and QA001 failures remain historical evidence; this pass does not diagnose their cause.
- TypeScript and Vite production build passed. The existing large Communications bundle warning remains.
- Dependency audit: zero vulnerabilities. Eight existing HTTP dependency-security assertions passed on pinned Node26.12.1/Vite8.3.5/Undici8.12.2 built-in and8.12.3 development dependency.
- Existing isolated HTTP order/cart/catalog/classification/publication scripts all passed with synthetic accounts and storage. No production records, provider credentials or payments were used.
- Local browser launch failed before assertions because the required Chromium executable is absent. Initial exact code fa203bfb CI42249706836/42249707258 subsequently passed682/57/build1693/audit0/security8, PostgreSQL18.6 commerce95/message84 and71 browser checks. Actual logs were read and the artifact checksum verified. Four inspected screenshots exposed the notice clipping and misleading example-badge status repaired in this follow-up. Those initial passes do not certify the follow-up source; its own focused/full/build/security/CI and screenshot evidence is required.
- Initial test cache/loopback permission errors, an automatic approval-review usage-limit rejection and restricted GitHub connection failure are retained. The later approved build/security/GitHub checks completed. These environment failures are distinct from application acceptance.

## Current release gates

1. Inspect exact candidate CI logs, PostgreSQL results and desktop/phone-width artifacts, then obtain independent source and release review for the complete PR40–44 stack plus this repair. At this local checkpoint, no submitted GitHub review exists on PR44.
2. Parent cart, classification and publication migrations remain UNAPPLIED. Apply only the reviewed compatible versions after explicit approval. Retain order-command/publication receipts and existing data through any rollback; this UI-only delta adds no schema change.
3. Private object storage is absent. The actual GR8NESS photo attempt returned503 `media_storage_unavailable`; no genuine tee listing or seller-to-buyer order is claimed. Reuse the existing private-media adapter only after approval of the bucket, limits, retention/deletion and supported server-only credential workflow. Do not expose secrets or create a public bucket.
4. Explicit authorization is still required for production migrations, merge and deployment. Development branch publication and draft review do not authorize those actions.
5. After an approved release/configuration, verify the actual seller's tee photo, five sizes, GH₵220 price, reload and a distinct buyer's discovery/cart/unpaid order/retry/cancellation/stock journey. Physical devices, low-data/reconnect and provider-backed storage remain separate acceptance gates.

Production remains PR39/main `56e0c2eb` at this checkpoint. Auth, Chale-private work, profile/privacy, owned calling and GPS drafts are not folded into this bounded repair. Request Market waits for a genuine seller-to-buyer journey. No EcoVibes listing, registration, verification or transaction fee is introduced; launch access remains GH₵0.

Primary receipts and subsequent exact candidate results: `work/release-a-20261106` in the main workspace. The authoritative readiness dashboard records later review, release and real-account evidence separately.
