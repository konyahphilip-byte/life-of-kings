# Project brief 09: Eco Market

## Overview

Eco Market is a discoverable catalog with two clear supply paths: (1) direct seller product listings, including CSV/manual entry for Ghanaian sellers without a store platform; (2) a separately labeled curated catalog with documented seller/source permission and fulfillment. Store connectors are additional seller tools, not the definition of the marketplace.

## What exists now

The API supports direct listings, CSV import, variants, stock-reserving orders and one Shopify OAuth/catalog-sync connector. Marketplace screens also include sample/preview content. A verified editorial/partner-curated program, broad connectors, authorized URL/AI import and live payment/refund reconciliation remain incomplete.

## Seller and buyer journeys

Direct: seller verifies account/business as appropriate → enters photos, title, description, price, variants, stock, delivery and location → reviews/publishes → edits stock with movement history. CSV: upload → preview/validate row errors → map fields → import drafts → seller confirms.

Curated: marketplace curator records supplier/right-to-list evidence, provenance, price/stock freshness, source badge and fulfillment path → staff review → item appears as curated/partner item → checkout clearly identifies seller of record and payment/return/support responsibility. Shopify/WooCommerce sync stays an opt-in connector and imported products are paused drafts until review.

Buyer: search/filter → inspect seller/source, total and shipping/return terms → select variant → server reserves stock and snapshots terms → EcoPay confirms provider payment → seller/fulfillment group ships → delivery confirmation or cancellation/refund.

## Rules

- Separate direct seller-owned inventory, authorized dropship/supplier-fulfilled products and external checkout/referral items.
- Every product has provenance, source/seller of record, current price/stock timestamp, image rights and a fulfillment owner.
- Never scrape and republish third-party listings/images without permission. URL imports are seller-authorized assistive drafts with attribution/review.
- No catalog item is purchasable if stock/price cannot be reliably checked; no external referral is shown as an EcoVibes-paid order.
- Purchase order snapshots survive later catalog edits; multi-seller order split is explicit to customer/support.

## Acceptance criteria

- A seller without Shopify can list directly and import CSV with per-row errors/draft preview.
- Two customers racing for last stock cannot both purchase it.
- Curated product shows seller/source/provenance, terms and fulfillment; staff can pause it on supplier/rights issue.
- External-checkout item opens its disclosed seller destination and is excluded from EcoPay paid-order statements.
- Cancellation/refund/stock restoration is idempotent and linked to verified provider state.

## Monetization

Transparent seller commission/subscription, curated supply margin only with contractual rights and shown prices, and disclosed delivery fees. Sponsored listings are clearly labeled and do not bypass moderation or safety.

## Build prompt

> Complete Eco Market in the existing EcoVibes repository. Inspect `MarketplaceHub.tsx`, product/order routes, stock migrations, CSV importer, Shopify adapter, trust/refund review and the system audit. Preserve the existing direct + CSV path. Define canonical product/source/fulfillment contracts so direct products, authorized curated products, connector imports and external checkout are distinct. Build listing → stock reservation → buyer order → fulfillment → cancel/refund as one testable sandbox journey; use server price/stock snapshots and signed EcoPay callbacks. Make rights/provenance and seller-of-record visible. Keep connector-imports paused until seller approval. Never add blanket scraping, fake products as available, wallet balance deductions or implicit cross-seller fulfillment. Update API/data docs and report which paths still require provider or supplier onboarding.
