# Bag release unblock — 16 November 2026

**Decision: READY FOR REMOTE CI.** This is local qualification, not release authorization.

Parent: `eb27231ffb7950231861239734581b087a80981b` on `codex/bag-safety-00a-20261114`. This receipt and `src/modules/App.checkout.test.tsx` are the only new committed files. The resulting exact SHA is recorded after commit in `work/bag-release-unblock-20261116/checkpoint.json`.

## The two failures and investigation

1. **Guest online** — `main Bag without a durable checkout preserves items and never reports an order: signedIn=false online=true`. R6 failed after 6796.287 ms against the unchanged 5000 ms test deadline; stack registration `App.checkout.test.tsx:29:5`, with no assertion-phase trace. A new isolated candidate run passed in 1659.860 ms; the exact parent snapshot passed in 2611.625 ms. The other guest case timed out independently in 5443.358 ms, so the duplicate error alone did not explain every timeout. Measured actual-App whole-document Bag lookups cost 1827.108 / 726.441 ms, versus 27.185 / 122.991 ms for the identical accessible button scoped to its unique banner, with the order reversed for the second comparison. These are test-side query costs and a demonstrated deadline hazard, not a measured production interaction delay. Classification: test-query performance defect exposed by timing variability; no application regression established. The precise scheduling trigger of the original R6 timeout cannot be recovered from its uninstrumented log. Disk pressure or CPU contention is not asserted as its proven cause.
2. **Guest offline** — same title ending `signedIn=false online=false`. R6 failed at `App.checkout.test.tsx:51:28`: `Found multiple elements with the role button and name /^Bag/`, after its earlier query/awaits. Parent offline isolation passed in 3375.065 ms. A controlled test using the real App held the original online journey until the existing deadline, then released it after the next journey mounted: the expired callback resumed with `signal.aborted=true`, remounted the App and reproduced the second duplicate-button failure at the corresponding query (`cancellation-probe.test.tsx:52:28`). The unguarded probe recorded two failures. With the continuation guard it retained the expected original timeout and the next case passed. Repeating against the actual repaired helper recorded the expected timeout and a passing next case. Classification: test-lifecycle isolation defect, not an App that independently creates another root. This controlled reproduction proves the mechanism; the old R6 log cannot establish historical render ownership by itself.

Full original stacks, failing JSON, phase traces, baseline commands and raw benchmark output are preserved under `work/assignment-00a-r6/` and `work/bag-release-unblock-20261116/`. The baseline archive was verified against all 271 parent Git blob hashes. The traced, unrepaired four-file run also passed 39/39; that pass was not used to erase earlier failures or establish their cause.

## Bounded correction

- Scope Bag-button searches to the unique accessible banner and the primary action to its dialog. A duplicate banner still fails; no first-match selector masks extra roots.
- Capture the owning Vitest signal before awaiting; reject a settled result after that signal aborts, preventing a timed-out callback from reaching its remount in the following test. The timeout remains a failure.
- Add a cancellation regression. Removing its guard makes the assertion fail (`promise resolved undefined instead of rejecting`); the repaired test passes.
- All 33 original assertion/matcher expressions remain unchanged; two added. No deadline, worker count, isolation, retry, skip or assertion threshold changed.
- No application, style, storage, API, identity, payment, order or provider code changed. The Bag guard remains byte-identical. No redesign or new checkout was implemented.

## Executed qualification

Pinned Node 26.12.1; exact commands and raw logs: `work/bag-release-unblock-20261116/gates/results.json`.

| Gate | Actual result |
| --- | --- |
| Focused checkout/identity/navigation: Vitest four files | 40 passed, 0 failed |
| Full Vitest regression | 577 passed, 0 failed, 44 files |
| TypeScript `tsc -b`; production Vite build | Both exit 0 |
| Dependency audit; dependency security checks | Audit 0 vulnerabilities; both exit 0 |
| Existing provider, Paystack, identity-role, job, support, Chale, private-status, message and public-trends HTTP workflows | All exit 0; isolated fixtures, no real payment/provider acceptance |
| Disposable PostgreSQL receipt checks | 84 checks, PostgreSQL 17.10, exit 0 |
| Existing navigation browser script, relocated output only to preserve old artifacts | 39 checks passed |
| Existing exact Bag browser script | 194 checks passed, 0 failed, 608.399 seconds |
| Qualification command total, excluding deliberate diagnostics | 17/17 new gate commands plus the Bag browser command passed |

The Bag browser run preceded the test-only correction. Its application/build/script inputs were unchanged; the later production build is byte-identical to the tested bundle. This binding is recorded in `preservation.json`. Browser checks cover the existing guest/member online/offline, reload/account separation, no financial mutation and drawer interaction matrix. Synthetic identity and desktop Chromium are not genuine account, physical-device or hosted acceptance.

Browser measurement: sampled owned-process peak RSS 772236 KiB, sampled aggregate CPU peak 121.5%; 1-second sampling can miss peaks and double-count shared pages. New logical artifact growth 6341537 bytes. Free disk was 3177058304 before and 3154444288 after. Earlier insufficient capacity was observed and retained; it was not bypassed. iCloud's local folder was not treated as a separate disk.

Deliberately failing cancellation probes and the no-guard regression are retained as diagnostic REDs, not presented as passing qualification commands. Initial private-script preparation errors (old Python API and absent TypeScript compiler JS API) are disclosed separately and did not alter application code.

## Preservation, CI and release boundary

All 15 original worktree HEADs/statuses and 3915 protected file hashes remain unchanged. No evidence or user data was deleted or moved. No production or provider changes, public publication, remote CI, merge, migration, deployment, live financial action or fees occurred.

Current CI job still has its 12-minute total limit. Fresh local Bag + navigation runs took 652.471 seconds, excluding setup/build. This is a local measurement, not proof of intended-runner timing; retained older Bag-only 723.304-second evidence remains. Remote runtime and all exact-SHA checks must be observed before any subsequent release decision. No timeout was raised and no checks were dropped.

No independent hotfix branch is needed for an application defect: the existing truthful navigation-only checkout guard is unchanged and passes the browser safety matrix. Any future fallback must preserve that guard and basket/identity protections; reverting to false order confirmation/cart deletion is unacceptable.

No source publication, merge or deployment is authorized by this record. The next product increment is the approved Contact Seller feature, separately scoped against the existing account/message authorization services. It was not implemented during this unblock.
