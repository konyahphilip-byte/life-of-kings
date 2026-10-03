# EcoVibes / Africa OS target architecture

This document turns the attached Africa Digital Ecosystem brief into an incremental architecture for this repository. “Africa OS” means shared digital infrastructure for identity, commerce, services, creators, logistics, payments, location, AI and circular economy; it is not a device operating system.

For the as-is findings, see [the system audit](./ECOVIBES_SYSTEM_AUDIT.md). For layer-by-layer sequencing and standalone implementation prompts, see the [EcoVibes master build plan](./ecovibes-build-plan/README.md); its [identity and access chapter](./ecovibes-build-plan/00-core-and-user-management.md) expands the personal account, organization/Partner Hub and staff Admin Command Center. This architecture is the target; it does not claim that all listed domains are already implemented.

## Product and technical decisions

1. **Keep the modular monolith.** One EcoVibes API and PostgreSQL database are the right first production shape. Separate domain modules and ownership in code; split services only when scale or team ownership justifies it.
2. **EcoVibes ID is the platform identity.** Supabase Auth owns credentials when configured. EcoVibes owns one stable public ID (`@username`), profile, roles and permissions. Keep account linking explicit; never merge on matching email alone.
3. **The server owns business truth.** Prices, stock, order/job status, payments, rewards, verification, matching visibility and staff actions are validated and persisted by the API. A client redirect or optimistic UI is never payment confirmation.
4. **Ship one complete core loop at a time.** Make direct listings and CSV intake reliable, then one marketplace order lifecycle including test payment callback and staff refund review. Follow with the Quick&Handi job lifecycle and dispute path. Keep each usable before adding adjacent infrastructure.
5. **Treat external systems as adapters.** Shopify is the first real commerce connector, not the catalog model. CSV/manual listings remain first-class. Payments, maps, AI, media, messaging delivery and notifications use server-side interfaces with provider-specific implementations.
6. **Keep low-data behavior as a product requirement.** Text-first rendering, on-demand media, explicit playback, adaptive renditions, reduced motion and measurable bandwidth use apply to every domain.

## Target system map

```text
Web PWA / future mobile clients
   │  EcoVibes ID, versioned API, pagination, idempotency keys
   ▼
EcoVibes API (modular monolith)
   ├── Identity & access
   ├── Social, creators & communities
   ├── Marketplace & catalog connectors
   ├── Quick&Handi services & jobs
   ├── Orders, payments & settlement adapters
   ├── Opportunities, events & gaming
   ├── Personalization & recommendation engine
   ├── Notifications, messaging & trust/safety
   ├── Location & logistics adapters
   ├── Rewards ledger
   ├── AI search/assistant tools
   └── Waste-to-Money: collector app, recycler/facility portal, destination network & circular commerce
   │
   ├── PostgreSQL + versioned migrations
   ├── Object storage + media-processing queue + CDN
   ├── Shared rate-limit/session/queue infrastructure
   ├── Provider adapters: Paystack, Shopify, maps, LiveKit, AI, email/push
   └── Structured logs, audit trail, metrics, backups and reconciliation
```

## Application and module boundaries

Organize by business capability, not by UI widget. Each module should own validation, service logic, persistence queries, authorization rules, events and API routes. Modules can share stable contracts for identity, payments, files, search and notifications.

