# Project brief 01: EcoAI action engine

## Overview and goal

EcoAI is the permissioned intent router and action engine across EcoVibes. It helps a person express a need, searches authorized records, explains options and hands off to the right product layer. It is not a superuser chatbot and does not bypass a layer’s own workflow.

## What exists now

Chale AI can call a server-configured model and search public active products/open jobs; deterministic search and a shared opt-in recommendation profile provide fallback/personalization. It cannot safely operate payments, maps, organization data, support cases or future modules as an end-to-end action engine yet.

## Users and primary flows

- “Find a verified electrician nearby” → ask for locality/location permission if needed → query EcoServices + EcoMaps → show sourced profiles, distance freshness and contact/book action.
- “Where can I sell 150 kg of PET?” → collect material/quantity/area → query Waste-to-Money eligible facilities → compare current quoted rates, minimums and receiving status → user selects/contact/requests destination.
- “Find jobs I qualify for” → query verified Eco Jobs and the member’s consented Eco Learn skills → explain matching evidence and gaps.
- “Help me buy a phone under GHS 3,000” → query Eco Market stock/price/source → present options → user explicitly checks out.
- “Pay this booking” → describe amount/provider/method → hand off to EcoPay checkout; EcoAI never collects credentials or reports paid before provider confirmation.

## Features and boundaries

**Must:** intent classification; permissioned server-owned search tools; returned source links and freshness; deterministic fallback; opt-in/inspect/pause/reset topic learning; localization-aware query; confirmation screen for create, message, booking, payment, cancel or other consequential action; idempotency key; audit event; tool-level rate limits and evals.

**Avoid:** direct SQL/database superuser access, private-message search by default, hidden location inference, training a foundation model on personal activity without separate consent, invented inventory/prices/results, acting on a guess, or one system prompt that grants all product permissions.

## Data and integrations

Tool registry includes name/version, input schema, required permission, data classification, side-effect level, timeout, source-layer and audit policy. Search results carry `resource_id`, public title, source layer, freshness, explanation and allowed action. Feed aggregate, consented, short-lived topic signals only. Respect each layer’s visibility and country configuration.

## Acceptance criteria

- Every result is from an authorized API and links to the source record; no result is invented on empty/error states.
- A write/booking/purchase/message action shows its target and exact material terms and waits for explicit user confirmation.
- A confirmation replay is idempotent; provider-dependent status waits for provider/domain callback.
- Pausing personalization stops new learning signals; reset removes or queues deletion of derived interest data.
- If the model/API fails, deterministic search and direct layer navigation remain usable.

## Build prompt

> Implement EcoAI as a permissioned action router in the existing EcoVibes repository. Read the master plan, this spec, `docs/chale-ai.md`, `server/chale-ai.mjs`, `server/recommendations.mjs`, current API auth and the feature audit. Keep React/TypeScript/Vite + Node API + Supabase/Postgres architecture. Preserve current Chale AI fallback and recommendation privacy controls. Register tools one layer at a time; each tool must enforce the same server authorization, consent and visibility policy as that layer’s regular endpoint. Return sourced, timestamped results. Require explicit confirmation before mutations, communications, bookings and payments; use EcoPay for payment. Never expose credentials, verification evidence, private chat or exact location to the model without a narrowly authorized user request. Add a bounded first vertical slice (public product/open job search plus one safe action), migrations only when needed, and report unsupported layers rather than mocking them as live.

## Monetization

Keep core discovery available. Later consider clearly labeled AI plans or business workflow subscriptions with usage limits and cost controls; never sell placement as an unbiased recommendation or make paid ranking invisible.
