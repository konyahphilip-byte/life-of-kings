# EcoVibes architecture notes

## Current state

The workspace contains a React + TypeScript PWA and a local Node API backed by SQLite. The local API implements EcoVibes ID sessions and roles, direct listings and CSV import, stock-aware marketplace orders and seller fulfillment, Quick&Handi custom jobs and messages, notifications, verification requests, support reports, and authenticated catalog search. It is a development foundation; the production shape below remains the target for a hosted service.

## Proposed production shape

Begin with a modular monolith and PostgreSQL. Keep server routes thin and call domain services. Use provider interfaces for media, payments, email, push and AI. Use an object store and CDN for media, a job queue for media processing and notifications, and a search service interface that can begin with PostgreSQL full text search. Extract services only when ownership, load or release needs justify it.

```text
PWA / future native clients
          │ versioned API, secure sessions
          ▼
Modular API: Auth · Users · Social · Creators · Gaming · Marketplace
              Payments · Opportunities · Rewards · Messaging · Admin
          │
          ├── PostgreSQL (normalized records, migrations, constraints)
          ├── Job queue (media, notifications, reconciliation)
          ├── Object storage → media processing → CDN
          ├── Provider adapters (payment, email, push, AI)
          └── Search / analytics interfaces
```

## Domain boundaries

- **Auth and users:** credentials, sessions, profiles, role assignments, privacy settings and audit history. A person can hold multiple roles.
- **Social and creators:** posts, media references, comments, reactions, follows, creator profile and aggregate analytics.
- **Gaming:** game catalog, player identities, matches, scores, leaderboards, tournaments and achievements. External game data must be verified by an adapter.
- **Marketplace:** sellers, products, carts, orders, order items, fulfillment events and reviews. Seller is the party fulfilling the order.
- **Payments:** provider-neutral intents and transactions, integer minor amount, currency, provider reference, idempotency key, state and append-only audit events. Do not count a client redirect as payment confirmation.
- **Opportunities:** listings and user saves, with deadline and source metadata.
- **Rewards:** append-only points ledger, unique issuance key, reason and actor. Do not make points redeemable in the initial release.
- **Messaging and notifications:** conversations, membership, messages, delivery/read markers, preferences and notification attempts.
- **Trust and safety:** reports, configurable categories, moderation decisions, appeals and audit log. Moderator permissions are separate from admin.
- **AI and recommendations:** provider/service interfaces and logged request metadata with privacy controls. Initial recommendation logic should be deterministic and described accurately.

## Relational schema outline

A server migration should normalize at least the following tables. Use UUID/ULID primary keys, UTC timestamps, foreign keys, indexes for feed/order/search access paths, and uniqueness constraints for relationships and idempotency.

| Domain | Tables and key constraints |
|---|---|
| Identity | `users` (unique normalized email/phone), `profiles` (unique username), `roles`, `user_roles` (unique user/role), `sessions` (hashed session token, expiry, device metadata), `audit_logs` |
| Social | `posts`, `media`, `comments`, `reactions` (unique user/post/type), `follows` (unique follower/followed; no self-follow), `creators`, `creator_analytics` (period and creator unique) |
| Gaming | `games`, `players` (unique game/user), `matches`, `scores`, `tournaments`, `tournament_entries`, `achievements`, `player_achievements` (unique player/achievement) |
| Commerce | `sellers`, `categories`, `products`, `carts`, `cart_items` (unique cart/product), `orders`, `order_items`, `order_events`, `reviews`, `wishlists` |
| Money | `currencies` (ISO code unique, minor unit digits), `exchange_rates`, `payments`, `transactions` (unique internal ID and provider/reference), `transaction_events` (append only, unique provider event id), `reconciliation_runs` |
| Community | `opportunities`, `saved_opportunities` (unique user/opportunity), `reward_accounts`, `reward_ledger` (unique issuance key), `conversations`, `conversation_members`, `messages`, `message_receipts`, `notifications`, `notification_preferences` |
| Safety | `reports`, `moderation_actions`, `blocked_users`, `analytics_events` (retention and consent policy required) |

Order, payment and moderation state transitions must be validated in domain services and recorded as append-only events. Monetary totals must be reproducible from order item snapshots and fees at purchase time. Add currency, country, language and region as data, not branching product code.

## API outline

