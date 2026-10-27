# Accepted-friend private text messaging candidate

The hosted Messages page currently cannot send direct messages. This candidate adds text conversations between two active accounts with an accepted, unblocked friendship, using the existing EcoVibes API and database. It does not enable voice/video or LiveKit.

## Behavior

- Sign in, open Messages, choose a recent friend or find an accepted friend by exact EcoVibes ID, and send text. Only accepted friends appear; pending requests grant no message access.
- Each read, send and retry rechecks both active accounts and the current friendship under the same stable account/relationship lock order as block/remove operations. The sender comes from the authenticated session. Forged actor fields, unrelated accounts, stale revisions and invalid selectors are rejected.
- Up to 2,000 characters per message, 20 send attempts/minute/account, bounded 50-message cursor pages and a 120-request/minute/account read ceiling. Duplicate client references return the immutable original message only for the same sender/pair/revision/text.
- Responses carry the server-derived account ID; the inbox verifies it before publishing a response. Account changes/unmount abort reads and writes and discard account-scoped state. No message content is persisted in browser storage, sent to Chale, included in public discovery or written into audit details.
- A block/remove stops subsequent reads, sends and cached retries. Re-adding a friend starts a different consent revision and does not reveal the former revision's message history. Retained database rows are not a user-facing deletion or export feature.
- The open conversation checks for incoming text about five seconds after each successful read completes; the friend roster checks about every 15 seconds. Hidden/offline pages pause; foreground/reconnect/explicit refresh resumes. Requests have ten-second deadlines; transient failures back off. These are foreground checks, not instant push or background delivery.
- Temporary roster failures hide history and disable sending while preserving a draft and an uncertain send's reference. Account mismatch, authentication failure or confirmed consent revocation clears the conversation. Explicit retries reuse the original reference; no automatic write retry or delivery/read receipt is claimed. Retry acknowledgements keep sequence order.

## Local evidence

Pinned Node26.12.1: 426 tests across31 files, 33 focused tests, TypeScript and Vite build1,669 passed. All eight isolated local workflow scripts passed, including11 actual HTTP/SQLite messaging checks using synthetic accounts. Dependency security probes passed; existing Communications bundle-size warning remains.

The exact additive migration and runtime module passed67 checks on disposable PostgreSQL17, including RLS/role denials, runtime sequence access, concurrent duplicate retries, queued send versus block locking, account privacy, consent revisions and local rollback. The fixture was stopped and removed; no hosted account, credential or production message was inspected or seeded.

Retained failures: initial test fixture startup rejected its incomplete environment; the subsequent HTTP RED confirmed the missing route. UI REDs established absent messaging, a slow-send/foreground race and review findings. A fake-clock setup correction established the intended polling window. A POST response mock missing the new account field caused two later test failures; correcting the fixture restored the real response contract. Those reports remain separate from passes. Historical QA-001 is undiagnosed and no timeout/assertion/worker/isolation relaxation is part of this change.

## Release gates

This receipt records a candidate, not hosted or physical-device acceptance. Require final independent review, exact candidate/main CI, then apply the exact reviewed migration and verify metadata before deploying to the existing approved service. Check hosted artifact identity, private401/no-store behavior and actual accepted-friend accounts. Two phones, reconnect/slow network, background notifications and real call-media acceptance remain separate.

Migration: `20261027070000_connect_direct_messages.sql`. Messages have RLS, no direct access for anon/authenticated/service_role, and API-runtime SELECT/INSERT only plus identity-sequence USAGE. Existing friendship permissions remain unchanged. If the schema marker is absent, only the new message namespace fails closed with503.

Application rollback is prior main7ad983c6. Retain the additive messages table, sequence, consent and block data; do not discard conversations during rollback. The disposable schema rollback is not a production restore drill.

No paid service, new hosting, provider keys, authentication-setting change, real money, call media, GPS, email or private-conversation training is included. The primary dirty workspace is excluded. Connect, complete partner demonstration, Ghana pilot and public launch remain incomplete.
