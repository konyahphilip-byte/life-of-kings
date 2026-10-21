# October 21 - Connect availability release

## Scope

Prepared from published main `425da6ee2943a7db63e1509c1e79fb90990c13bb` (tree `4b96758a4efe5a9416cbe872156848f0bdead409`), preserving unrelated local edits and unpublished Games work.

Messages now explains that the general inbox cannot send or receive messages. The fabricated unread count and false send-success handler are removed. Fictional sample conversations require an explicit preview and have a disabled composer. Open job conversations leads to the existing EcoVibes ID / Quick&Handi workspace, where job participant access remains enforced by the existing API. The shared Chale guide and its fallback regression describe the same availability limits.

Eight application/test files changed:

- `src/modules/App.tsx`
- `src/modules/App.identity.test.tsx`
- `src/modules/connect/ConnectInbox.tsx`
- `src/modules/connect/ConnectInbox.test.tsx`
- `src/modules/connect/connect-inbox.css`
- `shared/chale-app-guide.json`
- `src/modules/assistant/Sidekick.test.tsx`
- `server/chale-ai.test.mjs`

This receipt is the only additional release document. No dependencies, lockfile, migrations, API authorization, hosting configuration, credentials or Games changes are included.

## Fresh isolated verification

On October 21, the candidate built from the published baseline passed:

- 200 unit/component tests across 19 files, with one worker.
- Production TypeScript/Vite build: 1,652 modules. The existing Communications chunk warning remains (about 657 kB before gzip).
- 19 Chale HTTP workflow checks using loopback HTTP, a disposable SQLite database and mocked inference. The fixture reported no application environment loaded, existing database access, real credentials or external network. Its database and child server were removed/stopped.
- Scope/hash checks: exactly the eight source/test changes above; no baseline files deleted; package manifest and lockfile unchanged.

These counts belong to the isolated candidate. They differ from the full dirty checkout's earlier 243-test result because unpublished work is excluded.

## Limits and review steps

This is an availability correction, not a working general inbox or a new chat service. No browser/device or hosted verification of this new screen has been performed at preparation time. It does not establish organization isolation, production AI quality, payment readiness or a completed security review.

After deployment, inspect Messages on desktop and mobile: unavailable notice visible; no unread count or sample composer by default; samples explicitly fictional and read-only; Open job conversations reaches EcoVibes ID / Quick&Handi. Verify authenticated job conversations with authorized test participants separately.

No public launch or live model response is claimed. Chale credential setup and real grounded inference, hosted registration/recovery/revocation, staff MFA/review, cross-account/organization isolation, storage/restore, booking and payment/refund/reconciliation remain launch gates. Preserve the Rumble African approval gates.

## Publication and hosted verification

[PR #3](https://github.com/konyahphilip-byte/life-of-kings/pull/3) published the exact candidate as `ee99ccde435648260a0524490b780c71f46148ff`. Individual uploaded blobs matched local Git hashes; a complete remote tree comparison found the intended nine files and no deletions. The combined content upload had not returned a result and its waiting cell was terminated before any ref update; the subsequent verified blob/tree publication succeeded.

[PR release checks 39681652687](https://github.com/konyahphilip-byte/life-of-kings/actions/runs/39681652687) passed, including unit tests, build and provider/payment/identity/job/support/Chale HTTP workflows. The guarded merge produced main `4e1c5da982010228d2e2d099a621fdf9af64b851`, with the exact verified tree `753cc8ca64ef16c556ea13de9228f982e340b0b9`. [Main release checks 39682004613](https://github.com/konyahphilip-byte/life-of-kings/actions/runs/39682004613) also passed for that exact merge commit.

The existing approved Free Render service `ecovibes-api` deployed that merge as `dep-dbcj7iq9lscs73e2ufh0`, **live at 2026-10-21 21:52:14 UTC**. No plan, environment variable, credential or migration was changed. Auto-deploy remains off. All eight anonymous hosted checks passed, including Postgres health and structured authentication denials. The post-live application error-level log query returned no entries; this is a bounded log check, not an absence-of-all-errors guarantee.

Desktop inspection of the hosted release confirmed the unavailable notice, no sample conversations by default, explicit fictional/read-only samples, disabled sample input/send controls, and the shortcut into the existing authenticated EcoVibes ID / Quick&Handi job workspace. The workspace had no shared jobs; no job, message, booking, provider application or payment was created. Temporary verification tabs and the local preview process were closed/stopped. Mobile/device checks and an actual authorized job-message exchange remain unverified.

Automatic approval review rejected the optional screenshot/deliverable action because the authenticated page could expose account/session context. The action was not retried through another route and no saved screenshot/deliverable is claimed. The prior DOM interaction checks remain the browser evidence.

At 22:26 UTC, the hosted AI status returned the new `2026-10-21-connect-availability` guide version but still `configured: false`, paid fallback false, and member/guest limits 10/1. No real model request was made. Earlier launch gates remain in force; this deployment does not make Chale live or establish launch readiness.
