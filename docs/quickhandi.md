# Quick&Handi integration

Quick&Handi is implemented as a first-class EcoVibes route. The local API also supports EcoVibes ID authenticated custom jobs with provider offers, owner selection, server-checked lifecycle transitions, participant messages, notifications, and issue reports. Listed-service discovery remains a client preview backed by fixtures.

## Working local preview flows

- Browse service categories, filter the fictional provider directory by service and neighbourhood, inspect sample service details and start a request.
- Create a request with description, service area and ASAP or scheduled timing. Request IDs use `QH-YYYYMMDD-xxxx`.
- For the server-backed custom jobs workspace, create an EcoVibes ID and add the provider role. The role and job permissions are checked on the API.
- Send a quote or accept a fixed price request, confirm, start and mark a job complete. The customer can confirm completion, open an issue, chat in a local job thread, cancel eligible requests and save a rating/review.
- Category and listed-service provider directory data are fixtures. Custom jobs, offers, statuses, messages and notices persist in the local SQLite database.
- Verification requests and dispute/support reports are recorded but require staff review tooling. Notifications are in-app records without push/email delivery. No live payment, payout, escrow or cross-device hosted service is connected.

## Backend boundary and shared infrastructure

The local EcoVibes development build has a SQLite API, password-hashed EcoVibes ID accounts, server-managed sessions, role authorization and append-only job/audit events. Listed service bookings and fixture profiles still run locally in the browser. Production Quick&Handi should be a domain module in the EcoVibes modular monolith and share hosted `users`, `profiles`, sessions, messages, order events, payments, notifications, reports and audit-log infrastructure. Keep service/job data and permissions owned by the Quick&Handi domain.

Recommended relational entities:

- `service_categories`: stable key, localized name, country scope, display order, active flag, parent key and audit metadata.
- `handi_profiles`: unique user reference, business profile, bio, verification state, response aggregates and suspension state.
- `handi_services`: profile/category relation, service text, currency, minor-unit price, pricing model, availability and active flag.
- `service_areas`: country, region, locality and optional private precise coordinates. Public discovery returns locality and approximate distance only.
- `service_requests`: buyer, category, request, private address reference, approximate locality, schedule, currency, amount snapshot, status and idempotency key.
- `quotes`: request, provider, amount in currency minor units, included scope, expiry and response state.
- `bookings` / `jobs`: accepted request, lifecycle state, cancellation actor/reason and timestamps.
- `job_events`: append-only state changes with actor, reason and request ID.
- `job_messages`: job-linked message metadata and attachment references; do not allow payment secrets in chat.
- `reviews`: completed job, reviewer, provider, rating, text, moderation status and uniqueness on (job, reviewer).
- `verification_records`: provider, level, evidence reference, reviewer, status, expiry and audit trail. Public status is derived server-side.
- `payment_intents` / `transactions` / `refunds`: provider-neutral references, integer minor-unit amount, currency code, fee snapshot, provider earnings, idempotency key and append-only events.
- `disputes`, `reports`, `notifications`, `favorites`, `wallet_ledger`, `withdrawals` and `audit_logs`.

Index active services by category/country/locality, service requests by buyer/provider/status/created timestamp, jobs by scheduled timestamp, and quotes by request/expiry. Enforce role checks in server code and foreign key/unique constraints in the database. Category administration and fee configuration need server authorization and audit history.

## API and state boundaries

Suggested versioned routes: `/api/v1/service-categories`, `/handis`, `/handi-profiles`, `/service-requests`, `/quotes`, `/bookings`, `/jobs`, `/jobs/:id/messages`, `/jobs/:id/reviews`, `/jobs/:id/disputes`, `/payments`, `/admin/quickhandi/categories`, `/admin/quickhandi/fees`.

Validate all request data server side. Keep precise addresses in a protected address entity and reveal them only to the assigned provider after booking rules allow it. Reuse EcoVibes sessions, role assignments, payment provider interface, message transport, notification preferences and analytics event outbox. Never derive payment success or provider earnings from the client.

Recommended state progression:

```text
requested → quoted → confirmed → in_progress → awaiting_customer → completed
requested → accepted → confirmed → in_progress → awaiting_customer → completed
requested / quoted / accepted / confirmed → cancelled (policy-controlled)
in_progress / awaiting_customer → disputed → reviewed resolution
```

Store amount, currency, fee and provider net as an immutable quote/booking snapshot. Use idempotency keys for request/payment retries. Release funds only through a regulated provider adapter after verified provider events and the platform's approved completion/dispute policy. Initial app preview leaves the payment call-to-action disabled and does not simulate success.

## Market expansion

Keep country, ISO currency code, minor-unit precision, phone rules, provider adapter, service areas, verification policy, tax settings and legal requirements in configuration. GHS is the preview display currency. Store all money as integer minor units; do not use floating-point values for payment arithmetic. Ghana-first fixtures use neighbourhood text and do not request device GPS.

## Custom jobs and provider teams

The preview now has two separate entry points: listed services use the existing request/quote/booking flow, while one-off tasks use the custom jobs board. A customer can set a proposed GHS budget and area; Handis can submit priced offers with scope and estimated timing; the owner selects one offer; the selected provider advances the job; then the owner confirms completion or reports an issue. Sample offers are clearly marked. Business, company and team provider types are represented in profiles and offers, with optional team size.

Custom jobs emit append-only SQLite events (`JOB_POSTED`, `JOB_OFFERED`, `JOB_ASSIGNED`, `JOB_STARTED`, `JOB_FINISHED`, `JOB_COMPLETED`, `JOB_CANCELLED`, `JOB_DISPUTED`). The API enforces actor permissions and legal transitions. The local notification table is not a transactional outbox and has no delivery provider; production needs idempotency keys, queue-backed notifications, hosted backups and staff dispute resolution. Custom job chat is stored server-side for participants.

## EcoVibes platform connection and next implementation order

Quick&Handi is one Earn surface within the shared EcoVibes ID. The current shell uses the same `@philipk` identity concept across the main app and Quick&Handi, and the marketplace can route delivery needs into Quick&Handi. Keep feature ownership modular while sharing authentication, profile references, notifications, moderation, analytics/event transport and provider-neutral payment interfaces.

Recommended build sequence from the product brief:

1. EcoVibes ID and authentication contract, then Quick&Handi services plus custom jobs.
2. Marketplace orders, provider-neutral payment intent/ledger architecture, and delivery/logistics events.
3. Verification, trust and safety, message transport and notifications.
4. Business and creator profiles, then an AI concierge that searches only permissioned platform data and routes users to the correct feature.
5. Rewards/referrals and a versioned developer API/event contract.

The local build has started the backend foundation and includes server catalog search across active products and open jobs. Wallet balances, withdrawals, escrow and rewards must come from server ledgers and regulated payment providers; never infer them from a client-side job state. The sidekick has no generative model, uses server search only when signed in, and falls back to bundled examples otherwise.
