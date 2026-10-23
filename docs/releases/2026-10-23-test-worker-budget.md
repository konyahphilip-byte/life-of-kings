# Test worker budget: measured local timing mitigation

October 23, 2026, UTC/Accra. This is a test-runner resource correction, not a production authorization change or complete explanation for every historical timeout.

## Reproduction and control

The development checkout's default parallel run failed15/347 tests across five files in156.86seconds. Identity, Communications, Sidekick, GamesHub and ProviderPortal were affected; most failures hit the existing five-second deadline, with missing-element follow-ons also retained. No failing result is counted as a pass.

Changing only the CLI worker count to one passed347/347 in109.73seconds. Returning to default concurrency reproduced two failures (345/347 in95.28seconds), including the same original identity case. Its durations were6,479ms/default,2,488ms/single,6,122ms/default against the unchanged5,000ms deadline. The recorded jsdom environment totals were166.33/50.10/125.60seconds; these accumulated phase totals are not wall-clock duration. Identity fetches are synthetic; no hosted network is involved.

These default/single/default observations support an observed local test-worker contention failure mode. They do not prove that every previous failure had this cause or that application behavior is correct in a browser. Raw reports are in ignored work/launch-gates-20261023/full-suite*.json.

## Change and actual checks

Only vitest.config.ts adds maxWorkers:1 and explanatory comments. Existing jsdom, work/** exclusions, default per-file isolation, mocks, test cases, assertions, deadlines and retry behavior are preserved. No production runtime, dependency, lockfile, schema, role or provider setting is changed by this correction. The wording was narrowed from startup to default worker parallelism after review, because the experiment did not isolate startup alone.

- Bare development npm test after the cap: **347 passed in28 files**,140.05seconds. No deadline/assertion relaxation. The subsequent comment-only wording correction does not change configuration values.
- Bare clean published-main identity candidate npm test with the final config: **205 passed in19 files**,67.06seconds.
- Development production build: **1,656 modules passed**; existing Communications chunk warning remains.
- Clean candidate production build: **1,652 modules passed**; existing approximately657KB Communications chunk warning remains.
- Independent read-only review found no Critical/Important issue in the bounded resource correction. It confirmed per-file isolation and test behavior are preserved and limited its conclusion to this mitigation.

The new Connect revocation adapter, Chale work-status card and all other dirty-root source are excluded from the clean identity candidate. The separately published original identity fix/tests/receipt remain unchanged. The candidate's only proposed additions beyond that three-file draft are this receipt and the test config.

## Release status

**Local verification completed; updated exact-revision CI/publication still pending.** The new worker config is not yet in draft PR7 or on the hosted app. Earlier CI success applies only to the previously published revision. No merge, deployment or database change is claimed. Before release, selectively publish only the reviewed candidate, verify its exact tree, run CI and confirm the existing application remains the rollback target. Hosted account behavior remains a separate check.

The local Connect Cloud-only prototype has an unresolved strict-revocation timing review finding and is not a release candidate. The founder requested exploration of EcoVibes-owned media hosting; Cloud sign-up is paused. All physical calling, network, genuine GPS, broader AI, recovery/storage/restore and financial launch gates remain separate.

References: [Vitest maxWorkers](https://vitest.dev/config/maxworkers), [test isolation](https://vitest.dev/config/isolate), [performance phases](https://vitest.dev/guide/improving-performance).
