# Project brief 07: Waste-to-Money

## Overview

Waste-to-Money is EcoVibes’ recyclable-material trading network. Collectors identify/sort batches and find compatible, verified recycling plants, material buyers, processors, repair/refurbishment centers and drop-off hubs. A waste item has value only when a real buyer/price/acceptance is confirmed; not every pickup is saleable.

## What exists now

WasteHub currently reuses the generic jobs/offers flow for collection requests and trust review for service-provider onboarding. It has no recyclable batch/material records, plant or buyer directory, live price/capacity, facility portal, verified weighing, chain-of-custody or settlement.

## Collector and facility flows

Collector submits material/type/estimated quantity/condition/area → reviews AI-suggested identification → compares only eligible destinations by freshness, quantity, open/receiving state, travel and stated price → selects/contact/requests confirmation → facility confirms receiving → collector delivers → facility weighs/records condition with evidence → collector confirms or disputes → parties confirm the transaction snapshot → provider confirms any payment → later processing/reuse events are added by the responsible actor.

Facility operator creates an organization → submits evidence and location/contact choice → staff verifies → authorized operators publish accepted materials, conditions, minimums, price/unit/currency/effective time, capacity range, receiving state, hours, requirements and payment method → update history and inquiries/orders are managed in portal.

## Map layer/profile requirements

Eight independently controlled layers: recycling plants; material buyers; processing facilities; repair/refurbishment centers; drop-off hubs; active collection jobs; moderated waste hotspots; cleanup missions. Facility profile includes name/verification, public location/navigation, materials/conditions, current and historic price update, minimum quantity, hours, receiving/capacity freshness, contact/chat, travel estimate, collector requirements and payment methods. Follow the privacy and matching policy in the [architecture](../ECOVIBES_ARCHITECTURE.md#waste-to-money-recycling-plant-network--collector-destination-system).

## Data, trust and money

Plan domain entities such as `waste_facilities`, `facility_members`, `facility_materials`, versioned `facility_price_quotes`, capacity/receiving snapshots, `waste_batches`, material breakdown, `weighing_records`, `waste_handoffs`, `waste_events`, purchase requests and evidence. Only create schema alongside a shipped workflow. Snapshot unit, quantity, price, currency and fees at trade confirmation. AI classification and collector-estimated weight are never verified scale data. Settlement uses EcoPay provider confirmation; never make an unlicensed EcoVibes balance or escrow claim.

## Acceptance criteria

- No unverified, stale or invented facility/price/capacity is shown as current.
- Matching hard-filters incompatible, closed, under-minimum or non-consenting destinations before ranking; result cards explain criteria and quote timestamp.
- Collector can use locality/list mode without GPS, reject an AI material suggestion, choose/contact destination and see route estimates labeled as such.
- Facility and collector see the same confirmed weight/price snapshot; disputes pause payment per policy.
- Journey history distinguishes estimated, recorded, independently verified, paid and downstream-recycled states; missing events remain missing.

## Monetization

Possible disclosed transaction/service fee, verified business subscriptions or buyer sourcing tools. Show collector gross amount, fees and net amount before agreement. No speculative token, guaranteed income or platform credit that implies cash value.

## Build prompt

> Implement Waste-to-Money in the existing EcoVibes repository in phases: verified facility directory and operator portal; text-first destination comparison; map layers and consented route; then evidence-backed weigh/handoff/payment. Begin with the current WasteHub, job and verification records; do not misrepresent those generic records as material inventory or live recycling partners. Inspect existing Waste architecture and reuse EcoVibes ID, trust, EcoMaps and EcoPay contracts. Model facilities as organizations, prices/status as versioned records with freshness, and trade progress as append-only authorized events. Use actual verified sources only. AI can suggest material classification but a person confirms it; only calibrated/authorized scale evidence produces a verified weight. Do not mark downstream processing or payment complete without the responsible provider’s evidence. Include report/dispute and low-data list fallbacks; keep all provider secrets server-side.
