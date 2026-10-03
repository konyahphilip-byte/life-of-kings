# Project brief 00: EcoVibes Core and User Management

## Overview

Provide one secure EcoVibes ID and three connected but separately permissioned environments: an individual account, an organization/partner workspace, and the EcoVibes staff Admin Command Center. This is shared infrastructure for every current and future EcoVibes product layer.

## What exists now

The repository has Supabase Auth integration with an EcoVibes cookie-session bridge, an EcoVibes ID/account screen, customer/seller/provider roles, provider/seller profiles, verification and support records, staff review routes, audit events and `BackendWorkspace`. It does not yet provide the complete member Privacy Center/session/device manager, many-to-many organization/branch tenancy, delegated staff invitations, comprehensive granular permission catalog, staff user/organization search and case-management command center, or government/partner-specific workspace. Use the current audit as the as-is source; extend current records and controls rather than creating a second login system.

## Goals / non-goals

**Goals:** primary Supabase Auth; stable internal user ID and public `@username`; recovery/session/device controls; personal privacy center; many roles per identity; organization and branch tenancy; invitations/team administration; granular server-side permissions; staff user/organization/service/finance/security/support queues; consent, audit and Pan-African configuration.

**Not now:** a social credit score, bulk export of identity evidence, routine staff access to private messages, automatic account merging by email, or unrestricted staff impersonation.

## Account hierarchy and journeys

```text
EcoVibes Identity Core
├── Individual account: member profile, preferences, privacy, security
├── Organization accounts: business/NGO/facility/government workspace and branches
└── EcoVibes Administration: staff-only command center with scoped permissions
```

- **Member:** signs in → manages profile/contact/language/country/addresses/privacy/sessions → switches only among authorized personal and organization contexts.
- **Organization owner/admin:** creates or joins an organization → adds branches/services → invites staff by email, phone or Eco ID → grants scoped permissions → reviews staff activity.
- **Organization operator:** sees only assigned workspace data/actions (for example dispatchers see assigned collections, finance sees permitted transaction records).
- **Staff reviewer/support:** opens the least-privilege queue → accesses only case-minimum data → records a reasoned approve/reject/escalate/support action → user receives appropriate status/appeal path.
- **Platform administrator:** manages platform configuration/access under MFA, privileged-role separation and audited reauthentication; super-admin is exceptional break-glass access, not an everyday shared account.

## Required user-facing account and privacy surfaces

1. **My EcoVibes Account:** name, photo, Eco ID, bio, country, preferred language, account/context; date of birth only where needed for age/safety/legal policy.
2. **Contact and security:** email/phone and confirmation state, credential recovery, sessions/devices, revoke other sessions, MFA and passkeys where supported. A payment PIN is never stored by EcoVibes unless an approved, threat-modeled use case exists; never collect provider PINs.
3. **Addresses and saved places:** personal/business/work/pickup/delivery locations with labels, per-purpose sharing, precise-location encryption, retention and revoke controls.
4. **EcoPay connection:** provider-backed methods, transactions, receipts, refunds and subscription status when implemented. Display any stored-value wallet only after a compliant ledger/provider exists; never expose full payment credentials.
5. **Notification center/preferences:** security/account/operations/payment/business/system categories; user controls marketing and ordinary alerts. Essential security and legally required notices cannot be silently disabled.
6. **Eco Privacy Center:** profile/data view, location/camera/microphone/contact/notification permissions, connected services, AI data use, sharing choices, data export and deletion request. Explain purpose at point of use and avoid dark patterns.

## Verification levels

Verification is contextual; do not require government ID for ordinary browsing or use. A configurable baseline is: Level 0 unverified; Level 1 phone confirmed; Level 2 email confirmed; Level 3 identity checked when a service/legal risk requires it; Level 4 business/organization verified; Level 5 EcoVibes partner verified. Store evidence and decision metadata separately from public badges, define expiration/re-review and appeals, and only show the lowest necessary public status. Do not present Eco ID as a government identity.

## Organization tenancy and Partner Hub