| Module | Owns | Shared contracts |
|---|---|---|
| Identity | Supabase Auth verification, EcoVibes IDs, profiles, roles, account linking, sessions, recovery and privacy choices. | `UserId`, `EcoVibesId`, role/permission checks, audit actor. |
| Catalog and marketplace | Manual products, CSV intake, connector sync, variants, stock, carts, order snapshots, fulfillment groups, cancellation and returns. | Catalog search, payment intent, seller identity, notification event. |
| Quick&Handi | Service categories, provider profiles, requests/jobs, offers, assignment, state transitions, messages, completion, reviews and disputes. | Identity, location policy, payment intent, notification, trust status. |
| Trust and support | Reports, verification evidence references, review decisions, dispute evidence, appeals and staff audit. | Staff permission, media access policy, domain events. |
| Social and creators | Posts, media references, Stories, Reels, follows, comments/reactions, creator storefronts and analytics aggregates. | Identity, content moderation, media, commerce links. |
| Opportunity and growth | Sourced jobs/grants/scholarships/competitions, eligibility, deadlines, saves and application links/status. | Search, identity, location/country, notifications. |
| Communities and events | Group membership, roles, community content/chat, event listings, attendance and moderation. | Identity, messaging, location, reporting, notifications. |
| Gaming | Game catalog, players, tournament registrations, score evidence, standings and achievements. | Identity, event lifecycle, rewards ledger (non-cash first). |
| Wallet and payments | Provider payment intents, signed callbacks, immutable provider events, refunds, reconciliation and payout references. | Integer minor-unit `Money`, idempotency, audit, order/job references. |
| Logistics and location | Consent, country/region/locality, delivery offers, assignment, tracking permissions, route references and proof of delivery. | Map/geocoding adapter, identity access checks, marketplace/job events. |
| AI assistant | Permissioned search tools, intent routing, opt-in personalization and provider-neutral generation. | Domain search APIs, consent policy, retention/redaction rules. No direct database superuser tool. |
| Personalization | A continuously adapting user interest profile and ranked recommendations across content, creators, communities, services, products, opportunities, events and games. | Explicit preferences, consented interaction signals, domain visibility, explanations and user controls. |
| Circular economy / Waste-to-Money | Materials, collector requests, verified facility directory and operator portal, plant/buyer destination network, evidence-backed weight/custody, recycling trades and repair/refurbish/resell flows. | EcoVibes ID, trust, location/map adapters, logistics, evidence/media, payments/rewards and audit events. |

## Identity, authentication and authorization

### Identity model

- A person has one internal immutable user key and one unique EcoVibes ID. The same user can hold customer, seller, service-provider, creator, business-member, gamer or other roles without creating extra accounts.
- Public profile data is separate from private account data, contact details, payout information, precise addresses and verification evidence.
- Roles describe a user's context; permissions protect actions and resources. Resource ownership and membership are checked on each server request.
- Organization/business accounts should be represented by organizations with explicit owner/admin/member relationships. Do not overload a personal username as a business security boundary.

### Authentication boundary

- Supabase Auth is the credential source when production is configured. The server verifies Supabase access tokens and maps them to an EcoVibes user.
- The current app issues its own HttpOnly session cookie after Supabase verification to preserve its CSRF-protected API contract. Keep this only as an intentional bridge: document the provider session lifetime, server-session lifetime, revocation behavior, account deletion behavior and sign-out-all-devices semantics. Revisit direct bearer-token API auth only as a deliberate contract migration.
- Legacy EcoVibes passwords exist for account migration. Link only from an authenticated legacy session; do not auto-link by email. Retire legacy password hashes after migration policy and recovery coverage are approved.
- Session tokens are opaque, randomly generated, stored as hashes, rotated after login/privilege changes and revocable. Staff sessions require MFA and short reauthentication for high-impact actions.

### Authorization policy

Use server-side policy helpers with explicit actor, action, resource and context, such as `can(user, 'fulfill', orderGroup)`. Check:

- ownership (seller owns product/order fulfillment group; customer owns job/order)
- membership (participants can read a private chat or community)
- role and verification level (provider-only action, staff review, regulated payout)
- status transition and time window (cancel only before fulfillment; complete/dispute only from valid states)
- data minimization (supplier receives only their assigned items and necessary contact/delivery data)

PostgreSQL Row Level Security remains enabled and direct browser table access stays denied for API-owned domains. The service API uses a restricted database role; any RLS bypass/administrative key remains server-only and requires a documented need.

## Data and migration rules

- Version PostgreSQL migrations in order; record applied versions in a schema migration table. Deployment should fail early if migrations are missing or out of order.
- Apply migrations in a reviewed deploy step, with a backup and rollback/forward-fix plan. Never silently mutate production schema during ordinary server startup.
- Make migrations the schema source of truth. Keep SQLite development schema in parity through generated/tested schema fixtures or a parity check; eliminate hand-maintained drift over time.
- Use UUID primary keys, foreign keys, unique constraints, indexes matched to query paths, and UTC timestamps.
- Store prices, fees, taxes, payouts and balances as integer minor units with ISO currency code and configured minor-unit precision. Snapshot item price, seller, fees and currency at order/booking time.
- Record important state changes as append-only domain events with actor, event ID, reason, request ID and timestamp. Enforce idempotency on retries and webhook deliveries.
- Keep PII, precise locations, verification evidence and payment-provider data under shorter, explicit retention and access policies than public catalog data.

