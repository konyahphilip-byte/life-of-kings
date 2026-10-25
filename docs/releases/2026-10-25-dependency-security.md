# Dependency security candidate, October25,2026

## Scope and exposure

The founder put dependency remediation before feature release. This clean candidate starts at published77ef07337148f0822e4002c9e6785fc9ea604a57; it excludes all unfinished messaging/calling/Waste/GPS work. Root and published lockfile were identical (SHA256bbf9842bec32dd4c9e75d8e4dcf70db1e2c9b038b6a7c5f2d37086305ce96835). Plan/reports are retained in the original workspace's `work/dependency-security-20261025/`.

Full audit found **two high-severity affected packages**, not just two individual advisory entries: Vite8.3.1 (six advisories) and Undici8.11.2 (three). Production-only audit found high1/Vite. npm Undici is jsdom's dev/test dependency; the application’s fetch() calls use Node built-in fetch; the Bedrock IAM adapter uses NodeHttpHandler. Vite is installed for building, but `npm start` executes `server/index.mjs` and the built-only `server/web.mjs`, not Vite dev/preview. No public route to development middleware was found in that source review. The high launch-editor issue is Windows-specific; no Windows exploit was executed here. Installation presence is not proof of public exploitability.

Local Node24.21.0 separately bundles vulnerable Undici7.29.1. **npm updates cannot patch that built-in copy.** Actual October24 Render build logs selected Node26.12.1; its official release includes fixed built-in Undici8.12.2. This candidate pins that same hosted version, rather than changing the deployed major/runtime. Read-only logs are bounded evidence, not a remote process inspection or an attempted hosted exploit.

Sources: [Undici high content-encoding advisory](https://github.com/nodejs/undici/security/advisories/GHSA-xjj6-f33q-929c), [Vite launch-editor advisory](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [Vite8.3.5](https://github.com/vitejs/vite/releases/tag/v8.3.5), [Node26.12.1 security release](https://nodejs.org/en/blog/release/v26.12.1), [Render version precedence](https://render.com/docs/node-version).

## Changes

Six intended files: package.json, package-lock.json, .node-version, .github/workflows/release-checks.yml, scripts/test-dependency-security.mjs and this receipt.

- Exact Vite8.3.5 pin; compatible npm Undici8.12.3 lock resolution. Required lock changes stay within Vite's build subtree (rolldown/platform bindings, OXC types, PostCSS/nanoid) and Undici. No force fix, override or unrelated dependency upgrade.
- .node-version26.12.1, bounded engines>=26.12.1<27, matching CI pin. No provider environment or runtime feature change.
- CI runs full high-severity audit and a bounded local security fixture before regressions/build/HTTP checks.
- Fixture distinguishes built-in/npm fetch, checks actual installed/locked versions, and uses owned loopback servers/isolated children. Excessive content-encoding/early-close must reject without process crash; ordinary fetch recovers; mismatched uppercase-SRI rejects while matching SRI succeeds. No uncaughtException interception, credentials, remote target or arbitrary CLI target. Child and server cleanup is bounded. It does not exercise Windows or exhaust memory.

## Actual local verification

- Official Node darwin-x64 archive SHA256 **b85c2ea4420ad0bc4abf2dc6cf1f55130ed681f1cabf60cf3f526e4c9e2712ff** verified; task-local runtime26.12.1/built-in Undici8.12.2. System installation unchanged.
- RED: both old local fetch clients actually crashed their disposable child on the first synthetic response, exit1/UND_ERR_SOCKET, no timeout. Reports `baseline-probes.json`/`.log` retained. No application/hosted process targeted.
- GREEN: both patched clients passed four actual HTTP assertions each, including recovery/positive integrity controls, with zero stderr and exit0; version/lock/install checks also passed (`security.log`).
- Fresh isolated install with lifecycle scripts disabled; full **and production audits zero known vulnerabilities**, `audit.log`/`production.log`. This is a point-in-time advisory result, not complete security certification.
- Full **240 tests/22 files passed**; build **1,654 modules**; all seven published synthetic HTTP fixtures **363 checks** passed (providers52/payments27/identity39/jobs134/support58/Chale19/work-status34). No test deadlines/assertions/isolation/worker/retry changes. Test-only/mocked providers, no real payments/inference/media/GPS/email.
- Independent read-only source review found no Critical/Important/Minor finding. Reviewer did not execute tests/provider calls. Receipt/final installed-tree/CI/hosted evidence still require final review/verification.

Historical QA-001 and the separate messaging candidate's272/279 UI timeouts/provider-startup failure remain retained. Passing security-candidate tests do not establish their cause. Application code and schemas are unchanged here.

## Release gate and rollback

At receipt creation **not published/deployed**. Require exact committed candidate/main CI logs, scoped diff/independent final review, then monitored update of the previously authorized existing ECOVIBES Free service. .node-version must be selected in actual build logs; do not infer it from source. Anonymous hosted checks and served artifact comparison remain separate from authenticated or physical acceptance. No schema delta; previous77ef0733 is structurally compatible but would restore vulnerable package versions/unbounded runtime selection. Prefer a reviewed forward correction; no rollback/restoration drill performed.

This is only the dependency gate. Chale two-account/quality/failure, genuine Connect/phones/slow-network/provider revocation, collector GPS/maps/Waste journey, SMTP/recovery/storage/restore/MFA/organization/payment-refund and rehearsed partner-demo/pilot/public acceptance remain incomplete. No paid service, secret read, email, financial/test record or public launch authorized by this receipt. Home and Waste image slots are the founder-confirmed later Canva/Figma targets.