Organizations include businesses, waste operators, recycling plants, NGOs, government agencies, schools, hospitals, logistics providers, service companies, cooperatives and community groups. Each has a profile, country, locations/branches, service areas, contacts, staff and verified capabilities. Registration documents, private contacts and payment details are never public by default.

An organization owns its own workspace. `organization_id` and, where applicable, `branch_id` scope every private record/query/index. Company A cannot list, search, mutate or infer Company B records. Add row-level tests for cross-tenant denial on every endpoint. Membership is explicit and revocable; organization roles cannot grant global EcoVibes staff privileges.

Partner Hub includes dashboard, team management, invitations, departments/branch scopes, service-specific jobs/orders, authorized maps/dispatch, facilities/vehicles, analytics and permitted finance. Customize dashboard widgets without changing access policy. Invite by email, phone or Eco ID using expiring, single-use tokens; inviter permission, target organization and role scope are checked server-side. Organization admins can invite/remove/suspend staff, assign only roles they are allowed to delegate, and review scoped activity.

Starter granular permissions include `users.view/manage`, `bookings.view/assign/cancel`, `vehicles.view/manage`, `routes.view/manage`, `payments.view/manage`, `analytics.view`, `reports.export`, and domain-specific market/jobs/collections/facility permissions. Roles are permission bundles (owner, admin, operations manager, dispatcher, collector, driver, finance, analyst, support, viewer), never a substitute for resource/tenant checks.

## EcoVibes Admin Command Center

Staff-only and separated from Partner Hub. Its navigation may include Users, Organizations, Services, Operations, Payments, Security, Support, Reports and Audit. Build secure queues and detail views over existing records instead of a fake “all data” dashboard:

- Search Eco ID/name and, only with permission, phone/email; filter by account type, country, status, role, organization, verification, created date and last activity. Sensitive search itself is audited.
- Review/verify organizations and users, handle reports/support/disputes, see operations/payment status, investigate login/security events, and view minimum necessary data.
- Authorized actions may verify, restrict, suspend, reactivate, deactivate, resolve a report, reset a security control through the recovery workflow, or require re-verification. High-risk actions require confirmation, exact permission and reauthentication; status choices are active, pending, unverified, restricted, suspended, deactivated or deleted. Every transition records actor, target, reason, time, duration where relevant, result, case/reference and appeal path.
- Separate support, operations, finance, security, content, platform and exceptional super-admin permissions. Sensitive identity evidence, private-data access, exports and payment actions need distinct access grants and audit events.
- No general impersonation or unrestricted “delete everything.” Support-assisted account recovery uses a defined proof process and does not reveal passwords, MFA secrets or payment credentials.

Government workspaces are partner organizations, not platform admins. They may see explicitly authorized aggregate service-coverage, waste and infrastructure reports; they do not receive individual account data simply because they are a government agency. Collector/driver views expose only assigned jobs/routes and necessary contact/access instructions. Seller/creator staff see only authorized store/content/analytics records.

## Audit, support, notification and analytics

`ECO AUDIT LOG` is append-only and tamper-resistant, with actor, action, target, timestamp, request/event ID, reason and result. Capture logins/security events, role/permission changes, verification decisions, account/org status changes, sensitive-data access, exports and payment-related administrative actions. Do not log secrets or full identity evidence. Corrections append a new event; no update/delete path for ordinary admins.

Support/disputes use cases with ID, status, priority, assigned team, timeline, resolution and audit history. Notification delivery uses a retryable outbox; preferences do not suppress critical security events. Analytics use minimized/aggregated measures (users, organizations, verification, adoption, geographic distribution); set access and retention limits and do not expose individual profiles in broad dashboards.

## Pan-African and low-data requirements

Use country configuration for ISO country, currencies/minor units, language/localized labels, phone/address formats, time zone, identity/verification providers, payment provider, tax/legal requirements, service availability and operational support. Start with Ghana/GHS but make country additions data/config driven. Validate local rules before enabling a country; never imply uniform verification/legal requirements.

