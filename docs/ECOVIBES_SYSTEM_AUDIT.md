# EcoVibes system audit

**Audit date:** 2026-10-02
**Scope:** Current repository and the attached EcoVibes Africa Digital Ecosystem brief.
**Method:** Source, migrations, product docs and deployment configuration review, updated to include the Waste collection-request entry point and the target recycling-facility architecture. This is not a live provider verification.

## Executive summary

EcoVibes already has a substantial mobile-first React PWA, an API-backed local development mode, Supabase Auth integration, marketplace and Quick&Handi transaction foundations, a staff review surface, social Stories/Reels, and optional LiveKit calls/live rooms. Its best architectural choice is the modular-monolith direction: one EcoVibes ID and server-owned domain permissions, with provider boundaries for payments, media and AI.

The repository is **not yet a production-ready Africa-wide ecosystem**. A number of polished screens are previews backed by fixtures or browser storage, while server-backed records are local until a hosted deployment and migration are applied. Product claims and UI must keep this distinction explicit.

The highest-risk gap remains hosted deployment and data lifecycle. The API has a production schema-version gate, and deployment must apply the required migration before the service starts; the hosted database, deployed API, backups and restore have not been verified from this source review. Supabase Auth is the credential provider when configured, while the API issues a separate EcoVibes cookie session as its authorization bridge. That lifecycle and revocation behavior must be verified against the hosted project before production.

### Phase 1 initial change

The main shell, sidebar and profile now read the active EcoVibes ID from `/auth/me`; successful sign-in and sign-out refresh that identity across the app. The composer and profile copy identify posts as device-local, because the main feed posting path is not yet connected to the persisted social domain. Profile bio editing and follower counts remain unimplemented.

## Repository and runtime map

| Area | Current implementation | Assessment |
|---|---|---|
| Browser app | React 19, TypeScript, Vite; single app shell in `src/modules/App.tsx`, with feature modules under `src/modules/`. | Working structure; route state is mostly internal page selection rather than URL-addressable routing. |
| Visual system | CSS in `src/styles.css` plus feature styles; SVG African-inspired patterns and landscape artwork in `src/modules/africa-art.tsx`; React Three Fiber leaf hero in `src/modules/HomeDepth.tsx`. | Coherent low-data 2D foundation with a restrained 3D hero. The 3D ecosystem/map and full reusable brand system in the brief are not present. |
| API | Node HTTP API in `server/index.mjs`; domain routes share a process and service layer. `server/dev.mjs` starts API and Vite. | Useful modular-monolith foundation, but a large route module is carrying many domains and should be split behind stable interfaces as work expands. |
| Local persistence | SQLite database at `server/data/ecovibes.sqlite`; social media files under `server/data/social-media`. | Durable across local restarts on this machine only; not a hosted multi-user service. |
| Hosted database | PostgreSQL adapter activated by `DATABASE_URL`; SQL migrations in `supabase/migrations/`. Production refuses to start without `DATABASE_URL`. | PostgreSQL support is present. Migrations are not automatically applied or checked at startup; deployment must apply them separately and verify schema version. |
| PWA | `public/manifest.webmanifest`, `public/sw.js`; local profile/feed/cart/settings and drafts use `localStorage`. | App shell/offline shell exists. Authenticated records and queued writes are not an offline-sync system. |
| Deployment | `render.yaml`, `DEPLOYMENT.md`, `supabase/config.toml`, `.env.example`. | Deployment path is prepared, but provider account configuration, production secrets, migrations and hosted behavior require external setup and verification. |

## Feature map

Status labels distinguish a server-backed flow from a design preview. “Server-backed” below means the API has persistent business logic; it does not mean the feature has been verified against a deployed provider or hosted environment.

