# EcoVibes

EcoVibes is a mobile-first, low-data digital ecosystem for people, creators, gamers, independent sellers and opportunity seekers. This repository contains a PWA client and a local API foundation, with a phased path toward hosted production services.

See the [system audit](docs/ECOVIBES_SYSTEM_AUDIT.md) for the current implementation map, the [target architecture](docs/ECOVIBES_ARCHITECTURE.md) for the staged Africa OS direction, and the [EcoVibes master build plan](docs/ecovibes-build-plan/README.md) for the layer-by-layer roadmap and standalone AI coding prompts.

## What works in this build

- Responsive Home, Explore, Create, Messages, Profile, Marketplace, Gaming, Opportunities, Rewards, Wallet and Settings views.
- Local feed posting, likes, saves, follows, opportunity bookmarks and marketplace bag, persisted to the current browser profile.
- Three connection modes (Standard, Data saver, Extreme saver), offline status, service worker app shell caching, and locally saved post drafts.
- A dimensional EcoVibes ID hero and CSS-only layered illustrations keep the visual treatment lightweight.
- Chale AI can use a server-configured language model and permissioned search over public active products and open Quick&Handi jobs. Without provider configuration, the app clearly falls back to catalog search or its local preview. It cannot make purchases, change balances or approve staff actions.
- Communities hub and a cross-ecosystem EcoVibes ID visual connect the Connect, Create, Play, Trade and Grow pillars.
- Shared adaptive discovery uses one opt-in, account-scoped topic profile across supported Marketplace, Quick&Handi, Stories, Reels, creator discovery and Chale AI catalog search. Users can pause or reset the learned profile; it does not expose one user's identifiable activity to another.
- Quick&Handi is integrated from Home, the main ecosystem navigation, Marketplace delivery discovery and sidekick results. The local flow covers service search, area/category filtering, customer/provider mode, requests, quotes, job chat, lifecycle tracking, completion and review.
- Waste & Recycling has a separate app entry point with authenticated collection requests and staff-reviewed waste-provider onboarding. Plant discovery, general pickup operations, verified weights and waste payments are not live yet.
- Sandbox checkout interaction is clearly identified; it empties the local bag and does not create a real order or take payment.
- Quick&Handi provider profiles, availability, ratings, quotes and job interactions are device-local examples and do not represent verified people or actual bookings. Payment, escrow and payouts are unavailable.
- Example messages, points, wallet balance and community activity are illustrative interface content. They are not server records or real money, rewards, or message delivery.
- Fictional creators, products, games and opportunities only.

The API supports EcoVibes ID sessions and roles, account-scoped language preferences, Quick&Handi custom jobs/offers/messages, direct marketplace listings and CSV imports, stock-reserving orders, split seller fulfillment, unpaid order cancellation with stock restoration, verification and support review, and catalog search. Local development uses SQLite. Production can use PostgreSQL after the versioned Supabase migrations are applied; the browser sends requests to the API rather than querying private tables directly.

Paystack test checkout, signed callback handling, staff-approved test refunds and a Shopify OAuth/catalog sync path are implemented in the API, but require provider configuration and live sandbox verification. Shopify is the only real store connector; other directory entries are previews, and CSV import remains available. Media can use private Supabase Storage when configured or local disk in development. LiveKit calls/rooms and Chale AI also need their server credentials. These code paths do not mean those services are deployed or ready for live transactions.

## Technology and boundaries

- React + TypeScript, built with Vite.
- Feature client modules live under `src/modules`; `src/data` contains sample content and `src/lib` contains API and local persistence helpers.
- PWA shell with a cache-first shell and network-first same-origin requests. No media autoplay or remote images; no font or UI library download at runtime.
- `src/lib/storage.ts` keeps device-local demo state separate from the versioned API paths.
- `server/index.mjs` is a local modular API prototype with SQLite persistence, password hashing, opaque sessions, CSRF checks, role and ownership checks, and audit events.
- Modular monolith is the recommended backend deployment. Keep domains as packages/modules behind service interfaces; extract only after measured need.

