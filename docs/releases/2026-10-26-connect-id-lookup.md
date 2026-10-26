# Connect repair: account lookup and calling setup boundaries

This is a bounded source change, not evidence of operational voice/video calls. Release and hosted evidence must be recorded separately in continuation and the partner dashboard.

## Scope

- Authenticated exact public EcoVibes ID lookup, ignoring case and an optional leading @ while preserving dots/underscores. Active non-self profiles only; parameterized query; 30 requests/minute/account; one query parameter; minimal public identity and existing follow flags. No phone numbers, email addresses, auth records or private conversations returned. No new learning/model request.
- Explore and Calls use the same lookup component. An account must explicitly select the returned person. The selection is scoped to its owner; query/account changes invalidate old requests and results. Reset happens before paint, with abort plus generation checks.
- Codec/capture targets follow existing account data settings: Standard720p/24fps/1.2Mbps video and24kbps mono speech; Saver360p/15fps/350kbps and16kbps speech; Extreme audio first/12kbps speech. Adaptive stream/dynacast, speech processing and discontinuous transmission are enabled. These are SDK settings, not total-data limits or measured phone/network quality. Actual private calls remain unavailable.
- Legacy private media creation/join is deliberately closed until the proper consent, relationship, admission and revocation implementation is verified. A private live-room disguise is also rejected; ingress only accepts public live broadcasts; viewers/invitees cannot publish. Adding media credentials alone cannot activate the incomplete private path. Public broadcasts retain their separate source path; no real broadcast acceptance is implied.

No migration, dependency/runtime/CI, secret, paid plan, recording, media hosting or production test-data change. Primary unfinished work and the older job-call/message candidates are excluded.

## Evidence at source preparation

- New lookup regressions initially5fail; first implementation4pass/1existing five-second timeout; unchanged focused lookup/quality10pass. Quality policy initially5fail.
- First full run369pass/9fail of378 across27files: seven identity cases (six five-second timeouts and one missing identity assertion), one account-email five-second timeout, and one new recipient-selection missing-result failure. Isolated recipient follow-up1pass/1five-second timeout. Layout reset guard11pass/1recipient five-second timeout. Cause remains unconfirmed; the pre-paint reset closes a plausible race but does not diagnose QA-001. Assertions/deadlines/workers/isolation unchanged; later region-scoped queries retain the same UI assertions.
- Compilation and Vite build1667modules passed; existing Communications large-chunk warning retained. Dependency security probes passed Node26.12.1/built-inUndici8.12.2/devUndici8.12.3/Vite8.3.5 and eight local HTTP assertions.
- Isolated HTTP attempts stopped before checks at the unchanged15second API-start deadline; do not count them as route passes. Exact-candidate CI must establish the added actual HTTP cases before any release.
- Read-only hosted PostgreSQL query confirms the supplied public IDs are active and the lookup SQL can find the peer. This is not an authenticated HTTP or phone-session pass.
- Independent review found a private-live bypass; source now requires live+public across create/join/ingress and prevents viewer publication. Final source review found no Critical/Important issue for this disabled-calling slice. Owner-scoped selection also addresses its minor finding.

Preserve every failed/interrupted attempt in work/connect-direct-20261026; passing later checks do not establish their cause.

## Founder-owned hosting and remaining gates

Founder rejected a LiveKit Cloud dependency and chose open-source self-hosting. No Cloud account, alternative direct-peer transport or paid service is activated. AWS CLI could not locate credentials. Browser sign-in succeeded; the console reported account verification in progress and blocked CloudShell. EC2 navigation/read timed out and browser inventory later became empty. Existing instances, free credits and a usable server remain unverified. No resources, credential changes, deletions, charges or support contacts were made.

Still required: verified zero-cost/approved server capacity, trusted TLS and media/TURN connectivity, self-hosted admission/revocation (Cloud-only revocation must not be assumed), active relationships/contact consent, accept/decline/end and incoming delivery, server-enforced video upgrade, expiry/block/report/rate limits and reconnect/low-bandwidth handling. Then test real audio/video between two authenticated physical phones and an unauthorized third account. No camera/microphone publication before accepted state and browser permissions. Chale stays outside call media; no recording by default.

Demo, Ghana pilot and public-launch gates remain incomplete. No instruction here authorizes infrastructure spending or a public launch.
