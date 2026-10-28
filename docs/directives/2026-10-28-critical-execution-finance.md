# ECOVIBES — CRITICAL EXECUTION & FINANCIAL INTEGRATION DIRECTIVE
## Build, Test, Integrate, Commit and Prove the Missing Features

**DATE:** 28 October 2026

**PROJECT:** EcoVibes — by Quick & Handi

**REPOSITORY:** `konyahphilip-byte/life-of-kings`

**PRIORITY:** P0 — Critical development and partner meeting readiness

**ROLE:** Act as the lead full-stack engineer, AI architect, realtime communications engineer, fintech integration architect, cybersecurity specialist, QA engineer, and technical release manager.

---

# 1. IMPORTANT: STOP REPEATING THE PLANNING PHASE

Several development prompts have already been provided for EcoVibes.

Some work has been completed, but major promised functionality remains incomplete or has not been demonstrated.

**This instruction is a direct implementation assignment, not another request for a roadmap.**

Do not simply produce a new strategy document.

Do not spend the entire development session explaining what needs to be built.

Do not present existing unfinished features as completed.

Your responsibility is to inspect the actual codebase, identify the next implementation-ready task, modify code, test it, and produce verifiable results.

## Mandatory workflow

1. Inspect the current Git branch, code, relevant documentation, uncommitted changes, and recent pull requests.
2. Verify which previously requested features are already implemented.
3. Identify missing implementation and failed acceptance criteria.
4. Present a short plan with exact files to change.
5. Immediately implement the smallest safe, dependency-ready task.
6. Add or update tests.
7. Execute the tests.
8. Fix failures.
9. Run relevant regression tests and the production build.
10. Create a reviewable commit or pull request where authorized.
11. Report exact changes, test results, and remaining blockers.
12. Proceed to the next authorized task during the active development session.

Do not repeatedly audit the same code without using the findings to make measurable progress.

Protect unrelated work.

Do not merge or deploy production changes without the required authorization.

---

# 2. TEMPORARILY FREEZE UNRELATED FEATURES

Suspend unrelated feature expansion until the following systems meet their acceptance requirements:

1. Chale AI.
2. EcoVibes Connect — messaging, voice and video.
3. EcoVibes Live 3D Maps and real GPS.
4. EcoVibes Finance and partner payment integrations.

These are now the four critical engineering workstreams.

Security fixes, authentication, database integrity, monitoring, and deployment reliability remain mandatory.

Do not disable existing features.

Do not delete unfinished work.

Do not pause automated tests or progress reporting.

Keep the broader roadmap preserved for resumption after this priority release.

---

# 3. FIRST TASK — COMPLETE THE THREE PREVIOUSLY REQUESTED STEPS

The following three tasks were explicitly prioritized and remain subject to incomplete acceptance evidence.

Complete them, not merely describe them.

## STEP A — COMPLETE CHALE AI

Inspect:

- `server/chale-ai.mjs`
- `server/chale-provider.mjs`
- `server/chale-diagnostics.mjs`
- `docs/ai/CHALE_FREE_LAUNCH.md`
- Existing assistant frontend and API interfaces.
- Current hosted inference configuration.
- Existing Chale tests.

Verify that these paths and files remain current.

### Required implementation

Finish or verify:

- Genuine hosted model inference.
- Reliable conversational responses.
- Correct EcoVibes guidance.
- Authorized account-specific data retrieval.
- Private Quick & Handi job status.
- Authorized Waste-to-Money status.
- Model usage limits.
- Safe provider failure handling.
- Response timeouts.
- Account separation.
- Prompt injection defenses.
- Secure server-side tools.
- No unauthorized financial operations.
- AI cost controls.

Use existing Cloudflare Workers AI integration if approved and available.

Maintain the existing free-tier-first policy.

Do not create paid resources or switch to billable inference without authorization.

### Chale character requirement

Chale AI is the intelligence system.

Chale is the culturally grounded Ghanaian/African 3D companion.

Only the visible character is optional.

Create or finish:

**Settings → Personalization → Show Chale 3D Character**

Turning the character off must not disable:

- Chale AI chat.
- EcoVibes recommendations.
- Application assistance.
- Live tracking.
- Messaging or calling.
- Financial functionality.

Production 3D character development must not block functional Chale AI acceptance.

### Mandatory tests

Use two authenticated accounts.

Prove that:

- Both can receive genuine model responses.
- Each can access only authorized information.
- One user cannot retrieve another user's private job information.
- Provider failures produce safe fallback messages.
- Quotas and concurrency limits work.
- Disabling the character does not disable AI.

