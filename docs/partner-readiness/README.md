# EcoVibes capability and readiness dashboard

Authoritative current report - 27 October 2026. Earlier dated reports are [archived](2026-10-27-before-consolidation.md); they are historical evidence, not additional current status tables.

The founder's [latest repair directive](../directives/2026-10-27-priority-repair.md) supersedes the earlier calling-first queue. Deliver one tested increment at a time. Keep Games and unrelated expansion paused. Status vocabulary: **DEPLOYED**, **LOCALLY BUILT**, **UNVERIFIED**, **BLOCKED**, **MISSING**.

## Current capabilities

| Capability | Status | Evidence, limits and next acceptance step |
| --- | --- | --- |
| Existing hosted application | DEPLOYED | PR23 main26c1b555 / dep-dbg4e7142hec73difkjg. Exact CI40461841237/40462094116,426 tests, build1669 and bounded anonymous guards. Free/Frankfurt/one instance/autodeploy off. No new Auth candidate is hosted. |
| Dependency remediation | DEPLOYED | PR10 fix retained; pinned Node26.12.1/Vite8.3.5/Undici8.12.2 built-in. Previous exact CI audit0 is bounded evidence, not complete app security certification. |
| Exact hosted recovery redirect | DEPLOYED | Founder approved https://ecovibes-api.onrender.com/?recovery=1; added and re-read beside the existing root redirect. Confirmation and3600-second expiry unchanged. This does not prove delivery. |
| Public confirmation/recovery delivery | BLOCKED | Dashboard confirms missing custom SMTP; default sender restrictions remain. Owned domain, approved sender, SPF/DKIM/DMARC and required credential workflow are not configured/verified. No real email sent in this increment. |
| Branded confirmation/reset templates | LOCALLY BUILT | HTML plus prepared plain-text alternatives; recognisable wordmark, buttons, latest-link guidance and verified one-hour expiry. Hosted dashboard locks editing until SMTP exists. Browser390/600px panes inspected; actual MIME/email-client/mobile-inbox rendering unverified. |
| Resend, callback and recovery repair | LOCALLY BUILT | Separate branch codex/account-email-repair-20261027; confirmation resend, honest request acknowledgements/cooldown, provider-event proof, captured token-bound mutation and cleanup-only retries. Linked-state boolean and old linked-password retirement.451 tests/33 files, TypeScript/build1671,47 identity HTTP and15 recovery HTTP checks. Bounded review findings resolved; full revocation gate remains. |
| App-session recovery revocation | LOCALLY BUILT | New codex/account-auth-revocation-20261027 barrier: primary-auth/session proof, shared user-row transaction locks, post-commit admission cookie, immutable retries, no bearer-cleanup cookie header. Full463/35, final focused32/4, HTTP30+15, PostgreSQL17.10/67, TypeScript/build1671; independent review resolved findings. Proposed migration unapplied; no CI/hosted acceptance. |
| Complete recovery/security journey | UNVERIFIED | Browser storage clearing, provider-global-logout response-loss retries, actual provider primary-auth behavior, guard-preserving rollout/rollback and exact CI remain open. Two real inboxes/accounts, PKCE/expiry/new-password/restart/mobile acceptance still required. Local barrier is not full recovery or hosted evidence. |
| Main Bag checkout | MISSING | App.tsx still displays sandbox-order wording and clears a local basket without creating an authorised server order. Replace with genuine checkout or honest unavailable state; do not seed orders/payments. |
| Cross-pillar false-success/security acceptance | UNVERIFIED | Review every mutation for durable acknowledgment, retries and account/organisation boundaries. Retain historical QA-001 timeouts and all failed reports. |
| Chale mobile launcher/settings repair | MISSING | Phone screenshots show overlap; safe compact/movable positions, keyboard behaviour, settings and discoverable restore route are queued after Phase0/security. No new Gaming implementation. |
| Shared social publishing/activity | MISSING | Main social posts remain device-local; build authorised server publishing/activity before relying on them for recommendations. Domain jobs/orders/messages already have their own sources; do not duplicate them. |
| Functional measured recommendations | UNVERIFIED | Existing topic ranking/eligible domain discovery is narrower than shared platform activity. Need genuine publish/interaction inputs, eligibility, feedback/opt-out and measured usefulness without invented counts. |
| Chale greetings,40/day allowance and dated app updates | DEPLOYED | Prior exact releases retained; bounded real Cloudflare replies and app-update routing evidence. Free-only, no paid fallback; guest allowance is network-shared. These facts do not prove all answer quality. |
| Chale private tools/answer quality | UNVERIFIED | Nonempty own records, two-account isolation, catalog/provider-failure/quota and weather/restaurant/music source-grounded evaluations remain. No training on private conversations. |
| Fresh news/trending sources | BLOCKED | Previous source adapter unavailable/newsAccepted=false. No fabricated current facts, popularity or static Home metrics. Paid X/unverified TikTok sourcing not activated. |
| Accepted-friend text implementation | DEPLOYED | PR23 saved private text, cursor history/current-consent/block/owner checks and immutable retries.5s foreground polling,15s roster; not push/background or delivery/read receipts. |
| Two-phone messages/notifications | UNVERIFIED | Screens prove Philip signed in and a pending request to Akonyah, not recipient acceptance/both Friends or a message round-trip. Existing handoff remains; do not repeat login/password setup. |
| EcoVibes-operated voice/video | BLOCKED | No owned TLS/media/TURN server provisioned. Calls remain disabled. Hostinger VPS is being evaluated, not purchased or tested. Consent, admission, strict revocation, data modes, two-phone/slow-network acceptance required. |
| Genuine collector GPS/live3D/routes/2D fallback | MISSING | No real-device publisher/customer subscription/map-route acceptance. Preserve permissions and do not use simulated movement as proof. |
| Complete Waste-to-Money journey | UNVERIFIED | Existing job-backed requests/provider forms are visible. Verified weighing/evidence, actual collection/dispatch, payout-state/dispute and real GPS journeys remain incomplete. No real-money activation. |
| My EcoVibes Activity | MISSING | Queued authorised projection of stable existing domain identifiers/status/history/next actions. No competing ledger or fictional/private cross-account records. |
| Platform low-data/recovery | UNVERIFIED | Reuse existing saver modes and message retry/draft behaviour. Broader form drafts, pagination/offline indicators and duplicate protection still need acceptance. Never claim completion without server confirmation. |
| Trust/Safety Centre | MISSING | Existing verification/domain permission services must be reused; only genuine verified records may create badges. Clear location/payment/refund/block/privacy explanations remain queued. |
| Customer support case journey | UNVERIFIED | Existing report/staff routes are narrower than case references, owner status/error IDs and resolution history. No live-support or response-time promise. |
| Verified environmental impact | MISSING | Derive only from evidenced material measurements; distinguish estimate, user report, collector and facility verification. No unsupported carbon/impact claims. |
| Shared launch safeguards | UNVERIFIED | Full staff/MFA/org isolation, storage access, monitoring, backup restoration and merchant/payment/refund journeys remain open. No restore drill or launch certification implied. |
| Internal partner demonstration | UNVERIFIED | Rehearsal must use isolated controlled data and an honest feature boundary sheet. Integration interfaces and two-account journeys still needed. |
| Ghana pilot | BLOCKED | Requires the relevant account, shared-journey, media/GPS, support and safeguard gates above. |
| Public launch | BLOCKED | No public-launch authorisation or complete acceptance evidence. |

## Delivery order

1. Email delivery and account recovery.
2. False-success and critical security repairs.
3. Chale mobile launcher and settings.
4. Shared publishing and activity records.
5. Functional, measurable recommendations.
6. Chale answer quality.
7. Messaging reliability and notifications.
8. Real GPS and Waste-to-Money journeys.
9. Unified Activity Centre and low-data improvements.
10. Trust Centre, support and verified impact.

Each increment needs a bounded exact-file plan, tests and preserved failures, applicable hosted/real-device acceptance, account/org isolation, truthful network-failure handling, monitoring/disable/rollback notes and an updated row above. Existing services only after scoped independent review/exact CI/schema compatibility. No new resources, paid plans, DNS/credential replacement, purchases or real money without the corresponding approval.

Latest local source/evidence: [account email repair receipt](../releases/2026-10-27-account-email-local.md); primary work/account-email-20261027. Historical hosted source: [PR23 receipt](../releases/2026-10-27-connect-direct-messages.md).
