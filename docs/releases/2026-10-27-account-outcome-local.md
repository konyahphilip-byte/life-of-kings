# Phase 0 account-trust repair and environment audit - 27 October 2026

Status: **LOCALLY BUILT**, branch `codex/account-logout-outcome-20261027`, base d415f6c38b870df7979eb5a41e4347911fa52687. This dated acceptance snapshot supports the [single current dashboard](../partner-readiness/README.md); it is not a second current status report. Phase 0 as a whole remains BLOCKED/UNVERIFIED.

The newly supplied 522-line brief matches the canonical October 27 directive exactly (SHA256 2a0e40188801d8958566b3b99aaf4dc6c845530b26e017d765ea26b5bf00e278). The additional platform requirements remain queued; Games/unrelated expansion remain paused. Findings and a bounded file plan were presented before implementation. No later phase was implemented.

## Acceptance snapshot

| Capability | Previous problem | Changes made | Test evidence | Current status | Remaining blocker |
|---|---|---|---|---|---|
| Recovery sign-out outcome | A failed/lost acknowledgement permitted a new global request that could affect a later sign-in | Captured operation becomes terminal-unconfirmed on non-ACK/transport failure, disposes authorization, blocks redispatch; overlap sharing/ACK no-op retained | Lost-response RED; native synthetic 2 attempts → 1 request, 2 failures, unconfirmed=true, authorization disposed; automated cases below | LOCALLY BUILT | Actual provider outcome/all-session revocation remains unconfirmed; not provider-global idempotency |
| Recovery screen/remount | Retry remained offered after uncertainty; an old handler's late failure could leave the remounted view stale | Honest password-save versus sign-out states, no Finish action for unconfirmed outcome, Back to sign in; identity-bound once-only revision notifies current view | Deferred failure/remount RED then regression passes; A-to-B switch, no password re-save, callback notification/stale-result checks | LOCALLY BUILT | Actual ownership/session-aware browser removal and real Auth/device acceptance |
| Confirmation/recovery delivery | Built-in sender restrictions and vague default emails | Read-only audit confirms SMTP disabled/default-template editing lock; no unsupported delivery claim or configuration replacement | Fresh Supabase UI; 0 real emails / 0 real inbox journeys in this increment | BLOCKED | Approved owned sender/domain, SMTP, SPF/DKIM/DMARC, required credential workflow, two inboxes |
| Branded emails | Default templates lack requested branding/content | Existing HTML/text/subjects remain prepared; expiry rechecked at 3600 seconds | Configuration/subjects inspected; fresh actual expiry matches local one-hour copy; earlier preview is historical, not MIME/inbox evidence | LOCALLY BUILT | SMTP/template installation, actual outgoing MIME and mobile-email verification |
| Complete account journey | Local callbacks/guards do not prove real registration/recovery/session trust | New guard included with earlier scoped repairs; no private Auth rows or confirmation weakening | 483 local tests; no fresh genuine two-account/inbox/device flow | UNVERIFIED | Browser removal, actual provider AMR/session/clock, policy/rollout/rollback/CI and real Auth/inboxes |
| Main Bag checkout | Local cart cleared without a server order despite preview wording | No Phase 1 code change; failure located in App.tsx checkout | Source inspection; no order seeded and no financial operation | MISSING | Approved bounded Phase 1 server-backed or honest unavailable-state repair |
| Chale launcher/Settings | Fixed launcher can overlap content; requested controls missing | Audited and queued; no image/game expansion | Source inspection and prior phone screenshots only | MISSING | Separate agreed Phase 1 launcher/settings/mobile scope |
| Shared recommendations | Server jobs/products ranking exists, while posts/reactions stay on device | Located authenticated ranking/feedback routes and local publishing boundary; no fictional activity or metrics | Source inspection only; no multi-account recommendation acceptance | UNVERIFIED | Shared authorised activity and measured eligibility/privacy pipeline in agreed later phase |

## Fresh read-only environment evidence