**Deliverable:** Tested Chale AI functionality with hosted evidence and a clear list of remaining limitations.

---

# 4. STEP B — COMPLETE ECOVIBES CONNECT

EcoVibes Connect is the common communication layer for Waste-to-Money, Quick & Handi, Marketplace, and other authorized interactions.

Inspect and reuse the existing LiveKit, job messaging, friend messaging, authentication, and communications interfaces.

Do not rebuild a separate calling system.

## Required capabilities

### Chat

- Real-time text messaging.
- Conversation history.
- Message delivery state.
- Authorized job conversations.
- Accepted-friend conversations.
- Blocking and reporting.
- Reconnection.
- Notification delivery.

### Voice calling

- Initiate call.
- Incoming call screen.
- Ringing state.
- Accept.
- Decline.
- End call.
- Microphone mute.
- Speaker controls where supported.
- Missed-call events.
- Call permissions.
- Network recovery.

### Video calling

- Genuine two-way video.
- Camera permissions.
- Microphone permissions.
- Front/back camera switching where supported.
- Camera on/off.
- Video-to-voice downgrade.
- Consent-based voice-to-video upgrade.
- Adaptive quality.
- Low-data fallback.
- Correct incoming-call handling.

Do not record calls by default.

Do not expose private telephone numbers.

### Waste-to-Money integration

Customers and assigned collectors must be able to communicate through the active collection screen.

### Quick & Handi integration

Customers and authorized providers must be able to call or message each other through the booking interface.

### Security

Use server-issued communication permissions.

A user must not gain access to another person's call simply by knowing their EcoVibes ID or job ID.

Apply rate limits, expiration, and user blocking.

### Mandatory real-device tests

Using two separate authenticated users:

1. Initiate chat.
2. Confirm real message delivery.
3. Start a voice call.
4. Receive and accept the call.
5. Verify two-way audio.
6. Start a video call.
7. Verify two-way video.
8. Turn off one camera.
9. Continue with voice.
10. End the call.
11. Verify unauthorized participants cannot join.
12. Verify blocked users cannot initiate new unauthorized contact.

Test foreground and background behavior separately, and document platform limitations.

Do not claim a call works based only on successful token generation or a mocked media connection.

**Deliverable:** A genuinely functional EcoVibes Connect communication flow, with test evidence.

---

# 5. STEP C — COMPLETE LIVE 3D GPS TRACKING

Build real location-based tracking for Waste-to-Money, using the existing EcoVibes stack.

## Required implementation

- Collector GPS permission.
- Authorized tracking sessions.
- Actual device location updates.
- Server-side location validation.
- Realtime customer subscriptions.
- Collector movement interpolation.
- Real geographic map.
- Tilted 3D map view.
- Pickup location pin.
- Recycler/receiving partner destination pin.
- Real route visualization.
- ETA where credible.
- Current waste status.
- Collector profile.
- EcoVibes Connect voice and video access.
- Chat.
- Waste Journey tab.
- Money tab for selling requests.
- Connection-loss warnings.
- Last valid location and timestamp.
- Tracking termination at the end of the authorized journey.
- Low-data and 2D fallbacks.

Use MapLibre, Mapbox, or compatible existing mapping infrastructure based on actual repository findings.

Do not build a fake map using arbitrary animation.

### Mandatory tests

Using an authorized collector device and separate customer account:

1. Create a collection request.
2. Assign a collector.
3. Start an authorized GPS session.
4. Send genuine device coordinates.
5. Display those coordinates on the customer's map.
6. Verify updates as the collector moves.
7. Simulate network disconnection.
8. Show stale-location feedback.
9. Restore connectivity.
10. Complete the collection.
11. Verify tracking permissions expire.
12. Confirm another user cannot view the journey.

**Deliverable:** Actual GPS-to-customer tracking, working map presentation, and tested access restrictions.

---

# 6. NEW CRITICAL WORKSTREAM — ECOVIBES FINANCE

## Goal

Build a secure, extensible, partner-ready financial infrastructure connecting EcoVibes to licensed banks, payment-service providers, mobile-money operators, and approved international remittance providers.

This is not simply a wallet interface.

It is the financial transaction and integration foundation of EcoVibes.

**The system must support real financial workflows only where provider approvals, operating permissions, and relevant regulatory requirements are satisfied.**

Do not assume EcoVibes is itself a licensed payment institution.

Do not custody or transmit customer money through an unapproved EcoVibes-controlled mechanism.

