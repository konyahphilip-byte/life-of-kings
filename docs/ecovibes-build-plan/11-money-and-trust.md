# Project brief 11: Money & Trust

## Purpose and boundaries

An independent EcoVibes pillar for personal financial activity, source-based evidence and, later, explicitly authorized partner services. Reuse Eco ID, EcoPay, existing transactions, support and Chale. A completed job is work history, not income. A recorded payment is not proof of seller settlement. EcoVibes must not imply custody, lending authority or an approved remittance relationship.

Source: the user's October 9 Money & Trust + Chale directive. See [the evidence inventory](../MONEY_TRUST_AUDIT.md) and [continuation state](../CONTINUATION.md). These documents distinguish implemented features from the larger requested roadmap.

## Implemented first slice

- Separate lazy-loaded `Money & Trust` page, sidebar and home Earn entry; `/#money-trust` supports a direct initial visit.
- Personal `GET /api/v1/money/overview`, derived from existing purchases, payments, refunds and completed jobs. No new migration or independent ledger.
- Active session required. Supplied account/organization selectors are rejected. All queries use the authenticated account; staff has no cross-account override. Reads are rate-limited and minimally audited.
- Overview, Activity and a Trust Passport **evidence preview**. No certified passport, credit score, shareable statement or external report.
- Exact integer arithmetic, separate totals per currency, refund consistency checks, duplicate and unsafe-number exclusion. Latest 100 attempts only; this is not a complete statement or available balance.
- Account changes clear private UI data and cancel old requests. Guests see a sign-in prompt. Explicit error, retry, empty, loading and reconciliation states.
- Chale may explain app usage through the existing guide. This slice does not send private financial records to models or partners.

All transaction records in this release are test-mode records. No transfers, withdrawals, remittances or live payment controls are enabled.

## Next build phases and gates

1. **Payment truth:** exact refund identifiers, event idempotency, amount/currency/reference checks, delayed/duplicate/reversed events and reconciliation. Prove source integrity before issuing financial evidence.
2. **Evidence:** immutable report snapshots, source and environment, version/expiry, corrections and dispute history. Distinguish recorded, provider-confirmed and reconciled evidence.
3. **Organization scope:** memberships, granular permissions and explicit cross-tenant denial tests before financial teams or business reporting.
4. **Consent and partner gateway:** verified partner registry; purpose, recipient, fields, expiry, retention and revocation; disclosure audit. A partner account alone grants no private data access.
5. **Remittance sandbox:** provider interface, supported country/corridor registry, quote expiry, fees and transfer state machine. Synthetic quotes must be visibly simulated and unable to trigger live transactions.
6. **Chale financial assistance:** model-provider abstraction plus narrow authorized tools. Deterministic calculations stay outside the model. No autonomous payments, underwriting or grant decisions.
7. **Controlled release:** the requested draft policy package, qualified legal/compliance review, contracts, merchant setup, hosted security and transaction checks, backup restore, monitoring and explicit activation approval.

## UI and low-data requirements

Keep the independent pillar visible without removing Wallet, Marketplace, Quick&Handi or Waste. Show provenance and limitations near the relevant records. Use text-first pages and optional decorative depth, reduced motion, readable phone layouts, keyboard navigation and loading/retry states. Do not add fake balances, FX rates, institutional logos or eligibility claims to fill empty states.

## Verification

Check anonymous, suspended and unrelated-account access; staff must see only their own personal view. Cover stale account responses, exact arithmetic beyond JavaScript's safe-number range, malformed records, inconsistent refunds, duplicate captures, multiple currency scales and the bounded history window. Verify desktop/phone presentation and existing provider/Chale flows. Local SQLite and mocked-model checks do not prove hosted PostgreSQL, Supabase Auth or provider behavior.

## Build prompt

> Continue Money & Trust in this existing repository. Read the source audit, this chapter, EcoPay and the continuation log; inspect active workers first. Preserve unrelated edits and existing product layers. Complete one dependency in the listed order, with server-enforced ownership, source provenance, purpose-limited data and denial tests. Keep real payment credentials in provider settings. Do not activate real transfers, certify income or disclose data to partners/AI without the corresponding verified service and authorization. Record exactly what was implemented and tested, with remaining hosted, legal and provider blockers.
