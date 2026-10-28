# October27 founder priority repair directive

This directive is the current priority order. Earlier calling-first and wider expansion queues are superseded. The attached founder repair brief is preserved below. The founder additionally requires these queued capabilities, without delaying urgent email/authentication/Chale UI/shared activity/recommendation repairs:

- Unified My EcoVibes Activity: authorised existing service/waste/order/message/request/dispute/support/progress records with stable IDs, ownership, status, history and next actions. Reuse domain sources; no fictional records or private-account merging.
- Low-data/recovery: reuse saver modes; efficient images/pagination/network states, safe drafts/retries/offline/duplicate protection. Success only after server confirmation.
- Trust Centre: explain genuine account/provider/collector verification, location permissions, payment/refund/privacy/block/report/dispute states. Evidence-backed badges only.
- Context-aware Chale: relevant pillar/screen/navigation/account help; private tools require independent server authorisation.
- Support: owned case references/status/technical error IDs, authorised staff review and resolution history. No unsupported live-support or resolution-time promise.
- Verified impact: separate estimated, user-reported, collector-confirmed and facility-verified measurements. No unsupported environmental facts.
- Major repairs: meaningful privacy-preserving failure monitoring, appropriate authorised disable control, deployment/rollback plan, two real accounts, low-end device where available, organisation isolation and network-failure acceptance. Update the single authoritative dashboard.

Final order: email/recovery; false-success/security; Chale launcher/settings; shared publishing/activity; measurable recommendations; Chale quality; messaging/notifications; genuine GPS/Waste; Activity Centre/low-data; Trust/support/impact. Each is a separate testable increment; listing a capability does not authorise premature feature expansion. Keep Games paused. No paid service, secrets exposure or unapproved public deployment.

---

# ECOVIBES — PRIORITY REPAIR, INTEGRATION AND REAL-WORLD VERIFICATION

You are the lead full-stack engineer, security reviewer, mobile UX engineer and QA lead responsible for bringing EcoVibes to a reliable, demonstrable production standard.

**MISSION**

Fix the broken and incomplete functionality identified in the latest EcoVibes assessment. Prioritise functional correctness, real server-backed operations, reliable delivery, mobile usability, security and verified end-to-end journeys.

Do not confuse an attractive interface, passing unit tests or a displayed success message with a completed real-world operation.

Work against the actual EcoVibes repository and connected services. Inspect the existing architecture, implementation, migrations, configuration and tests before changing anything.

Preserve working features, existing user data and established business rules.

## NON-NEGOTIABLE ENGINEERING RULES

1. Inspect before implementing. Reuse existing services where appropriate.
2. Never invent success responses, orders, recommendations, notifications, financial transactions or activity metrics.
3. Database writes must use authorised server-side operations and enforce account/organisation isolation.
4. Never expose API keys, SMTP passwords, service-role credentials or private user data.
5. Do not bypass authentication, row-level security, permissions or payment checks to make a demonstration pass.
6. Prefer small, reviewable changes with regression tests.
7. Distinguish code completed locally from functionality verified in a deployed environment.
8. When external credentials, DNS changes, infrastructure provisioning or financial authorisation are required, identify the blocker and request approval.
9. Test failure states, recovery, duplicate requests, slow networks and reconnect scenarios.
10. Do not silently replace real functionality with mock data.
11. Keep Games and unrelated feature expansion paused.
12. Maintain a single consolidated capability-status report.

Use these status labels only:

- DEPLOYED — live and verified
- LOCALLY BUILT — implemented but not deployed
- UNVERIFIED — exists but lacks sufficient test evidence
- BLOCKED — requires an external dependency, credential or approval
- MISSING — not implemented

---

# PHASE 0 — EMAIL DELIVERY AND ACCOUNT TRUST

**IMPLEMENT FIRST. HIGHEST PRIORITY.**

### A. Diagnose email delivery

Inspect:

- Supabase Authentication configuration
- Existing SMTP or transactional email provider
- Sender-domain configuration
- Email confirmation and password recovery handlers
- Redirect URLs
- Auth state and session handling
- Rate limiting and email delivery failures
- Existing email templates

Determine why confirmation emails are vague, unreliable or missing.

Use an appropriate production transactional-email solution compatible with the current architecture.

