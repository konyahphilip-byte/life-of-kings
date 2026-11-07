# Chale retention repair — 7 November 2026

Status: **LOCALLY BUILT**, branch `codex/chale-retention-20261107`, based on exact combined PR50 local `038f7ce90ebb221f1aa008d87a20d6d5803c19d9`. Commit/source hashes are recorded in primary `work/chale-2-gateway-20261107/retention/checkpoint.json`. No public follow-up, remote CI, hosted migration, merge, enablement or deployment is authorized by this receipt.

The completed PR50 security review covered50 changed source/test/config files in three disjoint groups and source-backed architecture. It found no reportable exploitable issue. An original-module synthetic SQLite probe established that a trusted operator switching history off prevented expired-text purge. Expired API access was already denied, and detailed retention documentation disclosed this operational limitation. The candidate was suppressed as an exploitable finding and retained as a concrete privacy repair.

## Change and user benefit

Expired questions, replies, context and titles are erased at startup/hourly whenever the reviewed history schema is available, including while `CHALE_HISTORY_ENABLED=false`. User-facing history stays unavailable. Unexpired chats and minimal deletion identifiers survive. The existing advisory lock/transaction and final-save reauthorization prevent late enabled-worker replies from restoring purged text. An unavailable schema is skipped without querying missing tables.

Four implementation/test files changed: `server/chale-history.mjs`, its unit test, and the existing HTTP/PostgreSQL history scripts. The history contract and readiness records were updated. No new table, grant, service, timer, model request, permission or fee was introduced.

## Verification

- Original code: unit15passed/2failed of17; actual HTTP restart retained2expired turns; PostgreSQL35 checks passed then disabled purge failed.
- Repaired code:17/17 unit tests;17 actual isolated HTTP groups;40 disposable PostgreSQL17.10 checks using the exact unchanged migration and restricted runtime.
- Full regression655/655 in51 files,80.97seconds, exit0. Fresh per-file isolation, one worker and5second deadlines retained; compiled-code cache only.
- TypeScript/production build1690, audit0, eight existing dependency-security HTTP assertions pass with pinned Node26.12.1/built-in Undici8.12.2/dev Undici8.12.3/Vite8.3.5. System runtime unchanged.
- Independent four-file source review found no issues; final documentation corrected the old feature-off purge caveat. Reviewer executed no tests and did not approve release.
- No new browser/device check: application UI is unchanged. Existing PR50 browser/CI evidence applies only to its earlier exact tree. New source requires fresh remote CI if publication is approved.

Initial worktree/cache/temp writes were denied; authorized escalated reruns proceeded. The first HTTP report save failed ENOENT before its report directory existed; the later genuine red is separately retained. All original failures and historical QA001 remain; green reruns do not establish their cause. Communications' existing large chunk warning remains.

## Release and retention limits

Cleanup requires a running API, available reviewed schema and existing narrow runtime SELECT/DELETE/UPDATE privileges. Offline time delays physical purge; the30day access expiry still applies. Provider retention, backups, exports and minimal tombstone retention require separate operational acceptance.

No new migration is required by this delta. The three parent Chale migrations are still unapplied in hosting. A rollback must retain this cleanup/grants or an explicitly reviewed erasure procedure; an older build without cleanup cannot preserve this behavior.

Scoped public-source approval and exact remote CI, real account/admin/MFA/privacy/backup/provider acceptance and explicit migration/merge/enablement/release approval remain. No new resources, payment, model training or fees; core access remains GH₵0. Next bounded capability: fresh published-public-source retrieval and citations through the existing gateway, without private history in a public index.