Use `/api/v1/` boundaries and structured errors. Suggested routes: `/auth`, `/users`, `/profiles`, `/feed`, `/posts`, `/creators`, `/games`, `/tournaments`, `/marketplace`, `/products`, `/orders`, `/payments`, `/remittance`, `/opportunities`, `/rewards`, `/messages`, `/notifications`, `/search`, `/ai`, `/admin`, `/reports`.

All endpoints require schema validation, pagination limits, request IDs, authorization checks and rate limits. Use an idempotency key for writes that may be retried. Never put provider secrets in client code. Payment webhook handlers must verify provider signatures and deduplicate event IDs.

## Low-data and offline plan

1. Keep the route shell small and split heavy modules at route boundaries.
2. Make text and navigation immediately usable; load feed pages incrementally.
3. Request thumbnail renditions appropriate for device width and selected saver mode. Never autoplay video; require an explicit user action.
4. Store non-sensitive visited records and drafts in IndexedDB with a schema version and expiry policy. Queue safe social writes with client-generated idempotency IDs; never queue money movement for blind replay.
5. On reconnection, sync with conflict handling and visible per-item status. Do not claim a write succeeded until the server acknowledges it.
6. Keep PWA cache versioned, same-origin, bounded, and purgeable. Never cache authenticated financial responses in a shared cache.

## Security and operations

Use Argon2id or scrypt password hashes; random opaque sessions stored hashed server-side; secure HttpOnly SameSite cookies; CSRF tokens on state-changing requests; short login and OTP rate limits; account lockout with recovery protections; strict upload MIME/size validation and malware scanning pipeline. Use CSP, HSTS, frame and MIME headers. Redact secrets and personal content from structured logs. Add request IDs, error tracking, queue lag, database health and payment reconciliation metrics.

Admin access requires server-side role checks and MFA. Every high-impact action needs actor, target, reason and timestamp in an append-only audit log. Payment handling and any future stored value/remittance require licensed providers, legal review, regional compliance and reconciliation procedures before launch.

## Rollout sequence

1. **Foundation:** server API, PostgreSQL migrations, secure auth/session flow, profiles/roles, PWA shell and admin access policy.
2. **Social and discovery:** feed, posts, reactions, comments, follows, search, notification preferences and reporting.
3. **Creators and gaming:** creator profiles/analytics; game catalog and verified score ingestion.
4. **Marketplace:** sellers and product management, carts and seller-fulfilled orders with immutable price snapshots.
5. **Money:** sandbox provider in non-production, transaction ledger and reconciliation; connect live providers only after provider and compliance approval.
6. **Opportunities and rewards:** sourced listings, saves, abuse-resistant non-cash ledger.
7. **AI:** swappable provider adapters after privacy, retention and moderation policies.
8. **Optimization:** real-device low-bandwidth checks, offline sync, accessibility, observability and load testing.

## Marketplace commerce engine

Treat EcoVibes as the canonical catalog and order orchestrator, with three controlled product intake paths:

1. **Direct listing:** seller-managed title, media references, description, category, variants, GHS price/cost, stock, supplier, shipping, location and product type. This covers sellers who sell through Instagram, WhatsApp or a physical shop.
2. **Connected store:** connectors implement a shared `CommerceConnector` contract for OAuth/approved credentials, catalog pull, selected/all import, field mapping, stock/price updates, webhook ingestion and (only where permitted) order export. Shopify, WooCommerce, BigCommerce, Wix, Adobe Commerce, Squarespace, Ecwid, Salesforce Commerce Cloud, Etsy, Amazon SP-API, eBay Sell APIs, TikTok Shop, Square, Lightspeed and CSV are candidates, not claims of working integrations. Each connector needs a provider capability matrix and region/API terms review.
3. **Authorized URL import:** seller confirms the right to use product text/images, then receives a reviewable draft. Production extraction must use seller-authorized APIs or permitted source methods, validate URL/redirect destinations, reject private-network targets, enforce egress/time/size limits, preserve attribution/source URL, and require the seller to edit and approve before publication. Never perform blind arbitrary-site scraping.

Normalize imported/direct products into the same `products` catalog with `source_type`, `source_id`, `external_product_id`, `source_url`, `sync_cursor`, `last_synced_at`, selected field ownership, currency/price snapshots and publication state. Preserve external IDs and record import/sync operations idempotently. Make price and inventory field ownership explicit (EcoVibes, store connector or supplier); show conflicts before overwriting. Use webhooks where available, bounded polling where necessary, retries with backoff, dead-letter handling and a reconciliation job. Encrypt connector credentials server-side and request least-privilege scopes. Never expose access tokens to the PWA.