## Requirements

Node.js 22.13 or newer and npm, as declared in `package.json`. Node 24 is used for this workspace.

## Install and run

```sh
npm install
npm run dev
```

Vite prints a local URL. For an installable PWA and production service worker, use the production build:

```sh
npm run build
npm run preview
```

`npm run dev` starts both the API (`127.0.0.1:8787`) and Vite; Vite prints the browser URL. API data is stored in `server/data/ecovibes.sqlite`. Keep that file private and back it up if you need to preserve local development data. `ECOVIBES_DB_PATH` and `API_PORT` can override the API defaults. For live media, copy `.env.example` to `.env`, add your LiveKit server URL and API credentials, then restart `npm run dev`. Keep `.env` private and never put provider secrets in the browser bundle.

## Tests

```sh
npm test
```

## Low data and offline behavior

The initial route uses text, CSS artwork and inline icons rather than large image downloads. The Data saver preference is persisted locally and currently affects media treatment and prefetch behavior (there is no prefetching). Extreme saver keeps content text first. The service worker caches the app shell and same-origin static assets, then tries the network for other same-origin GETs. Previously visited server data is not yet cached as structured records, and actions are not synchronized to a server. The offline banner reports browser connectivity and locally stored drafts remain available on that device.

Before real media launches, add upload validation and server side image variants, thumbnails and video transcodes. Serve responsive sizes and pause all video by default on constrained connections.

## Architecture decisions

See [docs/ECOVIBES_SYSTEM_AUDIT.md](docs/ECOVIBES_SYSTEM_AUDIT.md), [docs/ECOVIBES_ARCHITECTURE.md](docs/ECOVIBES_ARCHITECTURE.md), [docs/ecovibes-build-plan/README.md](docs/ecovibes-build-plan/README.md), [docs/architecture.md](docs/architecture.md) and [docs/quickhandi.md](docs/quickhandi.md) for implementation details and target boundaries. Key safeguards:

- Use integer minor currency units and an explicit ISO currency code. Never use floating point for money.
- Payment provider callbacks, not the browser, establish transaction status. Keep sandbox and live providers separate.
- Reward points are non-transferable recognition points until an approved compliance design supports redemption.
- Authenticate with server managed, secure, HttpOnly, SameSite cookies; store only password hashes. Add CSRF protection, rate limits, validation, audit records and role checks on every protected API.
- AI search is a server-side optional provider integration, not an unrestricted agent; use permissioned catalog tools and disclose when the provider is unavailable.

## Deployment

Use the prepared [deployment guide](DEPLOYMENT.md) and Render blueprint. Before a production release, apply and verify the hosted PostgreSQL migrations, configure provider secrets in dashboards, test sandbox payment callbacks and refunds, verify staff MFA and least privilege, and complete a hosted backup/restore drill, monitoring, privacy, account recovery and provider-policy work. The latest production build, API syntax check and local API health endpoint passed; the full test suite and hosted payment/refund, migration or restore flows have not been verified in this hardening pass. See the audit for remaining operational gaps.

## Environment template

See `.env.example`; all values are empty placeholders. Never commit real secrets.

### Live calls and community livestreams

The Calls & Live screen uses the existing EcoVibes ID session and the LiveKit media provider for real-time audio/video. Add `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` to the API environment to enable room creation and joining. Calls are private and use EcoVibes ID invitations; livestreams can be public and include server-generated RTMP ingest credentials for OBS. See `docs/architecture.md` for routes, webhook configuration, and token permissions.

The Home feed includes 24-hour text/photo Stories and active-person recommendations. Use Reels in the ecosystem navigation to post MP4/WebM videos (up to 14 MB) and browse the short-video feed. Activity presence only refreshes while the app tab is visible and expires after five minutes. Local uploads use `server/data/social-media`; configure private Supabase Storage for hosted media.