Verify the actual sending domain and investigate SPF, DKIM and DMARC configuration.

Do not claim domain authentication is complete without checking it.

Do not replace production credentials or change DNS without authorisation.

### B. Implement professionally branded EcoVibes emails

Create responsive, accessible HTML emails with suitable plain-text fallbacks.

Use the EcoVibes brand identity consistently.

The confirmation email must contain:

- EcoVibes logo or recognisable branding
- Clear subject, such as "Confirm your EcoVibes email address"
- Personalised greeting when appropriate
- Short explanation of why confirmation is required
- Prominent "Confirm Email Address" button
- Working confirmation destination
- Actual configured expiration period
- Guidance for expired links
- Instructions for requesting another confirmation email
- Guidance for recipients who did not create the account
- Recognisable support identity

Create an equally professional password recovery email with a clear "Reset Password" button, accurate expiration information and safety guidance.

Do not hardcode an expiry duration without verifying configuration.

### C. Complete the account flow

Verify these journeys:

1. New registration
2. Confirmation email received
3. Confirmation link opened
4. Account verified
5. User redirected correctly
6. Login succeeds
7. Expired-link recovery
8. Resend confirmation
9. Forgotten-password request
10. Password successfully reset
11. Login with new password
12. Session recovery after application restart

Fix the account page so that authenticated users do not see misleading prompts such as "Link Supabase Auth" when their account is already correctly linked.

Simplify technical authentication language for ordinary customers.

### D. Required proof

Provide actual test results for two controlled accounts and two email inboxes, including:

- Sending success/failure
- Delivery evidence
- Confirmation link behaviour
- Recovery link behaviour
- Expired-link handling
- Desktop and mobile rendering
- Appropriate error messages

Redact addresses and tokens in reports.

If real inbox verification cannot be completed, mark email delivery UNVERIFIED or BLOCKED, not DEPLOYED.

**Do not proceed to the next phase until Phase 0 has a tested implementation or clearly documented external blockers.**

---

# PHASE 1 — REMOVE FALSE SUCCESS AND REPAIR CHALE'S MOBILE INTERFACE

## A. Eliminate misleading completion messages

Inspect the main Bag checkout handler in `src/modules/App.tsx` and related services.

The current "Sandbox order created" behaviour must not be presented as a real completed purchase.

Implement an authorised server-backed checkout/order workflow where the necessary services are available.

Ensure:

- A valid order is persisted
- Items, totals and customer references are correct
- Stock and fulfilment states are handled honestly
- Repeated submissions do not accidentally create duplicate orders
- Payment status is independently verified
- The basket is cleared only at the correct point
- Failed requests retain the basket and display useful errors

If payment or commerce integration is not ready, use an honest unavailable/pending state instead of fake checkout success.

Inspect other pillars for similar misleading success messages.

## B. Fix the Ask Chale AI launcher

The Chale button must never obstruct:

- Form fields
- Submit buttons
- Checkout actions
- Navigation controls
- Keyboard input
- Important mobile content

Implement a professional floating assistant launcher with the following behaviour:

1. Chale can expand into a usable assistant panel.
2. Users can minimise Chale to a compact edge tab.
3. The compact tab remains discoverable and accessible.
4. Users can move the launcher between safe screen positions where practical.
5. The interface respects safe areas, bottom navigation and the mobile keyboard.
6. Users can restore Chale with one tap.
7. The launcher does not block taps on unrelated controls.
8. Position and visibility preferences persist appropriately.
9. Reduced-motion and screen-reader accessibility are respected.
10. The assistant must not disappear permanently without a clear way to restore it.

For a transparent appearance, use an explicit user-selected reduced-visual-prominence mode. Do not create invisible touch targets that intercept user actions.

## C. Add Chale controls under Settings

Create an "Ask Chale AI" settings section containing:

- Show floating assistant
- Minimise automatically
- Floating button position
- Compact appearance
- Restore default position
- Accessibility preferences where supported

When the floating launcher is disabled, provide another discoverable route to open Chale through normal app navigation.

## D. Mobile UI repairs

Fix the oversized Gaming icon.

Inspect important forms for keyboard overlap, button obstruction, touch-target sizes, contrast and loading behaviour.

Remove internal development/setup terminology from customer-facing screens.

