# API, domain events and Chale tools

This document separates existing contracts from proposed target contracts. The generated api-inventory.json is a source-locator index of route branches, not an OpenAPI specification or proof of endpoint acceptance. It includes dispatch/helper branches and must not be used to invent endpoints.

## Existing application boundary

Base/api/v1. The same Node handler owns authentication, origin/CSRF checks, bounded JSON, server request IDs and errors. Frontend code uses src/lib/api.ts plus feature-level fetch code; their owner/cancellation/error handling is not yet fully unified. New clients should reuse a scoped domain service, not import the database adapter or compute payment state.

| Existing interface | Authority/side effects | Known evidence/limit |
|---|---|---|
| GET/auth/me | Current app session and CSRF | Bounded hosted guest guard; real account isolation distinct |
| POST/auth/supabase/session | Verified provider proof → app session | Recovery/revocation draft24 unmerged |
| GET/POST/PUT/providers… | Own profile and current role-specific review | Existing domain module/tests |
| POST/marketplace/orders | Buyer from session; product/price/stock from database | This increment23 isolated HTTP checks; no idempotent lost-response retry |
| GET/marketplace/orders | Buyer or own seller groups only | Owner projection; local reload/isolation checked |
| POST/marketplace/orders/:id/cancel | Buyer + allowable unpaid state | Restore stock transaction; payment states remain separate |
| POST/marketplace/orders/:id/pay | Existing provider test path | Merchant/provider/real acceptance required; not activated here |
| POST/webhooks/paystack | Raw-body signature + canonical provider verification | Existing synthetic tests; not a new provider sandbox acceptance |
| POST/jobs; POST/jobs/:id/offers; POST/jobs/:id/offers/:offerId/select | Customer/provider/current verification and job ownership | Existing demand/offer/assignment primitives; not new Request Market |
| /connect/messages and receipt routes | Current accepted friend/revision/block/owner | Foreground polling; not background push/read proof |
| /notifications and summary | Own saved events | Generic receipts; no arbitrary sender can declare delivered |
| /ai/chat; /ai/work-status | Free budgets; private work bound to session | Broad quality/private two-account acceptance open |
| GET/discover/happening | Fixed public source queries, safe attributed envelope | No arbitrary user query forwarding |

### Normalized order input, implemented in this increment

POST/marketplace/orders retains items:[{productId,quantity,variantId?}]. One–30 submitted lines; each is an object; quantity is a positive safe integer. Absent/null/empty variant is the existing no-variant convention. Nonempty variant strings are trimmed and bounded. Product IDs are bounded nonempty strings. Duplicate same-product/same-variant lines combine safely; aggregate overflow rejects before any product write. Product groups are visited in deterministic string order for consistent lock acquisition.

No caller price,total,buyerId,platform fee or paid state is trusted. Existing product/variant/self-purchase/stock/currency rules and order visibility remain. Successful response returns the persisted order in unpaid state, not payment success. This is not request idempotency; repeated independent valid POSTs can still create independent orders.

Error contract: HTTP400 with existing structured error code/message/requestId for invalid input;401 unauthenticated;403 CSRF;404 unavailable product;409 stock/state conflict;500 actual server failure with redacted message. No product mutation/order/event/notice should survive a rolled-back transaction.

## Domain event contract

**Existing:** event() inserts domain_events and audit_logs; callers must place consequential state/event/notice writes within the same transaction. Event names are existing uppercase types such as ORDER_CREATED, ORDER_CANCELLED, JOB_POSTED, JOB_OFFERED, JOB_ASSIGNED. No durable outbox consumer/delivery registry or general correlation/schema-version field is implemented.

**Proposed v1 envelope, not emitted yet:**

