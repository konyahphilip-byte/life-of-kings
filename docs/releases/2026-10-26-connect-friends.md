# Connect friend requests: bounded release preparation

The founder's phone screenshot confirms one hosted lookup found @akonyah and exposed only Select. The new request is an Add friend option. This slice adds persisted, consensual friendship without enabling voice/video or sending a call.

## Functionality

- Search results in Explore and Calls & Live expose Add friend and state-specific controls.
- Calls & Live has Friends & requests: incoming, accepted, sent and blocked requests, explicit refresh and refresh on returning to the page/going online. This is saved foreground data, not push/realtime incoming delivery.
- Only a recipient can accept/decline; sender can cancel; either accepted friend can remove. Crossing requests does not automatically accept.
- Requests expire after seven days. Closed relationships have a 24-hour repeat-request cooldown. Writes have per-account limits and revision conflict checks.
- Independent request blocks in either direction revoke friendship; unblock never restores it. These block controls concern this connection/request feature, not hiding every public post across EcoVibes.
- Only authenticated API context selects the actor. CSRF/origin, exact body keys, active accounts, stable PostgreSQL locks, public peer fields and late-result/account isolation are enforced. No private authentication rows are queried.
- Request/acceptance notices and relationship events commit with the state change. Decline does not send a separate notice. No phone number is exchanged.

## Source and tests at preparation

Implementation is isolated on current main d19376cb in codex/connect-friends-20261026; dirty primary work is excluded. Files: server/people-friends.mjs and .test.mjs; server/index.mjs; scripts/test-chale-workflow.mjs; src/modules/connect/FriendsPanel.tsx and .test.tsx; PeopleLookup.tsx; people-lookup.css; Communications.tsx; App.tsx; the additive migration; this receipt.

Two initial test runs collected zero tests because the sandbox denied temporary directories. After proper permission, real server RED1pass/11fail became12pass; UI RED1pass/5fail became the combined focused23pass. Full pre-review regression396tests/29files passed. A Minor stale-error display was reproduced6pass/1fail, fixed and seven UI tests passed. TypeScript, build1668 and dependency security probes passed. Existing historical QA-001 remains undiagnosed; these passes do not establish its cause.

Actual isolated HTTP/SQLite workflow35 checks passed, including synthetic independent sessions, CSRF/origin/selector denial, saved recipient request and one notification, consent/revision/outsider denial, accepted friends on both sides, removal, cooldown, blocking/unblock and cancellation. Chale inference in this workflow is mocked; no real provider, hosted accounts or call is tested.

Actual disposable PostgreSQL17 migration/runtime/concurrency34 checks passed: RLS/direct browser-role denial, restricted API runtime without DELETE/TRUNCATE, simultaneous opposite requests producing one pending request, recipient acceptance observed by the other client, independent blocks, stale writes, transactional notices/events and retained-table rollback behavior. Exact three backend/migration hashes and scope are in work/connect-friends-20261026/postgres.json in the primary workspace. Fixture used only synthetic data, a private0700 Unix socket, no TCP/outbound credentials, and was stopped/removed. This is not full hosted HTTP or physical-device acceptance.

Final independent source review found no remaining Critical/Important/Minor. Fresh exact candidate/main CI, hosted migration, deployment and actual hosted checks are release gates at this preparation cutoff, not already asserted here.

## Database and rollback

20261026233442_connect_friend_requests.sql adds one API-only people_friendships table and schema marker. RLS is enabled; all privileges revoked from PUBLIC/anon/authenticated/service_role; only the existing trusted ecovibes_api_runtime gets SELECT/INSERT/UPDATE policies. No new credential, auth access setting, role membership, private-record read or provider configuration.

The prior app d19376cb ignores the new table and remains a compatible application rollback. Retain friendship/block records on rollback; dropping them would discard consent and is not the production rollback. Only a local schema-removal transaction was rolled back; no production drill.

## Explicit remaining gates

Voice/video stays unavailable/privateCallsConfigured:false. This does not provision owned media, issue tokens, grant access to private jobs/messages, enable media publication, record calls or connect Chale to media. Owned TLS/TURN capacity, relationship-based admission, per-call recipient/video consent, strict revocation, genuine incoming calling/messaging, two authenticated phones and slow-network tests remain required. Hosted member friendship/privacy and layout/device tests remain separate from local success. AWS CloudShell verification/access limits, full Chale/GPS/Waste/email/shared safeguards and demo/pilot/public-launch gates remain open. No paid resource or public-launch activation is authorized by this slice.