## Financial services to support

### A. Domestic Ghana transactions

Prepare or complete authorized workflows for:

- Merchant payments.
- Marketplace checkout.
- Quick & Handi service payments.
- Waste-to-Money seller payouts.
- Mobile-money collection.
- Bank-account payouts.
- Provider settlements.
- Transaction refunds.
- Failed payments.
- Transaction receipts.
- Payment disputes.

### B. Mobile-money connectivity

Design integrations supporting authorized providers and available services from:

- MTN Mobile Money.
- Telecel mobile-money services.
- AT Money.
- Other approved Ghanaian mobile-money partners.

Reuse a licensed payment aggregator where that is the simplest approved solution.

Avoid redundant direct telco integrations if an existing partner already supplies suitable coverage.

### C. Payment gateway integration

Inspect existing Paystack functionality.

Complete and verify relevant sandbox workflows for:

- Transaction initialization.
- Customer payment authorization.
- Payment verification.
- Signed webhook handling.
- Transfer recipient registration.
- Bank payouts.
- Mobile-money payouts.
- Transfer references.
- Refund processing.
- Reconciliation.
- Transaction status.

Use official provider APIs and exact available account capabilities.

Do not assume enabling Paystack's merchant transfer API authorizes unrestricted person-to-person remittance.

### D. Local money transfers

Prepare a domestic transfer experience through authorized partner capabilities.

Expected interface:

1. User selects Send Money.
2. User selects a permitted recipient type.
3. User enters the amount.
4. System checks eligibility, authentication and limits.
5. Provider supplies a valid quote or fee.
6. User reviews the full amount and charges.
7. User confirms through the approved provider flow.
8. Provider processes the transaction.
9. EcoVibes receives verified status events.
10. User sees pending, completed, failed, or reversed status.
11. User receives an appropriate receipt.

All movement of funds must occur through the authorized partner arrangement.

Keep any unsupported transfer capability disabled.

### E. International remittances

Build a **licensed-partner integration framework**, beginning with Ghana-supported corridors.

Separate:

- Sending money from another country into Ghana.
- Sending money from Ghana to another country.
- Transfers between two countries outside Ghana.

These are not automatically equivalent services.

Maintain a capability matrix by partner, corridor, currency, direction, regulatory approval and service availability.

For every proposed corridor, verify:

- Licensed entity responsible.
- Permitted sending country.
- Permitted receiving country.
- Funding methods.
- Payout methods.
- Customer verification obligations.
- Applicable transaction limits.
- Required approvals.
- FX requirements.
- Settlement arrangements.
- Consumer disclosures.
- Refund/reversal rules.

Do not activate outbound Ghana remittances simply because a provider supports inbound remittances.

Do not advertise a corridor until the approved partner confirms that the precise transaction direction and service model are supported.

---

# 7. FINANCIAL REGULATION AND PARTNER APPROVAL

Before enabling live financial transactions, review the current Bank of Ghana rules and the selected provider agreements.

Key references include:

- Payment Systems and Services Act, 2019 (Act 987).
- Bank of Ghana PSP licensing requirements.
- Current inward remittance guidelines.
- International Money Transfer Operator registration rules.
- Foreign exchange rules relevant to the selected transaction type.
- Current AML/CFT and sanctions-screening obligations.
- Ghanaian data protection requirements.
- Approved partner contractual requirements.

Identify which activities EcoVibes may provide solely as an authorized technical interface and which require additional authorization.

Do not assume the same legal requirements apply to all domestic collections, business payouts and cross-border remittances.

Prepare a compliance responsibility matrix identifying whether EcoVibes, a payment partner, a remittance operator, or another licensed institution is responsible for:

- Customer onboarding.
- KYC and customer due diligence.
- AML/CFT controls.
- Sanctions screening.
- Source-of-funds requirements.
- Transaction monitoring.
- Regulatory reporting.
- FX quotes and execution.
- Custody and safeguarding.
- Settlement.
- Consumer complaints.
- Dispute and refund handling.

Implement appropriate technical support for these controls, subject to partner integration requirements and qualified legal review.

**Production remittance execution must remain disabled until relevant approvals and contracts are verified.**

---

# 8. FINANCIAL SYSTEM ARCHITECTURE

Preserve the existing Node.js, React, TypeScript, PostgreSQL and payment infrastructure wherever suitable.

Do not replace it unnecessarily.

Create or extend a modular financial domain.

## Core services

### Payment orchestration

Routes authorized transactions to the correct approved provider.

