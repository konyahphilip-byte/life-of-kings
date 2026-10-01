# EcoVibes build status

A responsive React/TypeScript PWA foundation has been created in the project root. It includes a connected, navigable client for the main EcoVibes product areas, a dimensional EcoVibes ID visual, a CSS-only sidekick orb and layered community art, locally persisted interactions, a transparent catalogue-search sidekick, data saver settings and drafts, fictional seed content, a service worker app shell, a relational backend architecture plan, Quick&Handi service discovery, custom jobs with provider offers, local job lifecycle events and team/business provider profiles; plus a Marketplace seller studio for direct listings, connector import previews, authorized URL review, CSV catalog import preview, supplier examples and fulfillment types.

## Start

```sh
npm install
npm run dev
```

## Verify

```sh
npm test
npm run build
```

Quick&Handi supports local category/area search, provider profiles, customer and Handi modes, service requests, quotes, local service chat, job state tracking, completion and review. Custom jobs add customer budgets, provider offers, owner selection, team/business provider labels and an append-only local event trail. Its demo provider records and activity stay in this browser only.

The UI is a client-side preview foundation. The sidekick searches only bundled demo listings; it is not connected to a generative AI model. It is not ready to serve real accounts or transactions: there is no server API, authentication, database, real-time message transport, provider-backed payment, server-backed order, moderation console, or admin authorization yet. Demo points, messages and profiles are not persisted across devices. See [the project README](../README.md), [architecture notes](../docs/architecture.md) and [Quick&Handi design](../docs/quickhandi.md) for the implementation boundaries and next steps. Marketplace products and imported connector entries are local samples; there is no OAuth, API sync, arbitrary URL extraction, live AI, supplier verification, order routing, tracking, or payment connection. Custom job records and event trails are local prototypes; custom-job messaging, server authorization and notifications remain unconnected.
