# October 23: identity response isolation candidate

## Completed and scope

Fixed a reproduced app-shell race: an older account lookup could restore the previous identity after a newer sign-out or page cleanup, and the old identity remained visible while an account-change confirmation was pending. Three new regressions failed before the correction. Superseded requests now abort, revision/disposal checks discard late results before identity/CSRF/presence use, and explicit account changes clear the previous identity and CSRF immediately. The existing routes, cookies/CSRF checks, optional presence and60-second cadence are retained. This is a frontend state correction, not a backend authorization or session-revocation claim.

Only these release-candidate files change from published main959b8d96892e51fbeec5df438580a67378e7316a:

- src/modules/App.tsx: existing identity/presence effect only.
- src/modules/App.identity.test.tsx: five regression cases; all four original cases, mocks, assertions and deadlines retained.
- docs/releases/2026-10-23-identity-response-isolation.md: this receipt.

The private Chale work-status card, new Connect/waste changes and unrelated dirty work are excluded. No backend, dependency, lockfile, migration, grant, provider or environment change. Saved baselines, exact reconstruction and source hashes are in work/identity-release-gate-20261023 in the shared development checkout. The candidate is a separately attached managed worktree based on the exact published commit.

## Actual checks and failures

Development checkout after the correction:

- 61 focused tests passed:9 identity,32 Chale UI,20 Connect component cases.
- Two unchanged full runs passed319 tests/27 files,77.85s and73.93s.
- Production build passed,1,656 modules; existing approximately656KB Communications warning remains.
- All nine API commands passed sequentially on their first execution in this sequence:61 providers,27 payments,39 identity roles,134 jobs,83 waste,198 synthetic Connect,58 support,19 Chale workflow,34 owned-work checks (653 total). These are disposable SQLite/synthetic-provider checks, not hosted PostgreSQL or physical-media tests.

Clean published-app candidate:

- Unchanged published-source baseline:200 tests/19 files passed in50.92s.
- First candidate full run:204 passed/1 five-second timeout in the new pending-account-confirmation case;19 files,81.01s total. No assertion mismatch was reported. This failed run is retained and is not counted as a pass.
- Targeted diagnostic runs passed1/1 and9/9. Stage timings in the latter were render184ms, identity609ms, account event770ms, cleared842ms, confirmation865ms, finished889ms. These measurements did not establish the timeout's cause. Temporary instrumentation was removed and exact equality to the reviewed test source verified.
- Uninstrumented full rerun:205 tests/19 files passed in51.84s.
- Production build passed TypeScript and1,652 modules; the existing large-chunk warning remains.
- All six HTTP commands actually present in published CI passed sequentially:52 providers,27 payments,39 identity roles,134 jobs,58 support,19 Chale workflow (329 checks). Fixtures use temporary SQLite and synthetic accounts; payment/AI providers are mocked and no application .env or hosted credentials are loaded.
- Whitespace and source-boundary checks passed. Independent read-only review of both the root fix and clean port found no Critical or Important issue. Reconstructing the original effect and stripping only the five additions reproduces the published sources exactly.

Nonblocking review coverage gaps remain: direct child-CSRF clearing assertion, cleanup during an already-started presence POST, hidden-tab account-change confirmation and the interval cadence. This is not a complete authentication/security audit.

## Release decision

**Draft candidate only; no merge or deployment. QA-001 remains open.** Historical original-test timeouts and this candidate's intermittent new-case timeout have no confirmed cause. Passing reruns do not establish that the timing problem was fixed by the independent race correction. Preserve deadlines/assertions and obtain exact-revision CI evidence while investigating; do not publish a launch-readiness claim. No additional founder credential is required for this work.

The live app remains on959b8d96892e51fbeec5df438580a67378e7316a, Render deploy dep-dbdkqf2vcj2c7384dfmg, on fresh read-only observations. The pending Waste/Connect migrations remain unapplied. No new hosted account mutation, inference call, paid action or external contact was performed in this slice. If this frontend-only candidate later clears release checks, the prior application artifact remains the rollback target; no database change is required by this diff. Hosted identity behavior must be verified separately after an actual deployment.

## Integration and next gates

Two genuine authenticated hosted Cloudflare Free Chale replies were already verified earlier October23; do not request the token again. Wider answer quality/catalog/private isolation/failure checks and the local-only owned-work card remain separate. Connect has no verified physical voice/video session or realtime incoming/message delivery; actual PostgreSQL/provider revocation, consent/network behavior and two-device tests remain open. Genuine collector GPS/maps and the shared recovery/storage/restore/merchant/payment/refund gates remain incomplete. No complete partner demo, controlled Ghana pilot or public launch approval.

Next: investigate QA-001 using the clean candidate and CI timing/failure evidence, then selectively release the identity correction and owned-work slice only after their gates pass. Keep unrelated expansion/Games paused.