### Partner adapters

Separate implementations for:

- Existing Paystack integration.
- Approved MTN or other telco integrations.
- Authorized bank integrations.
- Future licensed remittance partners.

### Transaction state machine

Use explicit states such as:

- Created.
- Awaiting authorization.
- Pending.
- Processing.
- Completed.
- Failed.
- Cancelled.
- Reversed.
- Disputed.

Keep distinct provider events and internal statuses.

### Financial records

Record:

- Internal transaction ID.
- Provider transaction ID.
- Sender and recipient references.
- Payment purpose.
- Currency and amount.
- Fees.
- FX rate when applicable.
- Estimated recipient amount.
- Actual provider-confirmed amount.
- Transfer method.
- Current status.
- Event history.
- Reconciliation information.
- Important timestamps.

Use integer minor currency units or the project's existing safe monetary representation.

Never use floating-point arithmetic for authoritative balances.

### Ledger and reconciliation

Create a reliable append-only accounting/event model appropriate to EcoVibes' actual financial role.

For monetary balances or settlement obligations maintained by EcoVibes, use appropriately controlled double-entry accounting.

Do not create a spendable customer wallet merely by recording simulated balances.

Reconcile internal transaction records with authoritative provider records.

### Risk and security

Implement:

- Idempotency.
- Duplicate-payment prevention.
- Signed webhook verification.
- Replay protection.
- Transaction limits.
- Partner authentication.
- Sensitive-data encryption.
- Permission-scoped APIs.
- Suspicious-transaction controls.
- Audit logs.
- Secure error handling.
- Failed-provider recovery.
- Reconciliation alerts.

Never mark a payment complete because the frontend says it succeeded.

---

# 9. BUILD AN ECOVIBES PARTNER FINANCE API

External financial institutions and technology partners must be able to integrate securely.

Do not give partners direct database access.

## Partner API requirements

Create or extend versioned interfaces for:

- Partner registration.
- Partner verification.
- Sandbox access.
- Supported payment methods.
- Supported corridors.
- Payment intent creation.
- Transfer quote requests.
- Recipient management.
- Authorized transaction initiation.
- Transaction status.
- Settlement status.
- Refund status.
- Reconciliation reports.
- Webhook subscriptions.
- Audit visibility.

Use scoped authentication appropriate to the existing platform.

Support credential rotation and revocation.

Implement signed webhooks, delivery retries, idempotency and rate limits.

Keep a partner capability registry so unavailable providers, methods, and corridors are never silently treated as active.

## Partner onboarding

Provide administrative workflows for:

1. Partner application.
2. Organization verification.
3. License/authorization review.
4. Contract and approval status.
5. Sandbox credentials.
6. Integration tests.
7. Production-access approval.
8. Monitoring.
9. Suspension.
10. Revocation.

Never auto-approve a financial institution or partner based on self-submitted profile data alone.

---

# 10. ECOVIBES FINANCE USER EXPERIENCE

Develop a professional financial interface, integrated into the main EcoVibes application.

## Money overview

Show only actual authorized data:

- Transaction history.
- Pending payments.
- Completed payments.
- Failed transactions.
- Incoming funds where supported.
- Outgoing transfers where supported.
- Payment receipts.
- Saved authorized payment methods.
- Disputes and support.

If wallet balances are unsupported, do not invent them.

## Send Money

Show:

- Destination country.
- Recipient method.
- Currency.
- Amount.
- Provider-supported fees.
- FX rate when applicable.
- Estimated recipient amount.
- Expected delivery information where available.
- Confirmation.
- Transaction progress.

Disable unsupported countries, payment methods and corridors.

## Receive Money

Show supported receipt methods through approved partners.

Do not imply a user has a bank account, wallet, or international receiving capability that has not been provisioned.

## Financial transparency

Every transaction should show:

- Status.
- Amount.
- Currency.
- Fees.
- Method.
- Reference.
- Provider where appropriate.
- Timestamp.
- Receipt.
- Support or dispute option.

## Chale AI integration

Chale may explain available payment methods, guide users through supported flows, and retrieve their authorized transaction status.

Chale must not independently move money, confirm a transfer, alter a ledger, or bypass authentication.

Chale's optional 3D character setting must not affect financial services.

---

# 11. FINANCE TESTING — NON-NEGOTIABLE

Build a full sandbox testing matrix.

## Domestic payments

Test:

- Successful collection.
- Declined payment.
- Insufficient balance.
- Timeout.
- Duplicate callback.
- Invalid signature.
- Replayed webhook.
- Cancellation.
- Refund.
- Provider outage.
- Reconciliation mismatch.

