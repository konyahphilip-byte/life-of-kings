# Paystack test refund reconciliation

## Scope

Local API and staff review hardening. No migration, hosted deployment, real provider request or live payment activation was performed for this slice.

The first isolated HTTP regression reproduced the original defect: the newest pending order refund changed instead of the exact provider-confirmed refund. Earlier fixture setup mistakes and sandbox port failures were corrected before that reproduction; they were not passing application checks.

## Changes

- Refund callbacks trigger bounded authoritative reads of each stored canonical Paystack refund ID. The transaction reference/ID, amount, currency and test environment must agree before local payment state changes. Legacy processor references, duplicate IDs, multiple captured payments and inconsistent amounts require reconciliation.
- Partial refunds preserve the remaining captured amount. Customer requests after a partial refund use only the remaining order amount. Approval reserves amounts under the order lock, and refuses to exceed the captured payment.
- Lifecycle events no longer collide merely because they share a resource ID. Identical refund callbacks can trigger fresh reads; completed transitions and notifications remain idempotent. A repeated charge callback cannot reopen a refunded order.
- `needs-attention` stays pending. Provider-reported failures remain visible in the staff review queue. Staff can recheck existing provider records without submitting a new refund.
- Approval is audited before contacting the provider. Uncertain submissions retain their claim, preventing another approval from issuing a duplicate refund. Staff cannot review their own refunds.
- Signature validation accepts only correctly shaped hexadecimal signatures before comparing them. Provider calls have an eight-second timeout; refund checks read at most ten candidate refunds.

## Staff handling

**Requested:** review the reason and remaining amount; add a note and approve or reject once. All activity is explicitly test mode.

**Provider pending or reported failed:** use **Recheck with Paystack**. The server independently confirms the source; staff cannot mark settlement complete by hand. Rechecks require staff authorization, the existing production MFA gate and CSRF protection, and successful reads are audited.

**Awaiting reconciliation:** the provider write may have succeeded even though its response was lost. Inspect the payment and refund in the Paystack test dashboard. Do not reset the request to `requested`, resubmit, or guess a provider reference. An audited recovery process for attaching a verified missing canonical ID remains future work; this slice deliberately holds the request.

## Provider basis

Paystack distinguishes API refund IDs from processor references and exposes a fetch-refund endpoint. The integration now stores the API ID. See [Paystack Refund API](https://paystack.com/docs/api/refund/).

Refund notifications can have a null refund reference; pending, processing and needs-attention are distinct from processed. See [Paystack refund lifecycle](https://paystack.com/docs/payments/refunds/). Signed webhook deliveries may repeat, so the implementation uses state-aware reconciliation. See [Paystack webhooks](https://paystack.com/docs/payments/webhooks/).

## Verification and limits

The new `test:payments` harness starts the actual API with a fresh temporary SQLite database and synthetic accounts. Every external Paystack request is intercepted by a guarded test fixture. It never loads the application `.env`, connects to Supabase or uses real provider credentials. The child server and temporary data are removed on completion. October 10 results: 24 payment workflow checks, 44 provider/ownership/static-host checks, 15 mocked Chale checks, production build and syntax/diff checks passed. An initial full suite passed 139 tests. The later 140-test run had 138 passes and two App identity timeouts; those two plus five refund-card tests passed an unchanged 7/7 focused rerun. No timeouts were increased. On October 11 at approximately 18:40 UTC, the fresh combined run passed all 140 unit/component tests, the build, 24 payment checks, 44 provider/hosting checks and 15 Chale checks without changing timeouts. See `docs/CONTINUATION.md` for the full record.

These checks do not prove hosted PostgreSQL concurrency, Supabase authentication, production staff MFA, real Paystack callback delivery or real refund settlement. Reads still occur inside database transactions; a durable webhook inbox/outbox worker, autonomous reconciliation, multi-capture resolution and missing-ID recovery remain release work. Existing legacy refund rows are not rewritten automatically. The UI was checked with component tests, not a new authenticated browser session.

GitHub publication, Render configuration and hosted flow verification remain separate gates. No live-money or complete-security claim follows from this patch.


## Publication receipt

The implementation was committed locally on October 11 as `e739012`. The remote branch was rechecked at `e0b9f71f2f9a592430a2112d13455a920d5373da`. A normal Git push failed for missing terminal authentication, so this receipt does not represent a GitHub publication or deployment.
