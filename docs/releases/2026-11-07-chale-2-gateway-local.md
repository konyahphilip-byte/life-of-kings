# Chale 2.0 central tool boundary — local checkpoint, 7 November 2026

## Result and release status
LOCALLY BUILT, isolated on codex/chale-tool-contracts-20261107, based on deployed PR39/main56e0c2ebf83dfc2c89fccd0bc552691e4ae42b9b. This is a reviewable development increment, **not merge-ready or deployed**. The full regression gate remains open. No migration, public publication, remote CI, live inference, provider change, real-user action or production deployment occurred.

The new founder directive is preserved byte-for-byte at docs/directives/2026-11-07-chale-2-living-ecosystem.md (SHA256 f6895785f61591d3976e473819cf1c487cf75593565d4b7f57a91024cd5e857c). [Audit, contracts and ADR](../ai/CHALE_CENTRAL_TOOL_CONTRACTS.md) document the existing gateway, draft reuse, missing capabilities, compatibility and costs.

## Actual code completed
- Extracted the six existing model tool declarations into server/chale-tools.mjs with frozen input/output schemas, public/local scope, risk, confirmation, five-second execution wait and content-free audit policy. A direct declaration comparison passed: all six existing provider tool declarations are unchanged.
- Fixed catalog readers that ignore caller cancellation: the request stops waiting, releases the model slot and ignores late results. Both tools mode and the existing Free grounded catalog path use the same boundary. This does not force-cancel SQL or preempt synchronous CPU work.
- Validate and bound tool output before adding cards or forwarding tool data. Unknown financial/business tools, forged permission fields, extra private output fields, malformed values and false submitted-draft states fail closed.
- Existing API emits bounded toolId/outcome/duration/version metadata only. It is best-effort operational telemetry, not a durable action/financial audit.
- Corrected canonical Messages guidance to describe deployed accepted-friend text, Saved/Received distinctions and the job shortcut; corrected private call guidance so credentials alone never imply readiness. Guide version2026-11-07-connect-text-and-tool-boundaries.
- Added a real isolated HTTP fixture for stalled/cancelled readers, slot release, refused financial tool, preserved unsent drafts and content-free events; added it to release checks.

## Files changed
Application: server/chale-tools.mjs, server/chale-ai.mjs, server/index.mjs, shared/chale-app-guide.json.
Tests: server/chale-tools.test.mjs, server/chale-ai.test.mjs, server/chale-cloudflare.test.mjs, scripts/chale-tool-boundary-test-provider.mjs, scripts/test-chale-tool-boundaries.mjs.
CI: .github/workflows/release-checks.yml.
Documents: this receipt, docs/ai/CHALE_CENTRAL_TOOL_CONTRACTS.md, the exact founder directive.
No UI source, dependency manifest, database schema or migration changed.

## Executed validation
Pinned task-local Node26.12.1 (built-in Undici8.12.2), Vite8.3.5 and dev Undici8.12.3. System Node was not changed.

| Actual command/check | Result | Evidence/limits |
|---|---|---|
| vitest run Sidekick.test.tsx + chale-tools/ai/cloudflare.test.mjs, maxWorkers=1, JSON reporter | **151/151, 4 files** | focused-final.json; actual component/server checks, not hosted |
| vitest run --maxWorkers=1, final source | **575 passed / 3 failed, 578 total, 44 files, 327.903s** | full-verified.json; navigation unsupported-destination timeout, account-route heading missing, personal-account-to-Messages timeout |
| Targeted unchanged navigation/routes/personal-account files | **28 passed / 4 failed, 32 total, 3 files** | ui-diagnostic.json; Create-to-account/account/calls headings and Home timeout. Failures shift; cause not established |
| npm run build | PASS, **1685 modules** | TypeScript + Vite; existing large Communications chunk warning retained |
| node scripts/test-dependency-security.mjs | PASS, **8 actual local HTTP assertions** | security.json; Node/npm fetch probes, no remote exploit claim |
| npm audit --audit-level=high --ignore-scripts --json | PASS, **0 vulnerabilities** | audit.json |
| node scripts/test-chale-workflow.mjs | PASS, **35 HTTP checks** | http-workflow.json/log; isolated SQLite/synthetic accounts/intercepted model transport |
| node scripts/test-chale-work-status.mjs | PASS, **34 HTTP checks** | http-work-status.log; own/assigned scope; inference disabled |
| node scripts/test-chale-tool-boundaries.mjs | PASS, **6 HTTP journey groups** | http-boundaries-verified.json; actual server with synthetic transport/reader failures |
| Six model declaration compatibility; candidate source hash checks; git diff --check | PASS | declaration-compatibility.json, source-for-review.json, root-preservation.json |