- Render still reports existing service ecovibes-api, live deploy dep-dbg4e7142hec73difkjg at source 26c1b5555ac7fc0ff6950ece10eb6a19c37e235a. Free instance/Frankfurt/one instance/autodeploy off remain. This verifies provider-reported source/state, not a new workload, authenticated or sustained monitoring pass.
- Supabase custom SMTP toggle is off. Template page says default subjects/bodies are used and editing requires custom SMTP. This explains the unchanged generic email presentation; actual new delivery was not attempted.
- Site URL is https://ecovibes-api.onrender.com. Exactly two allowed redirects remain: that root and https://ecovibes-api.onrender.com/?recovery=1. No URL was added or changed.
- Email authentication and email confirmation are on. Email OTP/link expiry is 3600 seconds. Secure email change is on; secure password change and require-current-password are off and require separate policy/real-flow review. No authentication settings changed.
- The security advisor still reports leaked-password protection disabled. The dashboard identifies it as plan-restricted; no upgrade or workaround was enabled. [Remediation guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Minimum-password-length value was redacted by the tool and was not read or bypassed. No private Users page, named Auth linkage, credential field or real inbox was inspected.
- Sending-domain ownership and SPF/DKIM/DMARC remain UNVERIFIED. No domain purchase, DNS, SMTP token/password or new provider was configured. Required aws-secrets-manager credential workflow remains unavailable.
- Main Bag, Chale and ranking/publishing inspection used the isolated source. App.tsx has earlier local callback-routing changes, but its checkout/local-post logic is unchanged from deployed 26c1b555; Sidekick/Recommendations/ranking files are unchanged.

## Exact source scope and behavior

Changed product files:

- `src/lib/recovery-operation.ts`
- `src/lib/recovery-operation.test.ts`
- `src/lib/auth-callback.ts`
- `src/lib/auth-callback.test.ts`
- `src/modules/backend/BackendWorkspace.tsx`
- `src/modules/backend/BackendWorkspace.auth.test.tsx`

The initial four-file plan was explicitly extended for the reviewed remount issue. The callback publishes a monotonic revision only for the same active operation in saved phase with a terminal unconfirmed outcome; duplicate/stale/cleared notifications are ignored. Password save remains confirmed and cannot be resubmitted. No mutable SDK sign-out, private SDK field, shared-storage deletion, new credential persistence or new actor selector was added.

Documentation: this receipt, continuation, authoritative dashboard and existing primary sprint tracker. Database migrations created/applied: **none in this increment**. Parent 20261027121500_identity_auth_revocations.sql remains unapplied. No server/dependency/provider configuration change.

## Tests, build and preserved failures

- Final focused 46/46 across 4 files: lost ACK, non-ACK 302/401/403/429/500/503, pending concurrency, disposed authority, callback identity/notification/clear, installed-SDK browser retention, UI remount/account switch/explicit exit.
- Final full 483/483 across 36 files, 105.34 seconds. All six final source hashes matched before/after this run.
- TypeScript and Vite build pass; 1672 modules. Existing Communications large-chunk warning remains.
- Native operation probe uses synthetic deferred/lost-response fetch only. Real-provider/all-session revocation is not inferred.
- Independent read-only source and final evidence review: no remaining Critical/Important/Minor findings in this bounded increment.
- Lost-response RED 0/1 retained. Initial focused 37/37 was before remount review repair. Remount RED 0/1 retained. A pre-repair full run was stopped with exit 143 as superseded; its artifacts are retained and provide no complete/green result.
- Older 503 retry tests were deliberately strengthened to forbid later dispatch under the new safety policy. This is a behavior change, not assertion weakening. No deadline, worker or isolation relaxation.
- Earlier 470/471/full message timeout, 24/1 and 23/2 focused timeouts remain historical. Current 483/483 does not explain their cause or establish sustained stability; QA-001 remains UNVERIFIED.
- Initial audit searches encountered obsolete filenames/glob expansion before actual App/Recommendations/template paths were located. Browser native-app inventory failed, but IAB read-only access worked; no access bypass or credential fallback.
- 145 protected primary source/assets remain unchanged. No dirty primary source or old job-call/message WIP was published.

Evidence directory: primary `work/account-logout-outcome-20261027/` audit.json, lost-response-red.json/log, focused-initial.json/log, remount-red.json/log, superseded-* artifacts, focused-final.json/log, source-before-final-full.json, full-final.json/log, typecheck.log, build.log, probe-final.json, checks.json and root-preservation.json.

## Deployment, security and next action

This candidate is not published, in CI, merged or deployed. No real two-account/inbox/low-end-device journey was performed. No email sent or paid/financial/DNS/infrastructure action occurred.

Stopping redispatch preserves uncertainty; it does not prove the original global request completed, stop a server request already processing, or guarantee existing issued provider access tokens are revoked. Ownership/session-aware actual browser removal, genuine provider/Auth behavior and auth-policy review remain required. The earlier independent session snapshot check is not storage removal.

Before deployment require exact-source CI (including PostgreSQL), reviewed compatible production migration/marker, actual Auth acceptance and guard-preserving rollout/rollback. A rollback must retain the app-session barriers and the no-redispatch safety behavior; old 26c1b555/cf9 ignores barriers after state exists. No production restore drill.

The external Phase 0 action is an approved, verified sending domain and transactional SMTP setup, using a supported private credential workflow, followed by template installation and two-inbox confirmation/recovery/expiry/new-password/restart/mobile verification. Do not purchase, change DNS, replace credentials, weaken confirmation or repeatedly send emails without the appropriate approval/setup. Internal demo, Ghana pilot and public launch remain separate incomplete gates.
