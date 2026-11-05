# ADR0002: Reuse existing orders through account cart commands

Status: proposed for review; locally implemented 5 November 2026, not deployed. Depends on draft PR40. No production migration or release approval is implied.

## Context

The main Bag held device preview products with no canonical server IDs. The existing account marketplace creates real unpaid orders, but a repeated legacy POST is not an idempotent command. A lost response can otherwise encourage another purchase and stock reservation.

## Decision

Keep the existing order, group, item, inventory, notice, event and audit records as the commercial source of truth. Extract their current transaction body into server/commerce/orders.mjs, shared by the legacy route and the new account cart. Add only commerce_carts, commerce_cart_items and commerce_order_commands for real saved cart state and immutable retry identity.

The authenticated actor and current app session are checked within the transaction. Absolute item quantities use optimistic cart revisions. Checkout binds a client UUID to owner, revision, reviewed total and an item-price fingerprint. Product locks recheck the fingerprint, including offsetting price changes. One command per cart revision prevents a fresh key buying the same version twice. Replay returns the original order without clearing later cart contents. No payment provider is invoked.

## Consequences

- No competing order/payment/identity system or speculative Request Market tables.
- Canonical unpaid orders and atomic stock/events/cart clearing can be tested independently of a payment provider.
- API-only runtime privileges and RLS still rely on server actor predicates; browser database access is denied.
- Existing legacy order callers do not gain new idempotency implicitly.
- Unknown client outcomes retain the exact in-memory command; reloading loses that in-memory retry, so saved orders and lastOrderId remain discoverable. A new cart revision requires fresh review.
- Price fingerprints cover item IDs, variants, quantities and prices; shipping, taxes and third-party charges remain outside this increment.
- Command retention/deletion and complete privacy/restore policy require platform review.

## Rollout and rollback

The generated additive migration remains unapplied. Require exact-source CI/PostgreSQL/browser evidence, independent review and explicit founder migration/merge/deploy approval. Missing marker or ECOVIBES_CART_DISABLED=true denies account cart actions. Disable first on rollback; retain carts, commands, orders and prior security barriers. Do not delete command history to make a retry possible. Physical buyer/seller and network acceptance remains distinct from CI fixtures.