```json
{
  "eventId": "immutable-generated-id",
  "type": "commerce.order.created",
  "schemaVersion": 1,
  "aggregate": {"type": "order", "id": "existing-order-id", "revision": 1},
  "actor": {"type": "user", "id": "server-authenticated-actor"},
  "occurredAt": "UTC-ISO-8601",
  "correlationId": "server-generated-request-or-workflow-id",
  "causationId": "optional-parent-event-id",
  "payload": {"orderId": "existing-order-id", "state": "pending", "paymentState": "unpaid"}
}
```

Only authorized minimum payload is allowed. Omit private messages, credentials, precise coordinates, contact information and raw provider payloads from broad event delivery. Consumers must check recipient/tenant entitlement at delivery time. Proposed event spelling does not replace existing stored event history.

For a first necessary async workflow, record its outbox row in the same domain transaction; a bounded dispatcher claims rows, uses stable event/delivery IDs, retries with backoff, deduplicates effects and records terminal failures. Consumers query authoritative aggregate state before consequential effects. External callbacks need signature verification, canonical checks and unique provider event references. A realtime notification is a hint to refetch; it is never settlement evidence. These are acceptance requirements, not a deployed bus.

## Chale tool boundary

Existing server/chale-ai.mjs exposes six named tool declarations:

| Tool | Current scope |
|---|---|
| search_ecovibes_catalog | Public active products/open jobs; no private account data |
| search_app_guide | Versioned feature/steps/availability evidence |
| get_my_context | Safe page/data mode/server sign-in/language/learning flags |
| diagnose_ecovibes_issue | Safe configuration/guide diagnosis; no automatic fix |
| draft_support_request | Local draft for review; does not submit |
| propose_improvement | Local idea/experiment draft; does not implement/publish |

Provider abstraction and quota/concurrency/timeout bounds already exist. Cloudflare grounded generation and tool-capable provider paths have different capabilities; do not claim a tool was executed just because its schema exists. The private work-status API/card is a separate authorized read; draft25 adds broader affirmative routing but is not merged. Display character settings never grant server access and never disable chat.

Future tools(search_products/search_services/find_verified_providers/create_request_draft/submit_request/retrieve_*_status/suggest_repair_options/find_material_buyers/calculate_supported_estimate/prepare_booking/retrieve_authorized_business_analytics) are **not implemented by this document**.

Each future tool needs:
- Strict bounded input/output schema and supported capability; unknown fields/tools fail closed.
- Actor from verified session; permissions and organization membership independently checked in the domain.
- Existing domain command/query interface, no arbitrary SQL or provider-secret access.
- Explicit information/recommendation/draft/approved/submitted/completed output state.
- User confirmation tied to exact draft revision/amount/recipient before a consequential write.
- Stable operation ID/idempotency, server correlation and redacted audit; honest unknown outcome.
- Evaluation cases for account switch, malicious selector, stale permission, malformed provider output, refusal, budget/timeout/outage and cancellation.
- No model-memory replacement for current facts; no private-conversation training.

## Integrated pilot contracts: design only

Request Market command flow:
reviewed draft → validate supported category/location/budget/timing → current eligible recipient matching → saved notification → own offer/revision → customer selection → existing job assignment or product-backed order command. Every command must accept an expected revision and a stable operation ID once write idempotency exists. Matching does not disclose exact private address/contact information.

Repair lifecycle references condition-report evidence and an existing service job. Resale/recycling handoffs prepare explicit drafts, never silently move money or assign providers. Industrial Exchange uses verified organization/membership and material-allowlist gates; quantities/units/condition/evidence are required, prices/certifications/impact are never inferred. Neither pilot introduces endpoints/tables in this increment.

## Fail-closed partner capability contract: proposed

Provider adapters must identify environment(test/live), action, country/corridor/currency/direction, authorization, expiry, source verification and kill switch. Missing or expired capability denies operation. Partner APIs require scoped authentication/revocation/idempotency and data minimization. Unsupported remittance/stored-value/payout functionality stays disabled. Launch EcoVibes platform fees are0; model advice cannot activate fees, provider capabilities or regulatory permissions.