### Core tables to stabilize first

The existing tables are a useful starting point. Normalize and extend them as needed:

| Capability | Core records |
|---|---|
| Identity | `users`, `profiles`, `auth_identities`, `roles`, `user_roles`, `organizations`, `organization_members`, `sessions`, `privacy_preferences`, `audit_logs` |
| Catalog and orders | `sellers`, `products`, `product_variants`, `inventory_locations`, `stock_movements`, `carts`, `orders`, `order_items`, `fulfillment_groups`, `order_events`, `reviews` |
| Money | `payment_intents`, `payments`, `provider_events`, `refunds`, `payouts`, `ledger_accounts`, `ledger_entries`, `reconciliation_runs` |
| Quick&Handi | `provider_profiles`, `service_categories`, `service_areas`, `service_requests`, `quotes`, `jobs`, `job_events`, `job_messages`, `job_reviews`, `disputes` |
| Trust and communication | `verification_cases`, `evidence_assets`, `reports`, `moderation_actions`, `appeals`, `conversations`, `memberships`, `messages`, `receipts`, `notifications`, `notification_attempts` |
| Growth, community and personalization | `opportunities`, `opportunity_sources`, `opportunity_saves`, `communities`, `community_members`, `events`, `event_attendees`, `creator_profiles`, `creator_products`, `recommendation_preferences`, `recommendation_settings`, `recommendation_signals` |
| Africa OS extensions | `countries`, `regions`, `localities`, `addresses`, `consents`, `delivery_jobs`, `tracking_events`, `materials`, `collection_requests`, `waste_batches`, `weighing_records`, `circular_listings`, `waste_facilities`, `facility_materials`, `facility_price_quotes`, `facility_capacity_snapshots`, `facility_events`, `waste_handoffs` |

Avoid building every table in one migration. Add entities only as the corresponding working user journey is implemented.

## Critical end-to-end journeys

### Marketplace order

```text
Seller signs in → direct listing or CSV import → review/publish
→ catalog search → buyer places order → API reserves stock and stores price snapshot
→ provider payment intent → signature-verified, deduplicated callback marks payment
→ seller fulfillment group(s) → shipment/tracking event → delivery confirmation
→ support/refund request → staff decision → provider refund callback/reconciliation
```

Required invariants: never oversell stock; retries do not create duplicate orders/payments; only signed callbacks establish captured/refunded state; canceled unpaid orders release stock exactly once; a refund cannot exceed captured amount; external-checkout referrals are not represented as EcoVibes-paid orders.

### Quick&Handi job

```text
Customer posts request → providers discover only area-safe task details
→ eligible provider offer(s) → customer selects one → details disclosed by policy
→ participants coordinate → provider marks en route/arrived/in progress
→ completion proof → customer confirms or opens dispute → staff resolution
→ review and provider performance update → regulated settlement if configured
```

Required invariants: valid actor and status transitions, one assigned provider unless explicitly multi-provider, immutable accepted quote snapshot, precise address revealed only to the selected provider when needed, no worker tracking outside an authorized active task, and a dispute freezes settlement until a recorded resolution.

## Payments, rewards and finance boundary

- Paystack and any later mobile-money/card provider are adapters behind a provider-neutral `PaymentProvider` interface.
- Payment state is derived from signed callbacks and provider verification calls, not a return URL. Persist callback event IDs before applying effects; make event processing idempotent and observable.
- Keep orders/payments/refunds distinct from the future wallet. A wallet requires an append-only double-entry ledger, provider reconciliation and an approved legal/compliance model; never derive a user balance from browser state or reward points.
- EcoPoints begin as non-transferable, non-cash recognition entries with unique issuance keys and abuse controls. Discounts/redemption require an explicit policy and ledger path.
- Staff refund approval creates a provider refund request; the refund becomes complete only after an authoritative provider event/status check and reconciliation.

## Store connector architecture

Treat the canonical EcoVibes catalog as independent of ingestion source. Define an adapter contract such as `authorize`, `listProducts(cursor)`, `getInventory`, `mapProduct`, `verifyWebhook`, `disconnect` and `health`.