## Payouts

Test:

- Recipient creation.
- Valid account or wallet.
- Invalid recipient.
- Authorized payout.
- Duplicate submission.
- Pending transfer.
- Provider-confirmed success.
- Failure.
- Reversal.
- Reconciliation.
- Unauthorized payout attempt.

## Remittances

In isolated mock or approved partner sandboxes, test:

- Supported and unsupported corridors.
- Valid and invalid quotes.
- FX rate changes.
- Fee disclosure.
- Consent and confirmation.
- Expired quotes.
- KYC-required state.
- Sanctions/risk hold responses.
- Partner rejection.
- Recipient mismatch.
- Settlement notification.
- Cancellation and refund where supported.

Do not simulate real money settlement inside production.

Do not use genuine customer funds for initial development tests.

## Partner security

Prove:

- Partner A cannot read Partner B's transactions.
- Revoked credentials stop working.
- Replayed webhooks are safely handled.
- Duplicate transfer requests do not create duplicate transfers.
- Unsupported transaction methods cannot be initiated.
- Unauthorized users cannot initiate payments on behalf of others.

Every financial completion claim must reference actual test evidence.

---

# 12. DATABASE AND MIGRATIONS

Inspect current payment, wallet, order, job, and transaction schemas.

Reuse existing tables.

Do not create duplicate payment records for the same operation.

Where required, introduce appropriate entities for:

- Payment providers.
- Partner organizations.
- Partner credentials and access scopes.
- Payment intents.
- Transfer requests.
- Transfer recipients.
- Transaction events.
- Ledger entries.
- Reconciliation records.
- Webhook delivery events.
- Partner capabilities.
- Remittance corridors.
- FX quotes.
- Compliance review state.
- Transaction disputes.

Adapt names to existing project conventions.

Use additive, versioned migrations.

Apply least privilege and account isolation.

Never run destructive production migrations without authorization.

---

# 13. FINANCIAL PARTNER INTEGRATION PREPARATION

Research and document technical requirements for potential partners.

Prioritize:

### Ghana payment and mobile-money providers

- Paystack.
- MTN MoMo.
- Telecel-supported payment services.
- AT Money.
- Other suitable licensed PSPs.

### Banks and settlement partners

Identify suitable Ghanaian banking partners based on verified capabilities and required approval.

### Cross-border partners

Identify currently registered or authorized money-transfer and cross-border providers appropriate to each proposed corridor.

Verify current provider licensing and supported services through official sources.

Do not assume the provider offers a public API or grants direct access to unapproved developers.

Do not claim that a partnership has been established.

## Produce a partner readiness matrix

For each provider show:

- Proposed business use.
- API availability.
- Sandbox availability.
- Required credentials.
- Required commercial agreement.
- Regulatory approval dependency.
- Supported currencies.
- Supported transaction directions.
- Relevant fees and limits.
- Integration status.
- Technical blocker.
- Next partner action.

Prepare a technically credible integration package that can be presented in upcoming partner meetings.

---

# 14. PARTNER DEMONSTRATION REQUIREMENTS

Prepare a stable demonstration across all four priority areas.

## Chale AI

Show a genuine model response, correct app guidance and authorized information retrieval.

## EcoVibes Connect

Show two different users exchanging messages and, when verified, completing a real voice/video call.

## Live 3D Maps

Show genuine GPS movement if the feature has passed its acceptance tests.

Otherwise use a clearly labeled simulated demonstration.

## EcoVibes Finance

Demonstrate:

1. A sandbox payment.
2. Provider callback verification.
3. Transaction status.
4. Authorized mock or sandbox payout.
5. Reconciliation.
6. A proposed international transfer using a clearly labeled approved sandbox or mock corridor.
7. A partner API request with permission checks.
8. An auditable transaction history.

Never describe a mock international transfer as a live remittance.

Prepare a short explanation of which financial functions require partner approval.

---

# 15. MANDATORY EXECUTION ORDER

Do not restart an endless planning cycle.

Execute in small, tested milestones.

## Milestone 1 — Repository and release assessment

Verify the current main branch and existing progress.

Produce a short file-change plan.

## Milestone 2 — Chale AI acceptance

Complete real inference, private account data, security, fallback and character-toggle separation.

## Milestone 3 — EcoVibes Connect

Complete real messaging, voice and video calls and authorization testing.

## Milestone 4 — Live GPS

