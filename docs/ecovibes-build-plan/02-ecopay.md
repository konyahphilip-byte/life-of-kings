# Project brief 02: EcoPay

## Overview

EcoPay is the payment orchestration and transaction-history layer for supported EcoVibes purchases and bookings. “Wallet” may show provider-backed transaction records and, only after the relevant regulated model exists, a legally supported stored-value balance. It must not imply custody or cash value without that support.

## What exists now

The API contains Paystack test checkout, signed callback handling, event deduplication, refund request/staff approval paths and Shopify/market order records. Hosted callbacks/refunds are not verified; test mode is not real money; there is no usable stored-value ledger, transfer or withdrawal product.

## User flows

Buyer/customer selects an order or booking → server snapshots amount/currency/fees → EcoPay chooses a provider/method supported for the account’s country → user completes provider checkout → signed webhook/provider verification confirms success → domain transaction advances → transaction receipt and notifications appear. Cancellation/refund follows the domain policy, staff decision when required, provider refund request, verified callback/reconciliation, then final receipt.

## Scope

**Must:** Paystack Ghana test integration hardening; provider-neutral interface; idempotent payment intents/events; signed callback validation; amount/currency/reference checks; duplicate/reordered callback safety; server-only keys; refund requests; reconciliation view; accessible transaction history; clear pending/failed states.

**Later:** additional African mobile-money/card providers chosen per country, provider-backed payouts, merchant settlements and a double-entry ledger after legal/operational review.

**Out of scope:** calling test funds real money, a browser-calculated balance, unlicensed escrow, peer-to-peer transfers, anonymous cash-out, uncapped credit, or storing mobile-money PIN/card details.

## Data/security

Provider-neutral `payment_intents`, `provider_events`, `payments`, `refunds`, `payout_references`, `ledger_accounts`/`ledger_entries` only where warranted, and reconciliation runs. Use integer minor units, ISO currency, immutable amount snapshots, request idempotency, secret redaction and staff MFA. Refund completion requires provider confirmation, not an admin button alone. Only disclose order/booking fields needed by the provider.

## Acceptance criteria

- Correct signed event moves a matching payment once; invalid signature, wrong amount/currency/reference and duplicate events cannot mark it paid.
- Failed, canceled, pending, refunded and delayed callbacks render distinct states and are recoverable.
- Staff can inspect discrepancies and record a refund decision, but cannot mark provider settlement as complete manually.
- Test and live credentials are server-side settings, and UI states label environment accurately.
- A buyer and seller/customer/provider can complete a sandbox transaction with auditable receipt and reconciliation result.

## Build prompt

> Implement EcoPay using the current repository and provider adapters; first inspect `server/index.mjs`, payment migrations, `DEPLOYMENT.md`, Marketplace/Quick&Handi flows and this master plan. Keep Paystack test mode explicit. Harden signed webhook verification, callback idempotency, amount/currency/reference checks, cancellation/refund and reconciliation. Use secrets only in provider/hosting dashboards and `.env.example` placeholders without real values. Do not implement stored value or withdrawals until a compliant provider/ledger model is approved. Do not change an order to paid on a redirect. Add the smallest complete sandbox checkout-to-confirmation-to-staff-refund slice, preserve current CSV/manual marketplace and unrelated changes, and state which provider setup and live-account approval remain external.

## Monetization

Disclose provider processing fees and any EcoVibes fee before confirmation. Monetization must be reconciled per transaction and country; do not use hidden spread or reward points as money.