Test on representative narrow-screen phones and low-bandwidth conditions.

---

# PHASE 2 — MAKE THE RECOMMENDATION ALGORITHM GENUINELY FUNCTIONAL

The present topic-ranking implementation is insufficient if the activity it depends on is saved only on the user's device.

The goal is genuine, permission-aware recommendations across eligible EcoVibes content and pillars.

## A. Audit the current algorithm

Trace:

- Recommendation entry points
- Ranking functions
- Data sources
- Feed publishing
- Local storage usage
- Likes and reactions
- Saves
- Follows
- Search activity
- Comments
- Clicks
- Booking and service activity
- Content visibility and eligibility

Identify disconnected functions and local-only data.

Explain what currently works and what does not.

## B. Establish reliable shared activity records

Where appropriate, create or complete the existing server-backed records for:

- Published content
- Likes and reactions
- Saves
- Comments
- Follows
- Content views and engagement
- Search interactions
- User-selected interests
- "Show less" feedback
- Eligible service and marketplace activity

Use clear ownership, timestamps, stable identifiers and access policies.

Respect consent, privacy, organisation boundaries and moderation rules.

Do not recommend private content to unauthorised users.

Implement idempotency and retry behaviour where appropriate.

## C. Implement a working recommendation pipeline

The algorithm should consider, where legitimately available:

1. Declared interests
2. Relevant topics
3. Recent authorised engagement
4. Fresh eligible content
5. Content quality and moderation state
6. User feedback
7. Diversity between topics and creators
8. New-user discovery
9. Appropriate geographic relevance
10. Repetition and fatigue controls

Avoid creating separate inconsistent recommendation engines for each pillar.

Use a maintainable shared ranking approach with pillar-specific eligibility rules.

Implement a sensible cold-start experience for users who have little or no activity.

Provide a functional "Show less like this" control with persistent feedback.

Respect blocked users and muted content.

Avoid allowing one highly active creator or topic to dominate every feed.

## D. Make recommendations measurable

Create reliable, privacy-aware measurements for:

- Eligible impressions
- Meaningful clicks
- Saves
- "Show less" responses
- Content diversity
- Repeat recommendations
- Freshness
- Downstream useful actions

Use authentic recorded events only.

Provide a diagnostic method showing why an authorised item was recommended without exposing other users' private data.

## E. Verify with real multi-account scenarios

Create controlled test scenarios with distinct user interests.

Verify that:

- Publishing on one device is visible to another authorised account
- Reactions persist across sessions
- Recommendations respond appropriately to interests and activity
- New users receive useful suggestions
- "Show less" has a measurable effect
- Private and blocked content never leaks
- Recommendations do not disappear when local storage is cleared

Report the precise ranking inputs, test results and outstanding limitations.

---

# PHASE 3 — MAKE CHALE AI MORE USEFUL AND TRUSTWORTHY

Investigate the existing Chale implementation before replacing anything.

Improve:

- Answer relevance
- Follow-up conversation context
- Intent handling
- App navigation assistance
- Weather requests
- Local restaurant questions
- Music requests
- Search and retrieval
- Current-news questions
- Helpful explanations of EcoVibes services
- Responsible handling of unavailable information

Distinguish clearly between:

- General knowledge
- EcoVibes application guidance
- Current information requiring external verification
- Private information requiring authorised tool access

Avoid invented weather forecasts, businesses, headlines, availability or account details.

Provide citations or appropriate source attribution when fresh external information is used.

Handle tool failures, stale information, timeouts and quota limits gracefully.

Review the message "Learning paused." It must explain the actual restriction accurately and must not imply that Chale has forgotten its general knowledge.

Add quality tests covering multi-turn conversations, factual accuracy, privacy, tool failures and response usefulness.

---

# PHASE 4 — REAL COMMUNICATION AND NOTIFICATIONS

Complete and test the existing friendship and messaging journeys.

Required acceptance scenarios:

1. Two real accounts register and authenticate.
2. Account A sends a friend request.
3. Account B receives and accepts it.
4. Both accounts see the updated relationship.
5. Messages are exchanged in both directions.
6. Unread counts update correctly.
7. Closing and reopening the application preserves conversation state.
8. Disconnection and reconnection recover missing messages.
9. Blocking prevents unauthorised interaction.
10. Background notification delivery is tested on supported devices.