Implement actual authorized GPS publishing and customer subscription.

Then complete the 3D map interface.

## Milestone 5 — Finance foundations

Audit existing Paystack functionality and financial records.

Fix missing transaction integrity, event handling and reconciliation.

Implement the modular partner adapter and capability model.

## Milestone 6 — Domestic payment sandbox

Complete an end-to-end approved test payment and payout flow.

## Milestone 7 — Remittance sandbox and partner APIs

Implement scoped partner integration, corridor rules and a mock or approved sandbox remittance flow.

Do not enable live international transfers without the necessary approvals.

## Milestone 8 — Integration and hardening

Test all four systems together.

Fix critical defects.

Prepare a stable partner demonstration.

These milestones may be worked on in parallel only where dependencies, source changes and testing environments can be safely isolated.

If an external credential or approval blocks a milestone, document it and continue with the next safe independent engineering task.

---

# 16. REQUIRED PROGRESS REPORT AFTER EVERY MILESTONE

Use this format:

## ECOVIBES EXECUTION REPORT

**Milestone:**

**Current branch:**

**Commit or PR:**

**Files changed:**

**Implemented functionality:**

**Tests executed:**

**Tests passed:**

**Tests failed:**

**Hosted verification:**

**Real-device verification:**

**Mock or sandbox limitations:**

**Security findings:**

**Partner requirements:**

**Deployment status:**

**Founder action required:**

**Next implementation task:**

Provide source links where available.

Do not invent progress percentages.

Do not claim a development task is complete because a document or frontend mockup exists.

Update the repository's development progress tracker.

---

# 17. SECURITY AND COST RESTRICTIONS

Preserve existing security architecture.

Never expose API keys in GitHub, frontend code, chat messages or logs.

Do not enable production transfers without authorization.

Do not open financial access to unapproved partners.

Do not create paid cloud services without explicit approval.

Keep real financial assets separate from sandbox/demo balances.

No automatic funding, real remittance, or bank transfer may be triggered during tests.

No public production deployment or irreversible production change without approval.

Document missing credentials or partnership agreements instead of bypassing them.

---

# 18. CONDITIONS FOR COMPLETION

Do not declare this priority development assignment complete until:

### Chale AI
- Genuine hosted inference passes.
- Authorized user data access passes.
- Two-account privacy passes.
- Fallback behavior passes.
- Character toggle independence passes.

### EcoVibes Connect
- Authorized chat passes.
- Real voice call passes.
- Real video call passes.
- Unauthorized access is denied.
- Relevant device tests pass.

### Live Maps
- Genuine GPS reaches the customer.
- 3D map works.
- Stale-location behavior works.
- Permissions and session termination pass.
- 2D fallback works.

### EcoVibes Finance
- Financial domain integrity tests pass.
- Paystack sandbox payment and eligible payout tests pass.
- Provider events are authenticated.
- Duplicate payment protections pass.
- Reconciliation tests pass.
- Partner API authorization passes.
- Remittance sandbox supports approved test scenarios.
- Unsupported or unapproved live money movement remains disabled.
- Required regulatory and partnership blockers are documented.

### Partner readiness
- A stable demonstration is available.
- All live versus simulated functionality is clearly identified.
- API documentation exists.
- Critical security findings are resolved or explicitly block release.
- Deployment readiness is accurately reported.

---

# FINAL COMMAND TO CODEX

**STOP PRODUCING ROADMAPS WITHOUT IMPLEMENTATION.**

Continue the existing EcoVibes project.

Inspect the current codebase.

Show a short implementation plan.

Then implement, test, and document the first safe, dependency-ready task immediately.

Finish the three previously requested priorities:

1. Chale AI.
2. EcoVibes Connect — chat, voice and video.
3. Live 3D GPS tracking.

Add the fourth critical priority:

4. EcoVibes Finance — domestic transactions, mobile money, secure payment partner integrations, and a regulated-partner international remittance framework.

Preserve the remaining EcoVibes application.

Do not perform unrelated redesigns.

Do not describe mocked functionality as operational.

Deliver reviewable code, tests, evidence and clear founder-facing reporting.

If a task is blocked, identify the precise blocker, do not claim it is complete, and continue the next safe independent task.

**THE GOAL IS A REAL, TESTED, SECURE ECOVIBES PRODUCT THAT CAN BE DEMONSTRATED TO PARTNERS AND PROGRESS TOWARD A CONTROLLED GHANA LAUNCH.**

**ECOVIBES — CONNECT. TRACK. EARN. PAY. GROW.**