Account, recovery, permission and essential support pages must work on mobile web and low bandwidth: small payloads, compressed assets, safe retry, meaningful offline/read-only state, and no mandatory animations. Do not cache sensitive identity documents, session tokens or exact locations in an offline app cache.

Never expose payout or authentication secrets to staff. Do not add a generic “edit any user” tool. User-visible account deletion must follow data-retention and legal-hold rules.

## Data and authorization

Use immutable internal `user_id`; unique public `eco_id`; `auth_identities`; `roles`/`user_roles`; `organizations`/`organization_members`; session inventory/revocation; consent/privacy preferences; `staff_access`; verification cases; support reports; append-only `audit_logs`. Existing code has Supabase Auth linkage, cookie sessions, customer/seller/provider roles and a staff review surface; inspect and extend these instead of replacing auth.

Every staff route checks MFA assurance, permission, organization/case scope, and reauthentication for sensitive actions. Log actor, target, reason, request ID and timestamp, excluding secrets and unnecessary PII. Deny direct browser access to API-owned database tables.

## Definition of done / acceptance criteria

- A member can create/manage account, recover access, inspect/revoke sessions, change privacy choices and submit export/deletion requests; expired/revoked sessions fail API requests.
- Linking a legacy ID requires an authenticated account action; email equality alone never merges accounts.
- A user can hold multiple roles/organizations and switch context with active context visibly identified; no duplicate login per product layer.
- Organization owners can manage permitted staff; cross-organization reads/writes fail and are tested; an organization admin cannot reach platform admin controls.
- Staff without exact scoped permission cannot search protected identifiers, approve verification, suspend accounts, access sensitive finance/evidence or edit roles.
- Support, operations, finance, security and exceptional super-admin functions are distinct; every sensitive access/action creates an immutable audit record that an authorized auditor can review.
- Government users only see specifically authorized datasets; collectors, sellers and creators only see the work data their current assignment/role requires.
- Account export/deletion requests show status and honor configured retention/legal hold; no silent destructive deletion.
- Security, account and support tasks work on mobile and low bandwidth, and country-specific labels/config can be added without replacing identity keys.

## Build prompt

> Implement the EcoVibes Identity & Access Management chapter in the existing EcoVibes platform. Do not rebuild, remove, downgrade or visually regress existing features. Read this spec, the master plan, architecture/system audit, Supabase Auth/session code and migrations, staff `BackendWorkspace`, EcoVibes ID UI, all current organization/provider/domain policies, and the deployment guide before editing. Keep the existing React 19/TypeScript/Vite client, Node API, Supabase Auth and PostgreSQL migrations with SQLite local development; retain the explicit Supabase Auth→EcoVibes session bridge unless a replacement is deliberately specified. Model one person/user with many roles and contexts, organizations with branches and memberships, three distinct surfaces (personal account/privacy, Partner Hub, staff-only Admin Command Center), granular server-side permissions, configurable verification levels, security/session controls, support cases and append-only audit. Every private organization record must be tenant-scoped and cross-org access denied; government agencies receive only authorized aggregates; assigned collectors/drivers and seller/creator staff receive minimum-necessary fields. Add account/profile/contact/address/notifications/privacy/session controls incrementally; do not expose secrets, payment credentials, unrestricted staff impersonation, routine private-message access, or a universal everyday super-admin. Require MFA/re-auth for privileged staff actions and document capabilities that need provider support (MFA/passkeys, SMS, payments). Add schema changes in reviewed migrations, preserve migration/SQLite parity, protect existing working-tree edits, never commit secrets, and build in this order: identity/session and self-service controls; roles/permission engine; org tenancy/branch membership and invitations; staff command center/audit/support queues; specialized product roles; country configuration. Implement one end-to-end slice at a time. Verify customer/collector/business/partner/government/staff paths and cross-organization denial before claiming production readiness; report unimplemented/externally blocked controls honestly.

## Monetization

No charge for identity, recovery, privacy controls or basic safety/support. Organizations may later pay for explicitly scoped administrative/business tools; never paywall access to one’s own account, consent or appeal.