Notifications must reflect durable server state, not only temporary screen refreshes.

For voice and video calls, first identify the required EcoVibes-owned media infrastructure, consent design, permissions and provisioning costs.

Keep calls unavailable until hosting, incoming-call delivery, revocation and two-device testing have passed.

Never represent an unprovisioned calling feature as working.

---

# PHASE 5 — GPS, WASTE OPERATIONS AND SERVICE JOURNEYS

After the higher-priority repairs are verified, implement the next functional journeys.

### EcoMaps

- Genuine location permissions
- Authorised collector location updates
- Customer tracking of relevant collections only
- Routing and location freshness indicators
- Clear handling of denied permissions
- Stale-location warnings
- Reliable 2D/list fallback
- Appropriate mobile and web location policies

### Waste-to-Money

- Material-specific records
- Verified collectors and facilities
- Accurate collection status
- Weighing evidence
- Handover history
- Disputes
- Payout tracking and reconciliation

### Quick & Handi

- Booking
- Provider acceptance and assignment
- Communication
- Completion evidence
- Customer confirmation
- Disputes
- Correct payment outcome
- Review eligibility

Use genuine server states and verified evidence throughout.

Do not introduce spendable balances or enable payouts before reconciliation is verified.

---

# PHASE 6 — SECURITY, OPERATIONS AND PARTNER READINESS

Complete the remaining operational work through separately scoped tasks:

- Account and organisation isolation
- Row-level security verification
- Storage permissions
- Leaked-password protection warning
- Staff MFA
- Scoped partner access
- Moderation and review queues
- Backup and restoration tests
- Monitoring and error reporting
- Performance testing
- Low-data mobile testing
- Real Shopify integration verification
- Payment and refund reconciliation

Maintain truthful status reporting for language support, jobs, learning content, games and other unfinished pillars.

Do not expand these features before the core journeys are reliable.

---

# REQUIRED EXECUTION PROCESS

Before modifying code:

1. Inspect the repository and working tree.
2. Identify current architecture, dependencies and live integrations.
3. Locate the relevant functions and database objects.
4. Reproduce the reported failures where possible.
5. Identify risks and missing external requirements.
6. Produce a concise execution plan with file-level scope.
7. Start with Phase 0.

Implement one coherent phase at a time.

For each phase:

- Make minimal, maintainable changes.
- Update database migrations and access policies when necessary.
- Add automated regression and integration tests.
- Run available linting, type checks, build and tests.
- Test representative failure conditions.
- Report any tests that could not run.
- Verify real services and multiple accounts when credentials and environment access permit.
- Preserve unrelated work and user data.
- Review security implications.
- Produce a clear completion report before continuing.

Do not automatically deploy, alter production DNS, provision paid infrastructure or execute real financial operations without authorisation.

If a phase depends on an unavailable service or credential, complete safe preparatory work and document the blocker.

# REQUIRED ACCEPTANCE REPORT

For each capability, report:

| Capability | Previous problem | Changes made | Test evidence | Current status | Remaining blocker |
|---|---|---|---|---|---|

Also provide:

- Exact files changed
- Database migrations created
- Tests added
- Tests run and results
- Build results
- External configuration still required
- Security considerations
- Real-device or two-account test results
- Deployment state
- Recommended next action

Evidence must distinguish mocked tests, local integration tests and genuine hosted end-to-end verification.

Consolidate the progress dashboard into one authoritative current status per capability. Remove or clearly archive superseded status tables so that older information cannot be mistaken for current truth.

# START NOW

Begin with a repository and environment audit focused on:

1. Email sending and Supabase confirmation/recovery configuration
2. Authentication onboarding consistency
3. Bag checkout false success
4. Chale floating launcher and Settings integration
5. Recommendation algorithm and shared activity dependencies

Present the findings and implementation plan, then implement **Phase 0: Email Delivery and Account Trust** first.

Do not attempt to build every phase in one large change.

Proceed through the remaining phases only after their predecessors are sufficiently verified and the next scope is agreed.

The definition of success is simple:

**EcoVibes must perform the action it promises, preserve the correct shared state, communicate errors honestly and demonstrate that the complete journey works for real users.**