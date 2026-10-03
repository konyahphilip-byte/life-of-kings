# Project brief 08: EcoVibes Collect

## Overview

EcoVibes Collect coordinates general pickups such as household/commercial waste collection, bulky-item removal, scheduled neighborhood collection and cleanup dispatch. It is separate from Waste-to-Money: a pickup can be a paid service without the collected waste being bought, recyclable, weighed for resale or credited to the customer.

## What exists now

There is no separate persisted general waste pickup/municipal dispatch domain. The Waste page is a collection-request preview backed by the generic job workflow; a separate Collect service, schedule, vehicle dispatch, proof and billing must be built explicitly.

## User flows

Resident/business chooses a collection type → describes volume/access and locality → selects one-time or recurring schedule → sees approved provider and exact service price/fees → books → provider accepts and follows scoped status/route → pickup proof and customer receipt → customer rates/reports; missed pickup/refund/dispute routes are clear. Municipal/cleanup coordinators can create an area mission and assign verified teams with limited participant data.

## Features

**Must:** service taxonomy; address/locality and access details; volume estimate; service area/schedule; quoted fees; provider eligibility/vehicle constraints; assignment and status; participant-only contact; pickup evidence; cancellation/no-show/refund rules; report/dispute; support/notification. Show final destination only when a verified provider reports it; integration with Waste-to-Money is an explicit, consented material handoff when applicable.

**Avoid:** promising landfill diversion without downstream evidence, forcing customers into recycling valuation, exposing household addresses publicly, guessing municipal schedules or bundling commercial hazardous waste without a distinct regulatory policy.

## Data and acceptance criteria

Use separate `collection_requests`, service quote/booking events, provider/vehicle records, schedule, pickup evidence and optional handoff reference to a `waste_batch`. Mark pickup complete separately from sorting/recycling/disposal. User can see schedule, selected provider, price and completion evidence; cancellations/no-shows follow a written state machine; all exact location access is logged and limited.

## Monetization

Disclosed collection charge or municipality/business contract, plus optional recurring subscription only after service coverage exists. Do not credit users with recycling value unless the separate Waste-to-Money flow confirms a buyer and weighed trade.

## Build prompt

> Build EcoVibes Collect as a distinct general-pickup service layer in the existing EcoVibes repo. Reuse EcoVibes ID, EcoServices provider verification, EcoMaps location/route and EcoPay payment adapters, but create its own pickup request/booking/status and pricing semantics. Do not reuse Waste-to-Money batch/trade records as the pickup record, and do not infer recycling or customer cash value from pickup completion. Begin with one non-hazardous pickup category in one verified service area. Add locality fallback, exact-address privacy, scheduled slots, quote snapshot, provider assignment, completion proof, no-show/cancel/refund and audit. Include explicit handoff only when an independently verified recycling transaction accepts the material. Never show coverage, routes or pickup slot as live unless backed by current provider records.
