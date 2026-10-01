# EcoVibes

EcoVibes is a mobile first, low data digital ecosystem prototype for people, creators, gamers, independent sellers and opportunity seekers. This repository begins from an empty workspace and establishes a deployable PWA client plus documented domain boundaries.

## What works in this build

- Responsive Home, Explore, Create, Messages, Profile, Marketplace, Gaming, Opportunities, Rewards, Wallet and Settings views.
- Local feed posting, likes, saves, follows, opportunity bookmarks and marketplace bag, persisted to the current browser profile.
- Three connection modes (Standard, Data saver, Extreme saver), offline status, service worker app shell caching, and locally saved post drafts.
- A dimensional EcoVibes ID hero and CSS-only layered illustrations keep the visual treatment lightweight.
- EcoVibes sidekick searches the local demo catalogue across products, opportunities, creators, games, communities, rewards and wallet help. It is a transparent deterministic preview, not a connected generative AI provider.
- Communities hub and a cross-ecosystem EcoVibes ID visual connect the Connect, Create, Play, Trade and Grow pillars.
- Quick&Handi is integrated from Home, the main ecosystem navigation, Marketplace delivery discovery and sidekick results. The local flow covers service search, area/category filtering, customer/provider mode, requests, quotes, job chat, lifecycle tracking, completion and review.
- Sandbox checkout interaction is clearly identified; it empties the local bag and does not create a real order or take payment.
- Quick&Handi provider profiles, availability, ratings, quotes and job interactions are device-local examples and do not represent verified people or actual bookings. Payment, escrow and payouts are unavailable.
- Example messages, points, wallet balance and community activity are illustrative interface content. They are not server records or real money, rewards, or message delivery.
- Fictional creators, products, games and opportunities only.

The local build now includes an EcoVibes API backed by SQLite. It supports EcoVibes ID registration and sign-in, seller/provider roles, server-authorized Quick&Handi job offers and lifecycle, job messages and notifications, direct marketplace listings and CSV imports, stock-reserving orders, split seller fulfillment, unpaid order cancellation with stock restoration, verification requests, support reports, and catalog search. These flows persist on the development machine; they are not yet a multi-user hosted service.

Payments and refunds require a payment provider callback that records a captured payment. Verification and dispute reports are stored for a future staff review queue. Store connectors, secure media uploads, account recovery, push/email delivery, and a generative AI provider are not connected. The sidekick can search the authenticated server catalog and otherwise uses the transparent local demo experience.

## Technology and boundaries

- React + TypeScript, built with Vite.
- Small modular client: `src/modules` (screens), `src/components` (shared UI), `src/data` (fictional demo content), and `src/lib` (local persistence).
- PWA shell with a cache-first shell and network-first same-origin requests. No media autoplay or remote images; no font or UI library download at runtime.
- `src/lib/storage.ts` keeps device-local demo state separate from the versioned API paths.
- `server/index.mjs` is a local modular API prototype with SQLite persistence, password hashing, opaque sessions, CSRF checks, role and ownership checks, and audit events.
- Modular monolith is the recommended backend deployment. Keep domains as packages/modules behind service interfaces; extract only after measured need.

## Requirements

Node.js 20 or newer and npm. Node 24 is used for this workspace.

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

See [docs/architecture.md](docs/architecture.md) for the ecosystem plan and [docs/quickhandi.md](docs/quickhandi.md) for Quick&Handi flows, schema, API and payment boundaries. Key safeguards:

- Use integer minor currency units and an explicit ISO currency code. Never use floating point for money.
- Payment provider callbacks, not the browser, establish transaction status. Keep sandbox and live providers separate.
- Reward points are non-transferable recognition points until an approved compliance design supports redemption.
- Authenticate with server managed, secure, HttpOnly, SameSite cookies; store only password hashes. Add CSRF protection, rate limits, validation, audit records and role checks on every protected API.
- Treat analytics and recommendations as interfaces. This build has no AI provider or machine learning model.

## Deployment

Build the static assets and deploy `dist/` to a static host/CDN with HTTPS and SPA fallback to `/index.html`; deploy the API separately behind HTTPS and configure the same-origin `/api/v1` routing. Serve `public/sw.js` from the site root. A production release still needs a hosted relational database, versioned migrations, backups, logging, monitoring, security review, privacy policy, account recovery, staff review tools and provider agreements.

## Environment template

See `.env.example`; all values are empty placeholders. Never commit real secrets.

### Live calls and community livestreams

The Calls & Live screen uses the existing EcoVibes ID session and the LiveKit media provider for real-time audio/video. Add `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` to the API environment to enable room creation and joining. Calls are private and use EcoVibes ID invitations; livestreams can be public and include server-generated RTMP ingest credentials for OBS. See `docs/architecture.md` for routes, webhook configuration, and token permissions.

The Home feed now includes 24-hour text/photo Stories and active-person recommendations. Use Reels in the ecosystem navigation to post MP4/WebM videos (up to 14 MB) and browse a ranked short-video feed. Activity presence only refreshes while the app tab is visible and expires after five minutes. Local uploads are stored under `server/data/social-media`; production should use durable object storage.
