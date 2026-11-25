# Local recovery sign-out overlap guard - 27 October 2026

Status: **LOCALLY BUILT**, branch `codex/account-logout-concurrency-20261027`, based155a2dff8e1e9be5ae2f20f6f8e6ef047e59ef94. No publication, CI, hosted migration, provider setting or deployment. PR23/main26c1b555 remains the hosted app.

## Implemented and verified

An inline probe of the captured recovery operation using synthetic deferred fetch observed two provider-global sign-out requests from overlapping handlers. This can occur while handlers share the memory-only recovery operation across a remount. The two regression tests reproduced the duplicate requests:0passed/2failed,3skipped.

The operation now assigns one pending promise before dispatch. Overlapping callers share the same underlying request and outcome. An acknowledged success disposes the captured credential; later calls remain no-ops. A failed request releases the pending state while retaining existing bounded retry behavior. Expiry still fails closed before dispatch. There is no shared-session lookup, private SDK call, new credential persistence or API/schema change.

Actual final checks:

-30passed/0failed across3 focused files:5 captured-operation tests,7 installed-SDK/browser checks,18 recovery-screen checks.
-TypeScript passes; Vite build passes with1672modules. Existing Communications large-chunk warning remains.
-Direct native TypeScript operation probe with synthetic deferred fetch now observes1request for overlapping calls plus an acknowledged later call; signedOut=true. No real provider accessed.
-Independent read-only source review: no Critical/Important/Minor findings in the two-file delta.
-Two product source hashes and145 protected primary source/assets verified and preserved.

Evidence: primary `work/account-logout-concurrency-20261027/` concurrency-red.json/log, probe-before.json, probe-final.json, focused.json/log, typecheck.log, build.log, checks.json, source-hashes.json and root-preservation.json. No test deadlines, assertions, worker count or isolation were weakened.

## Limits and release gates

**This is overlap deduplication, not provider-global idempotency.** A sequential retry after a failed or lost response can still send a new global request and may affect a later provider session. That behavior is retained and explicitly tested, not presented as repaired. Safe handling of ambiguous provider outcomes and actual provider acceptance remain required.

The previous155a2dff full run470/471 with an existing DirectMessages5second timeout is historical. Its isolated pass did not establish the cause. That full suite, PostgreSQL and HTTP scripts were not rerun for this two-file delta; QA-001/overall regression acceptance remains OPEN. Exact source CI and a green release gate are still required before publication/deployment is treated as repaired recovery.

Actual ownership/session-aware browser removal remains unfinished; the previous independent snapshot check only refuses false completion. SMTP/domain/sender/required credential workflow/template installation and two real inbox/Auth/mobile confirmation/recovery journeys remain BLOCKED/UNVERIFIED. Do not resend emails repeatedly or weaken confirmation.

Parent server admission barriers and unapplied migration20261027121500 are unchanged. Guard-first reviewed rollout and guard-preserving rollback remain required; old26c1b555/cf9 code ignores barriers and is not a security-compatible rollback after state exists. No production migration or restore drill.

No paid service, purchase, DNS, new hosting, media/GPS/payment change, private Auth data or public launch. Internal demo, Ghana pilot and public launch remain separate incomplete gates.
