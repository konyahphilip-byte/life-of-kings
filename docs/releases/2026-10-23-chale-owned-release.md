# Chale owned-work: isolated release candidate

Prepared October23-24, 2026 (Accra/UTC). **Draft/QA hold; not deployed.** This receipt supersedes the older card receipt's baseline and candidate state, while retaining all historical failed runs.

## Capability and scope

A signed-in account can explicitly choose Check my work status within Chale on Waste or Quick&Handi. The protected GET /api/v1/ai/work-status uses only its active session identity, rejects every selector, keeps staff restricted to their own jobs and applies a transactional30/minute allowance. It returns allowlisted generic-job workflow/state counts and a timestamp, not job titles, notes, amounts, peer IDs, phone numbers, messages or locations. These generic counts do not prove collection, recycling, weight, GPS or payment.

The card works without model inference. Private counts remain component state, outside model tools/context/history. Account-keyed remount, abort/request-identity checks, offline hiding, failed-refresh clearing and an independent10-second deadline discard stale/late responses. No business mutation, schema, dependency or provider-setting change.

Exact planned candidate from published main **958945c32b53319edb33295b4419b4b7411c0762**:

- New server/chale-work-status.mjs and server/chale-work-status.test.mjs.
- New src/modules/assistant/WorkStatusCard.tsx and scripts/test-chale-work-status.mjs.
- server/index.mjs: three existing feature import/binding/protected-route lines only.
- Sidekick.tsx: import and account-keyed card insertion only.
- Sidekick.test.tsx: eleven new integrated cases; all22 existing cases preserved.
- sidekick.css: existing card styles appended.
- package.json and .github/workflows/release-checks.yml: one command only; no dependency change.
- This receipt.

The previous identity worktree contains published but staged work and was preserved. Native creation initially failed because the new commit had not been fetched locally; fetching only origin main succeeded, then the managed chale-owned-work worktree was created/attached. It started clean. Locked dependency bytes match development; its ignored node_modules symlink shares existing dependencies without an install/change. Fresh CI must install from the committed lockfile.

Source-boundary verification reconstructs six exact published integrations and preserves eight protected files: lockfile, worker config, both identity files, Chale model/provider source, existing synthetic provider preload and app guide. All four new feature files match the root implementation. No Connect/Waste runtime or pending migration is included. The only new root source edits in this slice are the validation guard/regression below, each reconstructed against its pre-edit hash. Evidence and the pre-code plan are under ignored work/chale-owned-release-20261023.

## Review correction and actual checks

Independent read-only review found no Critical/Important issue in the bounded implementation. Its Minor finding was reproduced: workflow:["waste"] was coerced to a string, accepted and labelled Quick&Handi. A new malformed-response regression first failed while four sibling cases passed; the DOM showed the wrong label. The guard now requires a primitive string before direct allowlist membership. The reviewer reread the guard/regression and confirmed the finding fixed, with no remaining blocking code issue. Review ran no tests/providers. Unmeasured query cost without an assigned-provider index remains a scale consideration, not a demonstrated release blocker.

| Execution | Actual result |
|---|---|
| Untouched published-main baseline | 205 tests/19 files passed,80.05s |
| First ported full suite, before review correction | **222 passed/4 five-second timeouts**,226 total/20files,132.49s |
| Malformed-response regression before guard fix | **1 failed/4 passed**,28 unrelated skipped; wrong Quick&Handi rendering |
| Final focused UI + server tests | 44/2 passed,6.91s |
| Final full suite | 227/20 passed,37.40s; exact JSON report retained |
| Final production build | TypeScript/Vite passed,1,653 modules; existing approximately657KB Communications warning |
| Final sequential HTTP fixtures | providers52, payments27, identity roles39, jobs134, support58, Chale workflow19, owned-work34 = **363 checks passed** |
| Reconstructed source boundaries/whitespace | Passed; exact hashes retained |

The first full failure affected three unchanged identity cases (7,485ms greeting/profile,6,256ms sign-out refresh,5,722ms pending-account confirmation) and the new first owned-work UI case (6,087ms). All hit their existing5,000ms deadlines. In the final run the corresponding cases took735/390/451/589ms. **The one-worker cap does not explain or solve all observed timing failures. A passing retry is not a confirmed root cause or a waiver of the release gate.** No assertions, deadlines, retries, isolation or identity source changed.

The first untouched-baseline attempt failed before tests because the sandbox denied Vite's cache file; the approved rerun passed. The initial owned-work HTTP fixture passed34 with inference disabled; the final serial execution passed34 again. No failed setup or regression is counted as a pass. Raw final JSON, individual API/build logs, timestamps and scope records are retained. Existing AWS SDK JsonCodec warning occurred in a synthetic unchanged unit test; it is not evidence of a real AWS call. A guessed older scope-script filename did not exist; the actual saved script and new verification were read/used.

The seven fixtures run the actual API with disposable SQLite, synthetic accounts and mocked/disabled providers. Owned-work checks exercise customer/assigned-provider/staff ownership, query rejection, data minimization, limiter boundary, suspension and empty inference capture. They do not establish hosted Auth/Postgres concurrency/privileges, real model quality, media, GPS, payments or restoration. No production test records were seeded.

## Release decision and remaining gates

Keep this candidate **draft, unmerged and undeployed** pending the intermittent timing assessment, fresh exact-source CI and hosted compatibility/acceptance. The current live identity release remains958945c3 / dep-dbdrgbvavr4c7395g3lg; it is the candidate's rollback target with unchanged schema contract. No hosted credential/provider/billing/environment/database or financial action was performed here. No real model call was repeated; the two earlier genuine Cloudflare Free replies remain verified and no token action is required.

Next: retain CI and failure timing evidence, reproduce/profile the outlier under controlled conditions without weakening assertions, then a scoped release decision and actual PostgreSQL/hosted own-account/isolation checks. Separate founder-owned media design/strict revocation, real two-phone calls/realtime/network fallback, genuine collector GPS/Live3D and shared storage/recovery/restore/payment-refund gates remain open. Cloud sign-up is paused; no paid infrastructure is authorized. This does not make the partner demonstration, Ghana pilot or public launch ready.