- **Manual and CSV** stay available to sellers without a hosted store.
- **Shopify** remains the first OAuth-based connector and imports selected pages/products as paused drafts until seller review.
- Add WooCommerce and other store APIs only after merchant demand and app credentials/policies exist. Keep capabilities and sync status per connector.
- Website URL import is a seller-authorized assisted listing flow: capture source URL and seller attestation, extract only accessible product details, show provenance, require edit/review, and never blindly scrape or republish third-party images.
- Sync stock/price/media with webhook-plus-reconciliation patterns. Use idempotent external IDs, retry queues, backoff, disconnect cleanup and provider deletion/privacy webhooks where required.
- Aggregated/external checkout items must disclose source and checkout location and must not enter EcoVibes order/payment/fulfillment as if they were native inventory.

## Location, maps and logistics

Add a reusable location service only when users start real nearby flows:

- Request browser GPS only after an explicit user action, explain why, allow denial, and provide text locality fallback.
- Store country, region and locality separately from exact coordinates/address. Normalize geographic labels per country and support offline/manual address entry.
- Define provider interfaces for geocoding, search, maps and routing so coverage and pricing can change without rewriting domain code. Select the first provider using Ghana/Africa coverage, terms, offline behavior, attribution and cost.
- Use approximate distance for public search. Encrypt/restrict exact delivery/task addresses. Track a worker only during an authorized active job and only for relevant participants; expire precise pings quickly.
- Model delivery as a domain job with assignment, ETA, tracking events and proof-of-delivery, not as a text field on a product.

### Waste-to-Money: Recycling Plant Network & Collector Destination System

The Waste product is a separate EcoVibes vertical with its own collector, facility and material transaction journey. It reuses EcoVibes ID, trust, messaging, notifications, maps, logistics and payment adapters; it does not treat ordinary service listings or an unverified map pin as a recycling transaction.

#### Map layers and visibility

The collector map is a set of independently permissioned, filterable layers:

- Recycling plants, material buyers, processing facilities, repair/refurbishment centers and material drop-off hubs.
- Active collection jobs, cleanup missions and reported waste hotspots.

Only approved facilities can appear as verified plants or buyers. Facility operators control whether their public business location is exact or approximate. Collection jobs and cleanup missions expose an area-level location publicly; participant-only exact addresses and worker location follow the logistics consent policy. Hotspots are moderated, avoid reporter identity, and should not reveal a household or other sensitive exact location. Each layer needs its own visibility, expiry and report/removal policy; a map marker is not proof of current capacity or receiving status.

The map provider is an adapter. GPS is requested only after a user action, with locality/manual-search fallback. Navigation, distance and travel time are provider estimates, labeled as estimates with an update time. If mapping/routing is unavailable, show a text directory and locality, not invented directions.

#### Facility directory and business portal

A verified facility profile can publish:

- Business name, verification state, public location/navigation choice and service area.
- Accepted materials and conditions, minimum quantity, operating hours, current receiving status and capacity range.
- Price by material/unit/currency, quote basis, effective time, expiry and last update; preserve prior price versions for comparison and audit.
- Delivery requirements, processing time, payment methods, public contact/chat, and facility-specific collector requirements.

Facility staff maintain these fields in an organization-scoped portal. Separate public contact and operational data from private facility records. Role checks distinguish facility owner/manager/staff; staff verification is required before discovery as a verified destination. Require an update timestamp/expiry for price, capacity and receiving status; stale data must be visibly marked and excluded from “currently accepting” claims. Record who changed a price/status and when. Purchase requests and inquiries are explicit records with statuses, not implicit chats.

Suggested persistent domain records, introduced incrementally with migrations:

| Record | Purpose |
|---|---|
| `waste_facilities`, `facility_members`, `facility_verification_cases` | Organization-owned facility identity, authorized portal users and audited verification. |
| `facility_materials`, `facility_price_quotes`, `facility_capacity_snapshots`, `facility_hours`, `facility_requirements`, `facility_events` | Material compatibility, versioned commercial/operational facts and their audit history. |
| `waste_batches`, `waste_batch_materials`, `weighing_records`, `waste_handoffs`, `waste_events` | A collected batch, its material breakdown, evidence-backed weights, custody changes and append-only journey history. |
| `destination_recommendations`, `facility_purchase_requests` | Explainable candidate results and a user/operator-confirmed next action; recommendations remain snapshots, not reservations. |

Exact schemas should be added when the associated user journey ships; do not create a large empty schema in advance. Every record is scoped by owner/organization and is checked server-side. Price, currency, unit and quantity are captured in the transaction snapshot so later edits do not rewrite a completed trade.

