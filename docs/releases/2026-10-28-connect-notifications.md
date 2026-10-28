# Account alerts and message receipt increment — 28 October 2026

LOCALLY BUILT; no production source/schema/setting change. Based on verified main26c1b555, separately from Auth24/Chale25/Bag26/mobile27. Requires final review/exact CI, owner approval and hosted/device acceptance.

## Actual code

The header bell now reads authorised saved notification records with genuine unread count, empty/error/loading/offline states, explicit mark-read and safe destinations. It refreshes about every15seconds only while foreground/online, with deadline/backoff and account-response validation. No fabricated dot or all-caught-up claim. Private text is not copied to alert previews or browser storage. Existing domain events appear only when their domain service has actually saved a notification; this is not a promise that every platform action already produces one.

New text sends transactionally create one generic recipient notification; identical retries create neither another message nor another notification. Mark-read is idempotent and only updates after server confirmation.

Outgoing ✓ means saved by the server. ✓✓ requires a separate, authenticated recipient-app acknowledgement of received message IDs; a GET alone creates no receipt. Ticks do not mean read. Current accepted relationship/revision/active accounts/blocks, strict batches, CSRF/origin/rate controls and immutable timestamps apply. Recipient acknowledgements are append-only and API-only. A send retry retains an existing receipt.

The app only acknowledges a verified received page while visible/online. Account changes abort/ignore stale results. Review found and fixed separate poll/write and offline-late-result races. No read receipts, lock-screen push, background delivery or call capability is claimed.

Create and Explore were swapped as requested, retaining matching labels/actions. This changes navigation order, not media publishing. New founder profile-photo/banner/synced-count/photo-video requests are recorded for the next increment.

## Exact source scope

server/direct-messages.mjs and test; server/index.mjs; DirectMessages.tsx and test; new NotificationCenter.tsx/test/notifications.css; App.tsx; HTTP script; new reproducible PostgreSQL script and CI step; additive migration20261028220000_connect_message_receipts.sql.

Migration remains UNAPPLIED to Supabase. Marker gating leaves existing text working while receipt admission is unavailable. Old app source can ignore the added receipt table; retain all messages/receipts/notifications on rollback. This does not modify or remove PR24 revocation barriers. No destructive schema rollback is permitted.

## Verification and failures

Initial receipt RED: missing deliveredAt/recipient endpoint. Focused30passed, then34passed with schema-off, privacy, immutable retry, block and race coverage. Latest local full437/439 across32files: all new tests passed; existing App.identity greeting/profile and Communications ID tests hit5-second deadlines. No deadlines/assertions/workers/isolation weakened; QA001 remains undiagnosed. Exact CI is still required.

TypeScript/build1671/dependency-security probes and13 actual local HTTP checks passed. HTTP uses synthetic accounts, loopback API and disposable SQLite; no hosted accounts, payment/provider or real inference.

Disposable PostgreSQL17.10:84 checks passed for exact additive migration/RLS/runtime restrictions, durable recipient acknowledgements and existing concurrency. First68-check run failed because the probe compared two PG Date objects by identity; ISO-value comparison corrected it. The failure remains retained. A generic script records actual server_version; CI uses its existing PostgreSQL16 installation and is a separate gate.

Earlier unused test import TypeScript failure was corrected. Review found no remaining Important/Critical source finding after the two race fixes; minor hardcoded-PG-version evidence wording corrected. Existing Communications bundle warning remains.

Actual local IAB390×844: nav order Home/Create/Explore/Messages/Calls/Profile/ID; notification panel x16–374,width358,top76–247; no horizontal overflow; correct guest sign-in state and close-focus returned to Notifications. Preview API8787 refused connections, so this is guest/local-layout evidence only. No new authenticated hosted, physical receipt, push or read-state acceptance. Screenshot seen inline; no exported file is claimed. Temporary viewport reset and preview stopped.

Evidence: work/connect-notifications-20261028 receipt-red.json, focused*.json, full.json/log, http.log, postgres*.json/log, source-before-full.json, types/build/security logs. Preserve superseded tests and all failed attempts.

## Remaining release gates

Exact candidate CI and source/evidence review; compatible hosted migration and rollback approval; owner merge/deployment approval; two-phone receipt/unread/isolation/reconnect/offline checks after release. Lock-screen push needs its own supported browser/PWA permission/delivery implementation and phone acceptance. Owned voice/video infrastructure/consent/revocation remains blocked separately.

