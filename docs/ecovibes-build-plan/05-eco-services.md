# Project brief 05: Eco Services

## Overview

Eco Services connects customers to local, independent service providers—initially mechanics, electricians, tutors and selected household/business services—using the Quick&Handi job lifecycle as a reusable service engine.

## What exists now

Quick&Handi already supports API-backed custom jobs, offers, offer selection, participant messages and status events. Its provider directory, sample availability/reviews, geospatial matching, real dispatch and complete dispute resolution are not yet a verified live service marketplace.

## User flow

Customer chooses service and locality → sees eligible verified providers, scope, availability and disclosed quote basis → requests quote/booking → provider offers price/time/scope → customer selects one → address is disclosed only as needed → both parties coordinate → provider marks progress/completion with evidence → customer confirms or disputes → review/support/settlement follow.

## Features

**Must:** provider organization/profile; category and service area; business/skill verification; provider schedules/availability; structured request; quote revisions and immutable accepted quote; appointment/status history; participant-only chat; cancellation/dispute; review/report; notification; staff review; location/locality fallback. Mechanics and electricians may need license/credential verification by jurisdiction; tutors need qualifications/subjects and learner safety rules.

**Avoid:** publishing personal numbers/precise home addresses to every provider, guaranteeing safety from a badge alone, unverified star ratings, medical/legal/regulated work without additional policy, or charging a lead without clear terms.

## Data

`provider_profiles`, `provider_services`, `service_areas`, `availability_slots`, `service_requests`, `quotes`, `bookings`, `booking_events`, `job_messages`, `evidence_assets`, `reviews`, `disputes`, `verification_cases`. Scope data by customer/provider/organization and retain quotes/events as immutable snapshots.

## Acceptance criteria

- A verified eligible provider can quote; customer can accept exactly one quote; duplicate accept is safe.
- Invalid actor/status changes are denied; accepted price/scope cannot be edited silently.
- Exact location is revealed only to assigned provider at the configured stage.
- Both parties can cancel/report a problem under visible rules; dispute freezes settlement.
- Completion, notifications and review requests are recoverable after network failure.

## Monetization

Begin with disclosed booking/service fees or provider SaaS only after the booking flow and refund rules work. Do not charge job seekers merely to access a quote; disclose taxes, provider terms and any platform commission up front.

## Build prompt

> Complete Eco Services in the existing EcoVibes repository by extending Quick&Handi rather than duplicating jobs. Inspect current `src/modules/quickhandi`, API routes, provider verification, map/address handling, payment status and audit. Deliver one category end-to-end (start with a lower-risk local service); then add mechanics, electricians and tutors with their own evidence/eligibility policy. Persist profile, real availability, quote snapshot, booking events, participant chat and dispute status. Validate every transition server-side, redact exact addresses from discovery, and keep money test-only until EcoPay launch gates pass. Preserve current EcoVibes ID and other pages; no fake provider availability/reviews. Add migration/docs and a failure/denial path for every external integration.