A product's `fulfillment_type` is independent of its input `source_type`: `own_inventory`, `supplier_fulfilled`, `dropship` or `external_checkout`. Model supplier profiles, supplier products, wholesale price, stock signal, fulfillment locations, shipping regions, processing times, returns, verification and API/order capabilities. Seller markup is computed from a supplier cost, with gross margin shown before fees, shipping, tax and refunds. Supplier badges reflect server-verified status, not seller-entered claims.

For a mixed cart, create one customer-facing `orders` record and immutable `order_items`, then split into seller/supplier `fulfillment_groups` with independent addresses only when needed, status, shipment and payment allocation. Route the minimum required item, quantity, delivery area, recipient and contact data to each fulfiller; do not send unrelated cart contents or full customer account profiles. Persist routing, supplier acceptance, tracking, cancellation, refund and shipment events with actor/provider event IDs and idempotency keys. External checkout items are referral links and must not enter EcoVibes payment capture or imply EcoVibes fulfillment.

The local API supports direct listings, CSV imports, stock reservation, seller-specific fulfillment groups, tracking codes, cancellation with stock restoration, and order issue/refund request records. CSV is the only import path beyond direct entry. There is no stock sync, external OAuth, supplier routing, tracking provider, captured payment, provider refund, or AI extraction. Refund requests require a captured payment state, which cannot be created until a payment provider callback is integrated. Connector candidates below are planning only.

Official API starting points for a future capability review: [Shopify APIs](https://shopify.dev/docs/api), [WooCommerce APIs](https://developer.woocommerce.com/docs/apis/), [BigCommerce Admin APIs](https://docs.bigcommerce.com/developer/api-reference/rest/admin/overview), [Wix APIs](https://dev.wix.com/docs/api-reference), [Square APIs](https://developer.squareup.com/reference/square). Review marketplace platform access, supported seller regions, permissions and policies separately before committing to Amazon, eBay, Etsy, TikTok Shop, Adobe Commerce or other connectors.

## Live audio and video

Calls and public live rooms use LiveKit through the existing EcoVibes session API. Set `LIVEKIT_URL` (LiveKit server URL, commonly `wss://…`), `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` in the API environment. The server translates the URL for LiveKit's HTTPS management API and returns its WebSocket form to browsers. Credentials stay server side.

Authenticated routes:

- `GET /api/v1/media/status` reports provider configuration without revealing credentials.
- `GET /api/v1/media/sessions` lists active public live rooms and rooms where the signed-in user is host or invitee.
- `POST /api/v1/media/sessions` creates a private voice/video call or public live room; pass `{ "mode": "voice|video|live", "title": "…", "invitees": ["eco_id"] }`.
- `POST /api/v1/media/sessions/:id/join` issues a one-hour room-scoped LiveKit token after membership checks. Public live viewers receive subscribe-only media permissions.
- `POST /api/v1/media/sessions/:id/end` lets the host close a room.
- `POST /api/v1/media/sessions/:id/ingress` returns RTMP ingest details for a live host. Treat the stream key as a secret.
- `POST /api/v1/media/webhook` accepts signed LiveKit room-finished events and synchronizes ended room state.

Room metadata and membership are stored in `media_sessions` and `media_session_members`, in the existing SQLite database or the Postgres migration. The LiveKit provider carries audio/video; EcoVibes remains the authority for user identity, invitations, room permissions, notifications and audit events. Configure LiveKit webhook delivery to this endpoint on the deployed API. The local development API has no public webhook address until deployed or exposed through a secure tunnel.

## Activity discovery, Stories and Reels

EcoVibes updates a signed-in user's `last_seen_at` while the app is visible, at most once a minute. The People discovery score combines this recent activity, shared follows, active Stories, and recent Reels; it returns a short reason for each suggestion. A user is displayed as active only for five minutes after the last heartbeat. Reels use a separate ranking score from freshness, views, likes, and followed creators, while recently watched videos are down-ranked.

Stories can contain text and an optional photo and expire after 24 hours. Story/Reel uploads are authenticated, limited to 14 MB, checked against allowed media signatures, and stored under `server/data/social-media` in local development. Reels accept MP4/WebM video and keep view and like records in the database. Production deployments should point uploaded assets at durable object storage before using ephemeral application disks.