All new Chale-focused assertions pass. The full suite is **not green**. Existing test deadlines, assertions, worker count and isolation were not weakened. Do not describe a passing focused run as clearing the regression gate or diagnosing historical QA001. There is no fresh PostgreSQL, physical-device, hosted, genuine model or real-account acceptance in this no-schema increment.

## Retained failures and fixes
- lookup-budget-red.json:0/2. Reader ignored cancellation, retained the sole model slot; second request returned busy. Bounded defect reproduced and repaired; no inference about historicalQA001.
- stale-guide-red.json:0/1; obsolete preview-Messages guide contradicted deployed text.
- registry-focused-first35/35 and second102/102 are intermediate evidence.
- http-boundaries-first.json and http-quota-diagnostic.json: first four groups passed, then429 ai_daily_limit. The new fixture omitted explicit guest40 and used default5 for six requests. Only its disposable whitelist now matches the approved40-question configuration and existing workflow fixture; application limits and real counters were not changed/reset.
- full-first.json and full-final.json:577/578 each; old job shortcut assertion failed. Adding the shortcut as a fifth step still hid it because cards render four steps. Combined it into four visible steps; unchanged focused UI assertion now passes.
- Current final full575/578 and targeted UI28/32 remain failures, not successes.
- Initial directive copy lacked the isolated docs/directives directory; corrected without changing the attachment. Audit reads of guessed MoneyTrust/Settings paths failed; actual money/MoneyTrust.tsx and App settings implementation were then inspected. Read-only process status was denied until normal approval; no bypass.
- First primary preservation assertion failed against the historical145-file reference. Fresh audit found21 source differences with several modification times during this run; no source was reverted. This increment writes primary documentation/evidence only, and all10 isolated candidate source hashes are stable and predate the final full run. **No145-file primary preservation pass is claimed now.** Older preservation receipts remain historical.

## Bounded source review
Author review only; not independent approval. Reviewed correctness of aborted/late tool results, timeout cleanup, slot release, strict schema/byte limits, fixed tool authority, no public-private escalation, error/log redaction, preserved one-query callback and one-lookup/model-loop budgets. Fixed the two guide defects and the test fixture omission. Remaining blockers: full regression failures, independent source/security review and exact remote CI. Timers cannot cancel an uncooperative database reader; telemetry is best effort; rejected pre-execution calls are not claimed as individually audited executions. No private/business mutation tooling was added.

## Deployment, approval and next smallest task
No public draft/merge/deployment approval exists for this **new** source scope; earlier approvals covered PR47/48 and are not repeated or broadened. Prepare the scoped commit, obtain new public draft publication approval for remote CI, resolve the full regression gate, then independent review and explicit merge/deployment approval. No database migration is required for this increment; other drafts' unapplied migrations/security compatibility remain separate.

Once stabilization gates pass, reuse PR48 for published/unexpired/approved-source retrieval and citations in the same gateway with freshness/withdrawal/adversarial tests. Reuse PR46/47 for compact UI and saved history. Confirmed memory, streaming, voice/voice notes, business agents, organization scopes, live calling and wider pillar acceptance remain open. Core access/fees and provider spending unchanged: GH₵0 platform fees, no paid inference/fallback, no new resources or real transfers.

## Evidence
Primary work/chale-2-gateway-20261107 retains original REDs, every full/focused report, build/security/audit/HTTP reports, declaration compatibility, source and primary-difference records, final checks/checkpoint and review notes. The authoritative primary dashboard/continuation/sprint are updated separately without publishing the dirty primary source.