#### Collector destination journey

```text
Collection request/job → pickup completed → material and estimated quantity recorded
→ collector reviews material identification → eligible destinations compared
→ collector chooses destination → facility confirms capacity/receiving slot
→ collector navigates/delivers → facility records received condition and measured weight
→ collector confirms or disputes the measurement → facility confirms the trade
→ payment provider confirms settlement → batch journey advances to verified outcome
```

Each state transition is a server-validated, append-only event with actor, timestamp, evidence reference and reason where needed. AI may suggest material labels from user-provided images/text, but the collector confirms them. Estimated weight/AI classification is never a verified scale reading. A receiving scan or geofence alone does not prove weight, purchase or payment. Facility and collector can dispute a measurement; dispute pauses settlement according to the configured transaction policy. Downstream processing/reuse/recycling events are shown only after the named actor records them with evidence. Do not imply a full journey to a manufacturer from a collector handoff alone.

For a weighed trade, show the quantity/unit, agreed unit price, deductions/fees, gross total and payment method before confirmation. Do not call a platform balance “money” or represent a payment as paid until the authorized payment provider confirms it. Avoid escrow, wallet custody or automatic payout claims until a licensed provider, jurisdictional terms and reconciliation flow support them.

#### Destination matching

Filter first for hard eligibility: material accepted and condition allowed, facility verified, receiving status current, quantity meets minimum, facility open or a bookable receiving slot exists, location/service area is available, and vehicle/handling constraints are compatible. Then rank eligible destinations by a versioned, explainable score using:

- Collector-authorized travel distance/time and estimated travel cost.
- Current quoted material price after unit/currency normalization, quote freshness and minimum quantity.
- Facility capacity/receiving confidence, operating hours, delivery requirements and service area.
- Historical on-time receiving and completed-trade reliability, with minimum sample size and abuse/fairness review.

Return a short reason for each result (for example, “accepts PET, above 50 kg minimum, 18 km away”), the relevant price unit/currency, freshness timestamp and estimate labels. Keep raw hard-eligibility rules separate from ranking so a high price cannot make an incompatible or closed plant appear suitable. Do not publish a destination as available where capacity/status is unknown or stale; offer contact/request-confirmation instead. The collector chooses the destination; recommendations never book, disclose exact addresses or initiate payment on their own.

#### Requested layer/profile contract

The public facility card supports name/verification, approximate or opted-in exact location, materials, current quote (where supplied), minimum quantity, hours, receiving state, accepted-condition notes, travel estimates and last price/status update. Contact/chat, navigation, detailed collector requirements and payment methods are revealed only at the appropriate public/participant scope. Never fabricate a plant, price, route, capacity, buyer or payment method to fill the map.

The requested eight layers are presented as map filters: plants; buyers; processing facilities; repair/refurbishment centers; drop-off hubs; active collection jobs; waste hotspots; cleanup missions. Layers can be hidden independently and should work in a low-data list mode with text labels and no auto-loaded tiles/media.

#### Delivery phases and current implementation boundary

1. **Current foundation:** Waste is a visible EcoVibes area. It reuses the authenticated job/offer workflow and trust verification for Waste service-provider onboarding. This is not yet a materials exchange or destination system.
2. **Verified directory:** Add facility organizations and roles, staff verification, material/price/status editor, reporting, and a text-first destination list. Seed only facilities with permission and verified source data.
3. **Map and matching:** Add map/geocoding/routing adapters and the eight opt-in layers; expose freshness, hard eligibility, user-authorized location and explainable comparisons. Build facility receiving/capacity confirmation before offering delivery as actionable.
4. **Verified handoff and settlement:** Add batches, weigh evidence, dispute transitions, transaction snapshots, payment-provider callbacks and reconciliation. Test refunds/cancellations and duplicate callbacks before enabling real settlement.
5. **Supply chain:** Add verified processing, repair/reuse, material buyer and manufacturer handoff events as each participant joins the network; preserve chain-of-custody evidence without claiming unobserved outcomes.

The current `WasteHub` has no facility/map API, facility business portal, plant records, live quotes, route estimates, weighing flow or Waste settlement. UI must label these capabilities as planned until implemented and connected to real, permissioned data.

## AI assistant boundary

Chale AI is a permissioned search and routing interface, not an authority over business data.

