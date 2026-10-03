# Project brief 03: EcoMaps

## Overview

EcoMaps provides place search, business/facility directories, optional map tiles, routing and location-aware layers to other EcoVibes products. It is a shared capability with layer-specific data and access policy, not a single map that exposes every user and job.

## What exists now

The app stores locality/area text such as city or neighborhood on marketplace/service records. There is no shared map/geocoding/routing provider, consented GPS search, facility directory or live spatial layer API.

## Layers and core flows

Shared map primitives support verified service providers, jobs, businesses/events, collection areas, recycling plants/material buyers/processors/repair centers/drop-off hubs, active collection jobs, cleanup missions and moderated waste hotspots. EcoWaste’s eight map layers and facility profiles are specified in the [architecture](../ECOVIBES_ARCHITECTURE.md#waste-to-money-recycling-plant-network--collector-destination-system).

Member opts into location → selects locality/search area → sees a text-first list and optional map → applies layer/material/open filters → opens a record → requests directions/contact or starts the owning layer’s workflow. Location denial has a fully functional manual locality path.

## Data and privacy

Keep public place coordinates separate from private user/service addresses. Every feature declares whether its point is public, approximate, participant-only or expiring. Exact active-job addresses require relationship authorization. Request GPS only for an action, explain purpose, allow denial, store minimal precision and expiry. Hotspots need moderation and must not reveal reporter/home identity. Track current facility price/capacity freshness; do not infer availability from marker presence.

Define adapters for geocoding/place search, tiles, routing/navigation and distance. Select vendors after verifying African coverage, commercial terms, attribution, offline behavior, data handling and cost. Return estimates with timestamp; a manual list/search remains available if the vendor fails.

## Acceptance criteria

- Location permission is optional; denial, empty results and provider outage retain usable manual search.
- A member can turn layers on/off; a query only returns records visible to that member.
- Public listings never contain precise household/task coordinates; selected job/facility interaction grants only the needed detail.
- Distances/routes are labeled estimates and never presented as guaranteed travel time.
- Low-data mode avoids loading map tiles/media until requested and offers a list view.

## Build prompt

> Build EcoMaps as a reusable, provider-neutral module in the existing EcoVibes app, not as a new standalone application. Read the master plan, this spec, the Waste destination architecture, current listing/job schemas and the system audit. Start with country/region/locality search and a text list over real authorized records; add the map SDK only after its provider and terms are configured. Create typed layer contracts, role/visibility checks, user-initiated location consent, approximate vs exact coordinate policy, freshness and attribution. Integrate an actual layer only when its records exist; never seed fake facilities/users/jobs as if live. Add the first real layer and a privacy-safe fallback, retain the mobile layout, and document provider keys as server/browser-public configuration only where safe.

## Monetization

Do not sell precise user location. Account for map-provider costs; later expose paid business visibility only as clearly labeled promotion that cannot override safety eligibility or “verified” status.
