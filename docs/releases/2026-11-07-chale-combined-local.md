# Chale combined-draft compatibility checkpoint — 7 November 2026

## Outcome and scope
LOCALLY BUILT only. This isolated checkout combines public PR46/47 compact chat and private history, PR48 Knowledge Studio/source-update pilot, and PR49 bounded tool execution/header attachment. Public PRs are unchanged, unmerged and undeployed. All proposed hosted migrations remain unapplied and the feature defaults remain off. No paid service, provider, resource, fee or real-account data changed.

Inputs: local c02ec109ba8e85867fcf5e1e031b3d78062947f7 (public PR49 remote96d5638f/treeaee24b36), PR47 local b201f7d13808be29166c325db5eb647c607223ff (includes PR46), and PR48 local e938056eefedf1d83a245382bb8197a50b97e2eb. Main baseline is56e0c2ebf83dfc2c89fccd0bc552691e4ae42b9b. Local merge1d0c9fc47cc256c58cec332c3bba67659872f70f/tree806908e55bdd35d5c611525e6e545c64f07fffeb precedes the additional coexistence test and this receipt. Final commit/tree is recorded in primary work/chale-2-gateway-20261107/integration-checkpoint.json.

## Actual integration changes
Separate pairwise textual previews had no conflict markers. Combining the three branches exposed actual conflicts in server/index.mjs (four blocks), .github/workflows/release-checks.yml (two) and docs/CONTINUATION.md (one). This is retained as an actual integration failure, not a regression erased by later passes.

Resolutions retain both existing history and knowledge imports, local SQLite schemas, default-off service initialization, route gates and rate limits. History continues to use its owner/session authorizer; knowledge remains staff/MFA guarded. The public/local model tool registry is unchanged and receives no private-history access. All history, knowledge, sync and gateway CI steps are retained. Historical continuation sections are preserved with a local-only integration note.

One new test, scripts/test-chale-combined-postgres.mjs, applies the exact three proposed migrations in one private-socket disposable database. It verifies all markers and ten tables coexist; RLS/direct-role denials remain; runtime cannot truncate tables or update/delete immutable public evidence; narrow private-text erasure, staged-text expiry and existing-session row-lock permissions remain; session-owner reassignment is not granted. It is added after existing PostgreSQL workflow steps. This is not a production migration or certification of the complete application authorization model.

## Executed validation
All evidence is retained in primary work/chale-2-gateway-20261107.

- Complete unit/component suite: **652/652,51/51 files,85.60seconds, process exit0**. The actual executed-file manifest matches tracked tests. Original5s deadlines, one worker and fresh per-file isolation remain. Compiled-code caches only; no cached test results/state.
- Production command npm run build with the pinned Node26.12.1: TypeScript and Vite8.3.5 build **1690 modules**, exit0. Existing large index/Communications bundle warnings remain.
- Actual isolated HTTP/SQLite: history16, Studio14, sync12, tool boundary6journey groups, general workflow35, private work-status34 and direct messages13 all pass. Existing scripts use synthetic accounts, explicit fixture environments and intercepted providers; no real inference, user records or external source activation.
- Disposable PostgreSQL17.10: existing history36, Studio36 and sync46 checks pass. New combined-migration test **67/67** passes against the unchanged proposed SQL. All child clusters use private temporary sockets and are cleaned up.
- Dependency security8 passes; npm audit reports **0 vulnerabilities**. Package/lock files did not change.
- Built UI in installed **Chrome156.0.8078.80 on macOS**, isolated temporary profile: navigation39 and compact conversation10 checks pass, exit0. No signed-in browser or real provider. Original navigation report's fixed Linux label does not identify this local run's platform; wrapper logs record actual Chrome. Character-off chat, header launcher/Settings restore, accumulated history, reading older messages while a reply arrives, draft retention, focus and short-screen input reachability passed.
- Actual390px,1280px and844×180 conversation screenshots inspected. These are synthetic replies/guest fixtures, not real-device, keyboard or hosted acceptance.
- Application/source hashes from the65-file pre-full snapshot remain unchanged through full/build/API/browser checks. The later additions are this receipt, the executed coexistence test and its workflow line. No Vitest configuration or dependency change.

Commands used the pinned task-local Node, existing installed dependencies and PG_BINDIR from the existing embedded PostgreSQL17.10 binaries. The full command was vitest run --fsModuleCache --fsModuleCachePath=<existing compiled-code cache> --maxWorkers=1 with JSON/verbose reports. Existing scripts test-chale-history, test-chale-knowledge, test-chale-knowledge-sync, test-chale-tool-boundaries, test-chale-workflow, test-chale-work-status, test-direct-messages and test-dependency-security ran unchanged. The corresponding three *-postgres scripts plus test-chale-combined-postgres ran with disposable clusters. Browser scripts ran unchanged via a launch wrapper selecting installed Chrome; network was limited by their local fixture routes.

## Evidence limits and retained failures
Original PR49 local575/578, UI28/32, collection/worker failures, incomplete576/0-with-exit1, cold-import and render-count REDs remain. Its exact public head96d5638f separately passed581/45 and39 Linux Chromium CI checks; that remote acceptance is not acceptance of this combined source. The final green runs do not establish one cause for all historical QA001 timeouts.

The initial combined merge stopped with seven conflict blocks in three files; both implementations were retained. Earlier local Chromium launch and Python artifact-network imports failed; installed Chrome and the system artifact download were separately verified. A diagnostic looked for one absent evidence directory; no nonexistent result was treated as a pass.

Only bounded author review is complete. Independent review, exact combined-source remote CI, authentication/recovery compatibility, migration/retention/backup review, real admin/MFA/two-account/device/provider acceptance and explicit migration/merge/enablement/deployment approvals remain. No human reviewer was contacted or approval fabricated. No private conversation enters a shared public index or automatic training.

## Next smallest task
Review and run exact remote CI on this combined candidate before any release proposal. Then connect reviewed, published, fresh public knowledge retrieval/citations through the existing gateway with adversarial, permission, expiry and withdrawal evaluations. Broader sources, embeddings, confirmed long-term memory, agents, voice and other ecosystem gaps remain unfinished. GH₵0 platform fees remain.