1. Parse the user's request and select a server-owned tool.
2. Tool queries enforce the same public/private visibility and user permission checks as ordinary routes.
3. Return source-linked records and a clear destination for the next action.
4. Require explicit confirmation for any create/update/message/purchase action; never let the model mark an order paid, alter a balance, approve a verification or resolve a dispute.
5. Minimize prompts, redact secrets/financial identifiers, disclose configured providers and define retention/consent before personalized data is used.
6. Add eval cases, tool authorization tests, rate limits and failure fallbacks before expanding beyond catalog and job search.

## Adaptive needs and recommendation engine

Personalization is a core EcoVibes capability, not a one-time onboarding setting. The platform should learn a user’s changing interests and needs from their choices and feedback, then improve what it surfaces across the ecosystem.

- Start with an explicit interest profile. The current version lets users choose interests on Home and learns from listing opens, saves, dismissals and provider-confirmed product purchases. As other domains gain server-backed records, add appropriate signals such as creator follows, searches, completed applications and community participation. Use short-lived, aggregate exposure signals only when they add clear value.
- Use a server-owned ranking service with understandable, versioned weights and recency decay. Rank eligible records by relevance, freshness, quality, location when the user chooses to share it, and diversity. Interaction signals tune the user’s profile over time; broader model updates use reviewed, privacy-protecting aggregates.
- Keep recommendation scope within each domain’s permissions and current user visibility. A model may rank records a user can already access; it must not infer permission, reveal private records or trigger purchases, messages, applications or other actions.
- Keep one opt-in topic profile per EcoVibes ID. Each supported feature can contribute limited topic/action/recency signals to that account's profile so learning in Create can improve discovery in Trade or Grow. Do not share identifiable user activity between accounts; only consider separately reviewed, aggregate trends when there is a clear product need and privacy threshold.
- Give each recommendation a concise reason, such as “because you follow Ghanaian fashion creators” or “matches your saved Accra design opportunities.” Let people correct interests, hide topics, pause personalization and reset their learned profile.
- Keep sensitive account, identity verification, precise location, wallet and private-message contents out of interest inference by default. Respect consent changes, retention limits, account export and deletion across raw signals and derived profiles.
- Measure useful outcomes and harms: relevant opens/saves/completions, repeated unwanted recommendations, exposure diversity, stale results and performance across countries and languages. Avoid optimizing for raw watch time or clicks alone.
- Chale AI may use the same permissioned interest profile to tailor discovery and clarify needs, while explaining when personalization influenced a result. The ranking service remains useful when an AI model is unavailable.

The current foundation combines declared interests with recent Marketplace and Quick&Handi opens, saves, dismissals and provider-confirmed product purchases, plus eligible Story/Reel interactions and creator follows. It uses the same account-scoped topic profile for public product/job ranking, creator discovery, Reels and Chale AI's permissioned catalog search. Signals store extracted topics and action weights, decay with age, expire after one year and stop collecting when personalization is paused. This adapts discovery without training a foundation model on private account data. Extend it to opportunities, events, games and communities only after those domains have server-backed records and safe signals.

## Experience and visual system

- Keep EcoVibes recognizable through its current African-inspired pattern language, warm natural palette, leaf/baobab/circular motifs and clean typography. Do not distort the original logo.
- Use depth and motion to explain a concept or state: an ecosystem network, map route, product view or AI presence. Avoid decorative glow cards and always-on ambient motion.
- Keep a static CSS/SVG alternative to every 3D scene; lazy-load WebGL, cap pixel ratio, pause when hidden, use low-power rendering, and respect reduced motion and Data Saver.
- Make navigation content-first and accessible on low-end Android: visible labels, semantic buttons/forms, keyboard use, clear focus, high contrast and no required animation.
- Move toward URL-addressable domain routes with code splitting, but preserve the current page flows during migration.
- Measure startup JS, requests, media bytes, interaction latency and low-bandwidth performance. Optimize media variants on the server rather than sending full-resolution uploads to every client.

## Data protection and operations

