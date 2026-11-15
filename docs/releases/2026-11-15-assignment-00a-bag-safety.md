# Assignment 00A — Bag false-success correction

15 November 2026, Africa/Accra. Work began 14 November.

Status: LOCALLY BUILT and TESTED evidence recorded below. Prepared for independent release review; not publicly published, remotely CI-verified, merged, migrated, deployed, real-device verified or release approved. This assignment does not implement durable orders or live payments.

## Baseline and reuse

The task worktree is `Builds/EcoVibes Bag safety 00A`, branch `codex/bag-safety-00a-20261114`, based on production/main `56e0c2ebf83dfc2c89fccd0bc552691e4ae42b9b` (PR39), tree `e957b8480f63014d611ac620d24eeb85066fb99a`. A fresh 15 November GitHub/Render metadata read still reports that source and live deployment `dep-dbm05nm1egvs73atcvh0`. Provider “live” metadata is not a fresh endpoint-health or hosted acceptance test.

[PR26](https://github.com/konyahphilip-byte/life-of-kings/pull/26), head `5cd5554cf7ebfd7efa2008ff1124b68df08b9ac9`, and [PR40](https://github.com/konyahphilip-byte/life-of-kings/pull/40), head `e6a0e689fa60a07136a5a627d765d8e105364364`, contain byte-identical versions of `App.tsx` and `App.checkout.test.tsx`. Their respective SHA256 values are `37b4bbd8997ec4cea514f0be8f28618a498c5561d24bab056045e0830abb4975` and `4648384071aafafb3969dcf117d91f02a7b29023f0239d4b01605553341ce0bb`.

This candidate adopts the existing guard and copy changes onto current main, preserving later navigation/Home/Chale features rather than replacing the whole App with an older snapshot. It extends the existing four-case regression. It imports none of PR40's commerce refactor or PR41–45's cart/catalog/classification/publication chain. Auth24, Chale25 and other drafts are independent.

The original 15 registered worktrees are preserved; a 16th isolated task worktree was added. Their heads, dirty/untracked status and protected source/document/asset hashes are compared in local evidence. No existing dirty file was reset, discarded, moved or overwritten. Shared installed dependencies were reused only after confirming the package and lock files match the baseline; no dependency changes were made.

## Exact bounded files

| File | Purpose |
| --- | --- |
| `src/modules/App.tsx` | Reuse the nonfinancial Bag action and honest explanation; native modal naming, Escape/cancel, keyboard wrapping and opener-focus restoration. |
| `src/modules/App.checkout.test.tsx` | Reused guest/member × online/offline cases, account A/B/reload isolation, unavailable identity and keyboard regressions. |
| `src/modules/bag-safety.css` | Scoped ivory/emerald readability, dark appearance, touch targets, scrolling and focus indicators; no global redesign. |
| `scripts/test-bag-safety-browser.mjs` | Built-browser matrix, real browser connection loss, cached-shell reload, account switching, keyboard/layout/contrast checks and screenshots with synthetic accounts. |
| `scripts/test-navigation-browser.mjs` | Decode filesystem URLs correctly in spaced worktrees; use installed Chrome on macOS while retaining CI Chromium; accurately identify platform in the report. Existing assertions/deadlines remain. |
| `scripts/test-public-trends-http.mjs` | Test-only child working-directory URL decoding, fixing a reproduced isolated-API startup failure. Existing assertions and 15-second startup bound remain. |
| `.github/workflows/navigation-browser.yml` | Run the new Bag browser checks in the existing workflow and retain their synthetic artifacts for seven days. No remote workflow was triggered. |
| This receipt | Source, evidence, risks, dependency and release limits. |

No server, API contract, storage schema, service worker, identity policy, payment adapter, provider setting or production data change.

## Observed behavior

The former action announced an unsaved order and cleared the local cart. The corrected action has no order/payment call, no success toast and no cart mutation. It opens the existing EcoVibes ID workspace. The drawer says that checkout is not connected, the subtotal is not a payment quote, items remain, and no order or payment was created. Instructions point to the existing account Marketplace tab.

| Context | Outcome verified locally |
| --- | --- |
| Guest online | Items and quantity retained; honest message; account/sign-up destination reachable; no financial mutation. |
| Guest offline after loading | Same safe Bag behavior; cached shell can reload and retain the guest basket. Without an installed/cached worker, full offline navigation can fail; reconnect/reload restores the basket. |
| Confirmed member online | Own basket retained; actual account Marketplace tab and Your orders surface reachable with synthetic authorized API responses; no financial mutation from the Bag action. |
| Confirmed member offline | Existing in-memory basket retained and no checkout success. After a cached full reload, a private saved account basket remains untouched but is not displayed until identity is reconfirmed. Reconnecting and confirming that identity restores it. |
| Account A → B → A | Saved baskets remain separate, including a switch while the drawer is open and a subsequent reload. |

The existing service worker was inspected and tested; API responses were absent from its cache. The app still requires valid current identity for account content. Browser storage being cleared, full, disabled or evicted cannot provide durable basket guarantees; this repair does not create server cart persistence.

## Test evidence

Final results and exact commands are in `work/assignment-00a/final/gates.json`, with complete individual logs and the source hash manifest. The final local checkpoint records the commit/tree after commit creation. Test accounts, items and API responses are synthetic; none were seeded into production.

| Final local gate | Actual result |
| --- | --- |
| Focused Bag/identity/navigation | 35 passed / 0 failed in 4 files; includes 7 Bag regressions. |
| Full regression | 572 passed / 0 failed in 44 files. |
| TypeScript and production build | Exit 0; Vite transformed 1686 modules. Existing oversized index/Communications chunk warnings remain. |
| New built-browser Bag suite | 36 passed: 32 guest/member × online/offline × 320/390/768/1440px × light/dark cases, 2 real cached-shell reload checks, open-drawer account switching, and short landscape. |
| Existing navigation browser | 39 passed at 390/1280px; actual desktop Chrome on macOS, not Linux or physical phones. |
| Dependency audit | 0 vulnerabilities. |
| Dependency security | 8 local HTTP assertions passed with Node26.12.1 / built-in Undici8.12.2 / Vite8.3.5 / npm Undici8.12.3. |
| Existing isolated HTTP workflows | Provider, Paystack fixture, identity/roles, jobs, support, Chale, Chale work status, direct messages and public trends all exit 0. Public trends has 6 checks. No genuine external-provider acceptance. |
| Disposable PostgreSQL | 84 message-receipt checks passed on PostgreSQL17.10; no production migration. |
| Final gate runner | All 17 commands exit 0; all 7 code/test/style/workflow hashes unchanged through the run. |
| Preservation | All 15 original worktree heads/statuses and 3915 protected file hashes unchanged; inventory is now 16 including this new isolated task worktree. |

The four original tests reproduced the production defect (0 passed / 4 failed) before adopting the fix. Additional retained failures include the native-dialog test environment lacking methods (28 passed / 6 setup failures), actual text-size override, browser contrast sampling of the wrong background, keyboard wrapping (6 passed / 1 regression failed), and synthetic init/auth behavior during offline error pages. The final suite did not relax deadlines, assertions, worker limits or isolation. The original full gate run passed 572 tests but failed its public-trends HTTP startup gate; a filesystem diagnostic proved the encoded working directory did not exist while the decoded path did. That test-only path fix subsequently passed all six HTTP checks. Original outputs remain alongside final outputs.

Historical QA001 timing failures remain undiagnosed. Current green results do not establish their cause or sustained production monitoring.

Phone-width light/dark screenshots and short-landscape views were visually inspected. Automated checks verify named native modal/background isolation, keyboard wrapping/Escape/focus return, 44px buttons, at least 13px checked copy, at least 4.5:1 checked text contrast, no horizontal overflow and reachable short-screen actions. These are bounded checks, not a full accessibility certification.

## Security and compatibility review

The safe action is navigation-only and retains the established storage-owner boundary. No new financial authority, AI access, upload, external service, secret persistence or telemetry is introduced. The browser scripts block external destinations and use synthetic credentials only. Existing authorized workspace GETs (including order reads) can occur after navigation; zero financial mutations does not mean zero API requests.

The database and server contracts are unchanged and no migration is required. The candidate is based directly on current main. PR26 and the copy in PR40 are duplicate repair ancestry: do not merge them as separate implementations. If this candidate is approved and released, rebase/reconcile the wider commerce stack without overwriting the accepted guard or the new accessibility tests. Do not pull its other unaccepted features into this release.

A bounded source/diff/evidence self-review was performed. Independent release review remains required. The current candidate has not received remote CI or a submitted GitHub review. Local tests must not be relabeled as hosted or genuine-account acceptance.

## Release and rollback procedure

1. Obtain explicit approval for any public-source draft publication; the existing older publication approvals do not cover this new candidate automatically.
2. Independently review this exact bounded diff, its preserved failures, and the duplicate PR26/40 integration implications.
3. Require exact-candidate remote checks and explicit merge authorization. Recheck main, base compatibility, no schema change and the approved file manifest immediately before merging.
4. Require green exact main CI and separate explicit deployment authorization for the existing EcoVibes service. No deployment was performed here.
5. Verify the hosted guard, retained baskets, keyboard/responsive UI and no financial mutation, then genuine signed-in/phone behavior. Provider payments remain outside this assignment.
6. If a future release needs rollback, preserve the nonfinancial guard and honest copy. A complete revert to pre-repair main restores the known false-success/cart-loss defect and is not an acceptable safe rollback. Prepare/test a guard-preserving UI fallback or a bounded forward fix before deployment; do not erase browser cart keys. No production rollback drill or fallback deployment is claimed.

No paid dependency, service, infrastructure, platform fee, real payment or production operation was introduced. Core access remains GH₵0.

## Remaining limits and next smallest task

Independent review, specific public publication approval, exact remote CI, explicit merge/deployment approval and hosted/physical-device acceptance remain open. Safari, Firefox, native mobile apps, device screen readers and real account/provider journeys were not tested in this assignment. Native dialog support is required for the new modal behavior; desktop Chrome is the browser actually used locally.

The next task is independent review of this bounded candidate. Durable account-cart/order creation and the genuine seller-to-buyer journey remain the separate PR40–44 workstream; Request Market must not be substituted for those prerequisites. No durable orders or live payments were implemented or certified by Assignment 00A.


## Assignment 00A-R1 — quantity badge accessibility correction

15 November 2026. **LOCALLY TESTED — AWAITING INDEPENDENT REVIEW.** The independent 00A review required changes for the small quantity badge. The earlier evidence above is historical; this section records the new bounded revision. It is not release approval.

Parent: `fe8de3b9680ef1724f563c6033f5f52bfcac6f20`; existing branch `codex/bag-safety-00a-20261114`. The exact new commit and tree are recorded after commit creation in `work/assignment-00a-r1/checkpoint.json`. Only three files change from that parent:

- `src/modules/bag-safety.css`: one scoped rule for `.cart-drawer .drawer-head h2 span`, using the existing ink/canvas theme tokens and `.8125rem` (13px at the tested default size). No global typography change.
- `scripts/test-bag-safety-browser.mjs`: explicitly measure `#bag-title span`, composite transparent backgrounds to an opaque effective background, require at least 4.5:1 contrast and 13px, retain actual values, and check light/dark at 320/1440px before the existing matrix. The same measurement also runs in all 32 guest/member, online/offline, appearance and viewport cases. Unsupported image backgrounds fail measurement rather than producing a guessed pass. An optional output directory preserves the original 00A evidence; CI's default directory is unchanged.
- This existing release receipt: append the R1 evidence and remaining limits.

`App.tsx`, `App.checkout.test.tsx`, `src/styles.css`, basket storage, server/API contracts, dependencies and workflows are unchanged from the reviewed parent. Existing browser assertions and time bounds remain intact.

### Reproduced failure and actual correction

The new regression ran against the original populated Bag before the style change and failed its accessibility assertion. All four measurements were saved before failing, with original screenshots in `work/assignment-00a-r1/red/browser/` and exact output in `red-browser.log`.

| Appearance, both 320px and 1440px | Original computed colors / font / contrast | Corrected computed colors / font / contrast |
| --- | --- | --- |
| Light | `#818983` on `#f7f8f4`; 11px; **3.3715839974:1** | `#17251f` on `#f7f8f4`; 13px; **14.9057068232:1** |
| Dark | `#9ca79f` on `#101713`; 11px; **7.3152140609:1** | `#edf3ed` on `#101713`; 13px; **16.1560900724:1** |

Dark already passed contrast but failed minimum size. These are computed browser values, not assumed token ratios. The corrected 36 measurements all pass both thresholds. Before/after reports and screenshot SHA256s are in `work/assignment-00a-r1/checks.json`.

### Fresh R1 execution evidence

All 18 commands in `work/assignment-00a-r1/final/gates.json` exited 0; exact argument arrays, timestamps, duration and individual complete logs are retained. The pinned Node26.12.1 / Vite8.3.5 / built-in Undici8.12.2 / npm Undici8.12.3 runtime was used. Reproduction commands from this worktree, with that Node binary on PATH:

```sh
node node_modules/vitest/vitest.mjs run src/modules/App.checkout.test.tsx src/modules/App.identity.test.tsx src/modules/App.navigation.test.tsx src/modules/navigation.test.ts --reporter=json --outputFile=work/assignment-00a-r1/final/focused.json
node node_modules/vitest/vitest.mjs run --reporter=json --outputFile=work/assignment-00a-r1/final/full.json
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
BAG_SAFETY_OUTPUT=work/assignment-00a-r1/green/browser node scripts/test-bag-safety-browser.mjs
node scripts/test-navigation-browser.mjs
node scripts/test-dependency-security.mjs
```

Use fresh output folders for subsequent runs; the retained gate file also records the exact npm audit, nine HTTP workflow and disposable PostgreSQL commands, including the required local PostgreSQL binary path.

| R1 gate | Result |
| --- | --- |
| Focused Bag/identity/navigation | 35 passed, 0 failed / 4 files, including all 7 existing Bag regressions. |
| Full regression | 572 passed, 0 failed / 44 files. |
| TypeScript / production build | Exit 0 / exit 0; 1686 transformed modules. Existing index/Communications chunk warnings remain. |
| Bag browser | **40 passed**: 4 explicit badge checks plus all 36 previous safety cases; 36 actual badge measurements. |
| Navigation browser | 39 passed, 390/1280px. Original artifacts copied before rerunning; new copy is `green/navigation/`. |
| Dependency audit / security | 0 vulnerabilities / 8 local HTTP assertions passed. |
| Existing isolated HTTP workflows | All nine exit 0, including 6 public-trends checks; synthetic provider acceptance only. |
| Disposable PostgreSQL17.10 | 84 checks passed; no production migration. |
| Source stability | All seven code/test/style/workflow hashes in `final/source-before-gates.json` stayed unchanged throughout the final gates. |
| Preservation | All 15 original worktree heads/statuses and 3915 protected file hashes unchanged; inventory remains 16 including the isolated 00A worktree. All other tracked candidate files match the parent. |

Visually inspected `green/browser/badge-light-320.png`, `badge-dark-320.png`, `badge-light-1440.png`, `badge-dark-1440.png` and `short-landscape.png`. The new badge is readable and remains aligned with the heading. The full matrix checks no horizontal overflow, 44px buttons, native modal isolation, keyboard wrapping, Escape, focus restoration, truthful unavailable copy, no false success toast, no financial mutation, A/B basket isolation and retained reload/offline behavior. Screenshots use synthetic fixture items and identities, not production customer activity.

The original badge RED and all earlier 00A failures remain retained. A read-only shell manifest inspection was initially blocked by the shell's temporary-file restriction; the approved retry succeeded. This was an environment diagnostic, not an application test failure. No deadline, assertion, worker limit or isolation was weakened. Fresh green results do not diagnose historical QA001 timing failures.

### Risk, limits and review handoff

The production change is a scoped CSS rule. No JavaScript runtime behavior, data retention, telemetry, financial authority, migration, provider setting or paid dependency is introduced; core access remains GH₵0. The tests collect only synthetic UI styles and fixtures locally. No new network or performance-heavy effects are introduced.

This is desktop Chrome on macOS with emulated viewport sizes, not physical-phone, Safari/Firefox, native-app, screen-reader or hosted acceptance. No public publication, remote CI, merge, deployment or release approval occurred. Independent review of the new exact commit is the next smallest task, followed only by separately authorized remote/public and release steps.

**Guest → member → guest basket restoration is explicitly outside R1.** It remains a separate product/storage decision; no account baskets were combined or storage rules changed. Durable orders and live payments remain unimplemented by this assignment.

A rollback must retain the checkout safety guard and honest message. Do not revert the whole 00A repair or restore the inaccessible badge as an accepted release. If R1 causes an unforeseen UI issue, use a bounded forward style correction that continues to meet both badge thresholds; prepare/test that fallback before an authorized deployment. No production rollback drill is claimed.

R1 CSS SHA256: `e7d28fc962171081c71d49988d113dbc826239c76add414f1f5f787857ec9acc`. R1 browser-test SHA256: `c7bbea77e1bcbdbe923bc1084f6e6720ef0d26ecb879ebc8adbe9ec725779e42`. Receipt, screenshot and complete source/evidence hashes are recorded in the ignored R1 checkpoint/evidence files so the committed receipt does not attempt to contain its own Git SHA.
