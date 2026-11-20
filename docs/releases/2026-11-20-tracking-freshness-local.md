# Collection GPS freshness correction — 20 November 2026

Status: LOCALLY BUILT AND TESTED. Not published, merged, migrated, activated or deployed.

Starting revision: `cb6aeab739ec1f96433b4617f88dd6a67d137184`, the actual PR #32 merge-resolution head based on main `56e0c2ebf83dfc2c89fccd0bc552691e4ae42b9b`. Original local tracking branch `c7dcf613` alone did not include that current-base reconciliation. Reused existing assigned-job authorization, current Waste verification, transactional locks, explicit location consent, native watchPosition publisher and authorized foreground customer reads. No duplicate tracking-policy or identity system was introduced.

## Correction and bounded source

- `server/job-tracking.mjs`: stale and retention ages use the earlier of device capture and server receipt. Maintenance clears a point when either timestamp reaches the 90-second cutoff. Future capture skew is restricted from 15 to 5 seconds.
- `src/modules/waste/LocationTracking.tsx`: applies the same freshness calculation between foreground polls, displays capture time, keeps expiry and low-data modes unchanged.
- `src/modules/waste/location-publisher.ts`: refuses samples over 5 seconds ahead before transmitting; does not collect additional fields or retain coordinates.
- The three corresponding test files add deterministic capture/receipt, retry, future-clock and exact-expiry regressions.
- `scripts/test-job-tracking.mjs` and `scripts/test-job-tracking-postgres.mjs` extend the existing actual HTTP and disposable runtime checks. Existing assertions remain.

No schema, API shape, provider setting, dependency or major visual change. The existing 1000-metre accuracy and 30-second input-age limits remain stricter than the supplied illustrative 10000-metre/60-second policy. Pure `active` and actor tests are not a replacement for current assignment, verification, block and server checks.

## Executed evidence

Pinned Node 26.12.1; Vite 8.3.5; built-in Undici 8.12.2 / development Undici 8.12.3. Identical lockfile dependencies reused from the existing installation by a worktree-local link; system Node unchanged.

- Baseline focused: 45 passed, 0 failed.
- New RED: 48 passed, 4 failed: delayed-reading freshness on server and client; future skew on publisher and server. Original failure messages/stacks retained.
- Corrected focused: 52 passed, 0 failed.
- Full Vitest: 617 passed, 0 failed / 46 files.
- Real local HTTP: 35 checks using synthetic accounts and samples.
- Disposable PostgreSQL 17.10: 44 checks, including migration/RLS/least privilege, concurrent retries, queued cancellation/review revocation and capture-based cleanup. Production migration is unapplied.
- TypeScript, production Vite build and repository dependency-security checks passed; dependency audit 0 vulnerabilities. Existing large-chunk warnings remain.

Exact commands, elapsed times, logs, source hashes, reports and independent review are retained under `work/tracking-freshness-20261120/`. Key commands: `node node_modules/vitest/vitest.mjs run`, `node node_modules/typescript/bin/tsc -b`, `node node_modules/vite/bin/vite.js build`, `node scripts/test-dependency-security.mjs`, `node scripts/test-job-tracking.mjs`, `PG_BINDIR=<existing disposable tooling> node scripts/test-job-tracking-postgres.mjs`, `npm audit --audit-level=high --ignore-scripts --json`. No deadlines/assertions/isolation were weakened. A green run does not diagnose historical QA001.

Independent review: no actionable findings in the eight-file delta, with hashes matching executed gate evidence. Review covered source and retained evidence; no second execution or physical-device result is claimed.

## Limits, recovery and next acceptance

Current hosted main remains 56e0c2eb; this GPS candidate is not hosted. Remote CI for this new revision has not run. Before release, require explicit publication/release approvals, fresh current-main compatibility, exact-source CI, reviewed additive migration, safe disable/rollback, and real assigned collector/customer acceptance.

No real device coordinate has been demonstrated reaching a customer's physical phone in this increment. Browser-emulated coordinates and synthetic PostgreSQL/HTTP inputs are automated evidence only. New geographic maps, permitted tile/routing provider integration, optional 3D map, road routes/ETA, real reconnect/mobile-network acceptance and physical device permission/revocation acceptance remain open. Foreground collection only; no reliable suspended-app background tracking is promised.

Rollback of this local delta is a source operation on this isolated branch only, with no production data change. A future GPS rollout must retain its authorization, expiry, privacy cleanup and deny-only `ECOVIBES_TRACKING_DISABLED` gate. Keep the additive schema/data and disable tracking first; do not drop production tables. GH₵0 platform access and disabled finance unchanged.

Next smallest task: agree a compact authorized geographic map/low-data presentation, then integrate a permitted tile provider with separate external-map privacy disclosure and deterministic stale/expiry/fallback tests before two-device acceptance.