- Configure shared rate limits, request IDs, structured redacted logs, metrics, traces and alerts. Do not log access tokens, passwords, full private chat, precise coordinates or card/payment secrets.
- Use signed upload URLs or authenticated upload APIs, server-side MIME/content checks, file-size quotas, malware scanning and lifecycle cleanup.
- Send email, push and background media work through a queue/outbox so record changes and notification intent are transactionally linked.
- Back up PostgreSQL and object metadata, encrypt backups and perform restore drills. Add payment reconciliation and connector sync lag monitors.
- Apply MFA and least privilege to staff, seed the first admin using an audited one-time operational process, and record every review, refund and permission change.
- Define data retention, export/deletion, user consent, incident response, child safety, content moderation and country-specific terms before opening sensitive production capabilities.

## Incremental delivery plan

Each phase has entry and exit criteria; later domains should not block a usable earlier flow.

| Phase | Deliverable | Exit criteria |
|---|---|---|
| 0. Audit | This system map, security/performance findings and target design. | Existing flows identified and preservation boundaries recorded. |
| 1. Foundation | Supabase Auth primary configuration, EcoVibes ID, role/profile rules, staff bootstrap, migration/version gate, shared API/error contracts, design tokens and personalization consent/preferences. | New account, explicit legacy link, logout/recovery path, seller/provider role and staff authorization work consistently on PostgreSQL; users can inspect and control their interest profile. |
| 2. Catalog and order | Direct listings, CSV import, search, stock, order snapshots, seller fulfillment, cancellation and support surface. Start explainable catalog/opportunity recommendations using declared interests, follows, saves and dismissals. | Two accounts complete a full order path with no oversell or cross-seller data leakage; recommendations adapt to feedback and can be paused or reset. |
| 3. Payments | Provider adapter, sandbox checkout, verified/deduplicated callbacks, refunds and reconciliation. | Captured/refunded states come only from provider confirmation; replayed events are safe. |
| 4. Quick&Handi | Real provider profiles, offers, assignment, status timeline, chat, completion, reviews and disputes. | Customer and provider finish or dispute a job with actor checks and recoverable history. |
| 5. Location and logistics | Consent UX, text locality, map/geocoding adapter, nearby search and delivery events. | Permission denial works; precise data visibility is tested per job/order participant. |
| 6. Trust and communications | Secure evidence storage, staff review, generic messaging, notification outbox/delivery. | Reports and notifications are auditable; staff decisions and appeals have accountable paths. |
| 7. Creators and commerce | Creator profiles, storefronts, product tags, sales attribution and analytics. | Creator-to-product purchase attribution is server-backed and reproducible. |
| 8. Opportunities, communities, events, gaming | Sourced opportunity lifecycle, community membership/moderation, event attendance, verified game/tournament records; extend ranking across these domains with diversity, localization and quality monitoring. | Each feature has a real persistence and abuse policy before its preview is promoted as live; users understand and control cross-domain personalization. |
| 9. Circular economy | Waste provider onboarding and collection journey, followed by verified facility directory/portal, material-specific destination matching, evidence-backed handoff and B2B supply. | Approved real facilities publish fresh operational facts; collectors can complete and audit a compatible, received, weighed and settled material trade; stale data, disputes, consent denial and unavailable mapping have safe paths. |
| 10. Advanced AI and expansion | Permissioned tools, evaluation, voice/localization and country-specific config. | Tool permissions, retention, fallback and country/currency/provider policy are tested before launch. |

### Phase gate for every release

- Unit tests cover pure domain rules and money/state invariants.
- Integration tests cover auth/roles, API/database transitions, idempotent callbacks, ownership boundaries and failure recovery.
- UI checks cover loading, empty, error and permission-denied states, keyboard use, reduced motion and narrow screens.
- Provider sandbox tests are separated from local fixtures; no test mode result is presented as a real payment or payout.
- Migration is applied to a fresh database and an upgrade path; backup/restore and rollback plan are recorded for production.

## Immediate next sequence

1. Compare the actual hosted project schema to the checked-in migration set and add a migration/version gate before relying on PostgreSQL in production.
2. Make Supabase Auth configuration and the EcoVibes cookie-session bridge explicit in the environment/deployment guide; document migration-only legacy sign-in and the safe staff bootstrap.
3. Select one journey for production verification. Marketplace order + Paystack sandbox callback/refund review is the shortest current path because products, CSV and orders already exist; then exercise Quick&Handi customer/provider transitions and dispute handling.
4. Keep sample Communities, Gaming, Wallet, Creator analytics and Opportunities clearly marked. Waste currently has an authenticated collection-request/provider-review entry point; keep the planned facility map, prices, verified weights and payments clearly marked until their domain records, provider integrations and permissions exist.