| Domain | Status observed in code | Reuse / remaining work |
|---|---|---|
| EcoVibes ID | Supabase email/password sign-up/sign-in UI is available when browser Supabase settings exist. The server verifies Supabase tokens, explicitly links/creates an EcoVibes profile, then issues an HttpOnly `ev_session` cookie and CSRF token. Legacy password IDs remain for migration; legacy registration is disabled when server Supabase Auth is configured. The main shell and profile display the active API identity. | Keep the explicit no-email-auto-merge link rule. Decide and document session expiry/revocation behavior and migration completion. Profile bio editing, synced activity and follower counts are not implemented. |
| Roles and profiles | Server roles include customer, seller and provider. Seller/provider profile records and role-protected API routes exist. `ECOVIBES_ADMIN_SUPABASE_USER_IDS` bootstraps admin access only for a linked, immutable Supabase Auth UUID and persists that role in `staff_access`. Waste provider applications reuse provider role/profile plus the existing verification queue. | No creator, business admin, courier, facility operator or community moderator domain roles are implemented. Waste applications do not yet create a distinct recycler/facility organization. Remove the bootstrap UUID from provider settings after confirming the initial admin role was persisted. Staff review routes otherwise depend on `staff_access`. |
| Marketplace catalog | Server supports direct listings, product edits, stock, integer GHS minor-unit prices, CSV import, product variants and fulfillment labels. The UI includes product-source badges and a connector directory. | Only the Shopify connector is a real OAuth/sync integration. Other connector cards are explanatory previews. Authorized URL import and AI-assisted import are not implemented as end-to-end flows. |
| Marketplace orders | API creates stock-reserving orders with item snapshots and seller fulfillment groups; seller confirm/ship and buyer delivery confirmation are represented. Eligible unpaid cancellation restores stock. | Provider callbacks are implemented in code, but checkout/webhook/refund behavior has not been live-verified. Supplier routing, courier integration, delivery proof, partial cancellation/refund policy and operational reconciliation remain future work. |
| Payments and wallet | Paystack test checkout initialization, signature-checked callback handling, webhook event deduplication, payment records, refund requests and staff approval path exist in the API. The wallet screen explicitly says it contains no real funds. | No wallet ledger, transfers, withdrawals, settlement service or live payments. Keep all regulated value movement with approved providers and add reconciliation before production. |
| Quick&Handi | Server supports custom jobs, provider offers, customer offer selection, participant messages, status transitions, notifications, event records and issue reports. The status model is `open → assigned → in_progress → awaiting_customer → completed`, with cancellation/dispute paths. | Listed-provider directory, service prices, ratings, job history and location are largely sample/local UI data. No GPS matching, verified service availability, rating persistence, provider dispatch, real-time tracking, escrow or dispute resolution workflow. |
| Trust and support | API stores verification requests and support reports. Backend workspace includes staff queues and server-side role-checked review actions for verification, reports and test refunds, with notes/audit rows. Production staff sessions require Supabase MFA assurance level 2. | Evidence is currently free-text, not a secure document workflow. Configure and verify staff MFA in the hosted Supabase project and define review staffing/response policy. Support notifications are in-app records only. |
| Social feed | Local feed posts, likes, saves, follows, bookmarks and drafts use browser storage or fixtures. Stories, following/discovery, media uploads and Reels have server routes and tables. | Feed posts/comments/reactions are not one integrated server-backed social domain. Upload limits and local/Supabase storage exist, but image variants, video transcodes, moderation queues, reporting/appeals and CDN delivery need work. |
| Messaging and calls | Quick&Handi job chat persists in the API. `Communications.tsx` integrates optional LiveKit calls and public live rooms; server issues scoped tokens when configured. | The general Messages inbox shown in the main shell is sample content; persistent generic DMs, delivery/read receipts and notification delivery are not established. Live rooms need configured provider credentials and operations. |
| Creator Hub | Users can post Reels and join calls/live rooms. | No creator role/profile, storefront, analytics, monetization ledger, subscriptions, affiliate tracking, tagged checkout or live-commerce order linkage. |
| Opportunities | Opportunity browsing/saves are present in the UI and browser storage; server search does not show a sourced opportunity domain. | Listings, sources, verification, applications and deadlines are not server-backed, so the new personalized ranker cannot yet match real opportunities. |
| Gaming | Gaming screen and sample challenge/game cards exist. | No playable game integrations, persistent game identity, tournament, leaderboard, anti-cheat or verified result ingestion. |
| Communities and events | Community cards and event-like navigation/discovery are preview content. | No persisted groups, membership, community roles/feed/chat/calendar/event booking or moderation domain. |
| AI | Chale AI uses a server API when configured and can search the server's active public products and open jobs; signed-in users' learned interests can affect listing ranking. Deterministic catalog search remains available as a fallback. | No autonomous actions, protected personal-data retrieval, opportunities/games/community search, business-agent tools or recommendation evaluation/monitoring pipeline. |
| Personalization | An API-backed shared topic profile can learn from declared interests, Marketplace/Quick&Handi opens, saves, dismissals and confirmed purchases, plus eligible Story/Reel views, likes and creator follows. The same user's profile can inform public catalog ranking, creator discovery, Reels and Chale AI catalog search. Users can pause collection, inspect topic summaries and reset learned signals; topics decay over time, while raw signal records are capped at 365 days. | The new Supabase migration must be applied before this is available in hosted Postgres. Recommendations do not combine separate people's identifiable activity. Opportunities, events, games and communities do not yet have persistent records/signals, so those pillars are not live recommendation sources. Add per-domain signals only after those services and their visibility rules exist. |
| Location and maps | Quick&Handi and listings use area/location text such as “Accra, Ghana”. The Waste area also uses text locality and the shared job workflow. | No reusable geolocation permission service, map provider interface, reverse geocoding, nearby search, route planning or consented worker tracking found. Recycling destination layers and facility discovery are specified in the [target architecture](./ECOVIBES_ARCHITECTURE.md#waste-to-money-recycling-plant-network--collector-destination-system), not implemented. |
| Recycling / circular economy | A Waste entry point now supports authenticated collection requests through the shared jobs API and provider onboarding through the existing trust-review queue. Offers remain locked until the Waste-service verification request is approved. | This is not yet a waste material exchange: there are no material/facility records, recycler portal, map layers, prices/capacity, verified weighing, custody trail, recycler settlement or e-waste repair/refurbish workflow. See the [Recycling Plant Network & Collector Destination System](./ECOVIBES_ARCHITECTURE.md#waste-to-money-recycling-plant-network--collector-destination-system) target design. |
| Low-data mode | Standard/Data Saver/Extreme Saver preferences, no autoplay-first video, app shell caching and local drafts are present. | Preference is mainly client-side; actual image rendition selection, bounded structured offline cache, queued safe writes, sync/conflict UX, usage accounting and saved-data measurements need implementation. |

## Data and service map

### Current persistent entities

SQLite initialization in `server/index.mjs` and the PostgreSQL schema migrations cover:

- `users`, `roles`, `sessions`, `supabase_identities`, `seller_profiles`, `provider_profiles`
- `products`, `orders`, `order_items`, `fulfillment_groups`, `payments`, `payment_webhook_events`, `refunds`, `store_connections`
- `jobs`, `job_offers`, `job_messages`
- `recommendation_preferences`, `recommendation_settings`, `recommendation_signals`, `recommendation_activity_signals`, `user_language_preferences`, `rate_limit_buckets`, `ecovibes_schema_version`
- `verification_requests`, `support_reports`, `staff_access`, `audit_logs`, `domain_events`, `notifications`
- `media_sessions`, `media_session_members`, `media_assets`, `people_presence`, `people_follows`, `stories`, `story_views`, `reels`, `reel_views`, `reel_likes`

There are no first-class persisted entities for creators, communities, opportunities, events, generic DMs, reviews, reward points, wallet balances, payouts, maps/places, logistics providers, recycling materials/facilities, waste batches or e-waste. Waste collection requests currently use the existing `jobs` and `job_offers` records; Waste-provider applications use `provider_profiles` and `verification_requests`.

### Database findings

- Domain money values are generally integer minor units with a currency field; current product/order flows default to GHS.
- Order stock mutation and cancellation paths use database transactions and lock order/product rows in PostgreSQL mode.
- SQL migrations cover PostgreSQL tables and enable RLS/revoke browser access for the API-owned commerce/trust tables. Social-media migration tables are also API-owned; review their browser grants whenever schema changes.
- Runtime SQLite schema is embedded in `server/index.mjs`, separate from versioned Postgres migrations. This creates schema drift risk unless migration changes are kept in sync and parity is checked.
- A migration bookkeeping table and startup schema-version gate are now in source. Eco Language preferences are stored per EcoVibes ID with direct browser access revoked. The currently deployed database has not been checked, and the service will refuse production startup until `20261002000000_eco_language_core` is applied.

## Security and privacy audit

### Strengths present

- Passwords are scrypt-hashed; random server session tokens are stored as hashes.
- Session cookie is HttpOnly and SameSite; production enables Secure. State-changing same-origin API requests use a CSRF token and origin allow-list checks.
- API validation, role checks, ownership checks, order stock checks, and staff-role checks are performed server side in the inspected routes.
- Paystack webhook signature is verified and provider event IDs are deduplicated in the database.
- Shopify OAuth state is one-use/hashed; store access tokens are encrypted before persistence. Provider keys are read from server environment variables.
- Supabase RLS is enabled and direct `anon`/`authenticated` table access is revoked for API-owned tables in the core migration.
- Eco Language has a shared Ghana-first/Africa language registry, an account-scoped preference API, guest-local fallback and per-language capability labels. Only English interface strings are active; translation, multilingual search, speech recognition/output and code-switch detection remain unavailable.
- UI disclosures label sample data, sandbox checkout and the wallet as non-real.

### Production risks and controls still needed

1. **Staff control plane:** staff APIs check role and session AAL2 in production; the UI supports TOTP enrollment/challenge. Bootstrap with the owner's linked Supabase Auth UUID through `ECOVIBES_ADMIN_SUPABASE_USER_IDS`, remove the setting after the `staff_access` row is created, and verify the deployed role-scoped queues. Both bootstrap grants and subsequent review actions are written to `audit_logs`.
2. **Session lifecycle:** Supabase Auth is the credential authority when configured, and recovery updates the Supabase credential. EcoVibes service sessions are separately revocable cookie sessions; test recovery, logout-all-devices, revocation and session rotation against the hosted project. Account export/deletion still needs a complete workflow.
3. **Rate limits:** fixed-window buckets are now stored atomically in the shared database, so multiple API instances use the same limits. Monitor denied requests and tune limits against production traffic.
4. **Migrations:** production startup checks the schema-version marker and refuses to run until the migration is applied. Take a verified backup before production migrations.
5. **Uploads:** validate actual file content, scan files, generate safe image/video renditions, enforce quotas and deliver through private/public policy-aware storage/CDN paths. Current dev mode can write media to local disk.
6. **HTTP policy:** API and Render static-site security/cache headers are configured in source. Verify the deployed response headers and check CSP reports/browser console against the live integrations.
7. **Financial operations:** test callbacks and staff approval code are not proof of provider-account configuration, refunds, ledger integrity or production readiness. Reconcile provider events and never use browser redirects as payment evidence.
8. **Privacy:** location, analytics, AI retention, age/safety, account export/deletion, regional data residency and incident-response policies are not fully represented in the code.
9. **Operations and observability:** local health checks exist, but hosted error monitoring/alerts, backup-plan confirmation, a restore drill, review-queue monitoring and payment reconciliation have not been configured or verified. Back up Supabase Storage objects separately from database records.

## UI, accessibility and performance

- The visual direction is more distinctive than a generic marketplace: restrained earth tones, African pattern artwork, CSS depth, and a lazy-loaded React Three Fiber hero. CSS static art is available as a 3D fallback, and the hero checks reduced-motion and visibility before rendering.
- The app is mobile-first and has a PWA shell. It uses inline icons and CSS/SVG artwork in core screens to reduce initial media costs.
- `@react-three/fiber` and `@react-three/drei` are already dependencies; 3D is currently limited to the Home hero rather than interactive commerce, maps or logistics.
- The shell is concentrated in a large `App.tsx`; multiple domain screens are rendered through a page-state switch. This is workable now but will make URL/deep-link state, navigation permissions and code-splitting harder as domains multiply.
- Accessibility/performance checks have not been executed for this audit. Maintain keyboard interaction, semantic forms, reduced-motion support, text-first saver modes and real low-end Android testing as acceptance requirements.

## Build, configuration and deployment

- `npm run dev` starts API and Vite; `npm run build` runs TypeScript project builds and Vite production bundling; `npm test` runs Vitest.
- The declared engine is Node `>=22.13.0`, while README says Node 20 or newer. Documentation should match the actual engine requirement.
- `.env.example` is the configuration contract. Production requires `DATABASE_URL`; Supabase Auth, Paystack, Shopify, media storage, LiveKit and AI are optional provider configurations.
- `render.yaml` and `DEPLOYMENT.md` describe deployment, but this audit did not confirm provider dashboards, live secrets, hosted migration state, deployment URL, Paystack webhook reachability or Shopify app registration.
- Tests exist for local storage, Quick&Handi domain state and assistant behavior. They were not run as part of this read-only audit.

## Reuse, refactor, replace and build

### Reuse

- Existing EcoVibes ID linking rules, server authorization, CSRF/session protections and role separation.
- Stock-aware order flow, immutable purchase item names/prices, seller fulfillment groups, cancellation and test payment callback foundation.
- Quick&Handi offers, actor-checked state transitions, job messages, notifications and domain event records.
- Shopify connector as the first real connector; keep CSV/direct intake available.
- Chale AI's public catalog search boundary; LiveKit adapter; low-data PWA shell; CSS/SVG brand artwork and reduced-motion 3D hero.

### Refactor

- Split the large API route file into domain routers/services without changing route contracts first.
- Make Postgres migrations the schema source of truth; derive or verify SQLite dev schema against them.
- Move app navigation to route-addressable feature boundaries when deep links and protected pages are implemented.
- Consolidate duplicated API request/session handling and model loading/error/empty states consistently.
- Separate sample fixtures from real data visually and structurally; finish profile editing and distinguish local drafts/activity from server-shared content.

### Replace only when evidence supports it

- Do not replace React/Vite, Node, PostgreSQL or the current modular-monolith shape merely to chase a new framework.
- Keep current map/provider-agnostic plan; select a paid map SDK only after real location requirements and regional coverage are confirmed.
- Replace localStorage persistence for user-owned server records with API-backed records; retain local storage for low-risk preferences/drafts.

### Build next

- One fully observable real transaction journey including its cancellation/refund or job dispute path.
- Hosted migration application and verification of the API's required schema marker.
- Account export/deletion workflow and user-facing privacy/support contacts.
- Persisted opportunity and creator records, then communities/events and business profiles.
- Consent-first location abstraction and provider adapter before map UI or live tracking.
- Shared low-data media pipeline, notification outbox/delivery, and API-backed feed state.
- Separate recycling/circular-commerce domain only after core order/job trust flows are dependable.

## Phase-zero exit decision

The project can move into stabilization without a rebuild. The work should be incremental and keep the current UI and local preview functioning. Before any hosted transactional launch, apply and verify PostgreSQL migrations, configure Supabase Auth and provider secrets in their dashboards, grant staff access safely, test payment callbacks in sandbox, and exercise cancellation/refund/dispute recovery paths against the real deployment.
