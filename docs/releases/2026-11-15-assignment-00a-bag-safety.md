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


## Assignment 00A-R3 — content-responsive Bag action

15 November 2026. **LOCALLY TESTED — AWAITING INDEPENDENT REVIEW.** Parent `7f1d27fb1e8fa0210ee30b8fdb85f645fc72eea3`, existing isolated branch `codex/bag-safety-00a-20261114`. R2 verified the badge correction but required changes for an inherited enlarged-text action defect. R3 corrects that defect only. The new commit/tree are recorded after commit creation in `work/assignment-00a-r3/checkpoint.json`; no release approval is claimed.

### Exact bounded change

- `src/modules/bag-safety.css`: two scoped rules override the inherited action height with `height:auto`, retain `min-height:48px`, add 12px internal padding and prevent SVG shrinking. Existing `.9375rem` text, 1.4 line height, wrapping, colors and badge styling remain.
- `scripts/test-bag-safety-browser.mjs`: measure actual text-node `Range.getClientRects()` and SVG rectangles, require padded containment, readable text/line height, 16px icon, viewport visibility and unobscured hit points. Reject hidden/clip workarounds. Add text-size/responsive cases and forward keyboard wrapping while retaining all existing safety and badge assertions.
- This existing receipt: append R3 measurements, evidence, preservation and limitations.

`App.tsx`, `App.checkout.test.tsx`, `src/lib/storage.ts`, `src/styles.css`, server/API contracts, dependencies and workflows remain byte-identical to the parent. No Contact Seller action, durable checkout, live payment or wider Marketplace feature was implemented. Future actions should use the same content-responsive sizing principles without duplicating business behavior.

### RED before implementation; actual correction

The new test ran before the CSS edit and failed its actual text-containment assertion in **both** light/dark 320×844px, 200% text contexts. Original computed rectangles and screenshots remain in `work/assignment-00a-r3/red/browser/`; complete output is `red-browser.log`. A clickable button and no horizontal overflow were insufficient: the text escaped its colored surface.

At 320px / 200%, both appearances preserve 30px text and 42px line height with two label lines:

| Measurement | Before | After |
| --- | --- | --- |
| Button height | 48px | **110px**, content-driven |
| Button top / bottom | 738.78125 / 786.78125px | 733.78125 / 843.78125px after scrolling |
| Label first-line top | 723.78125px: **15px outside** | 749.78125px: **16px inside** |
| Label final-line bottom | 800.78125px: **14px outside** | 826.78125px: **17px inside** |
| Navigation icon | 16×16px | **16×16px**, contained and vertically centered |

Corrected 320px button heights at 100% / 150% / 200% text: **48 / 57.5 / 110px**. Text sizes: **15 / 22.5 / 30px**; line heights: **21 / 31.5 / 42px**. Default height remains 48px. Text was not shrunk, clipped or forced to stay on one line.

The badge rule and thresholds are unchanged: 13px at default size, 19.5px at 150%, 26px at 200%. All 72 badge samples pass; contrast remains **14.9057068232:1 light** and **16.1560900724:1 dark**.

### Fresh R3 execution evidence

All **18** commands in `work/assignment-00a-r3/final/gates.json` exit 0. Exact argument arrays, runtime binary, timestamps, durations and complete logs are retained. Pinned Node26.12.1 / Vite8.3.5 / built-in Undici8.12.2 / npm Undici8.12.3 were used; system Node and dependencies unchanged. Reproduction from this worktree with the pinned Node on PATH:

```sh
node node_modules/vitest/vitest.mjs run src/modules/App.checkout.test.tsx src/modules/App.identity.test.tsx src/modules/App.navigation.test.tsx src/modules/navigation.test.ts --reporter=json --outputFile=work/assignment-00a-r3/final/focused.json
node node_modules/vitest/vitest.mjs run --reporter=json --outputFile=work/assignment-00a-r3/final/full.json
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
BAG_SAFETY_OUTPUT=work/assignment-00a-r3/green/browser node scripts/test-bag-safety-browser.mjs
node scripts/test-navigation-browser.mjs
node scripts/test-dependency-security.mjs
```

Use new evidence folders for subsequent runs. The gate record also contains the exact npm audit, nine isolated HTTP and disposable PostgreSQL commands and required PostgreSQL binary path.

| Gate | Fresh R3 result |
| --- | --- |
| Regression-first browser | RED in both reported light/dark contexts; original failure output and screenshots retained. |
| Focused / full regression | **35 passed, 0 failed / 4 files** (including 7 Bag cases); **572 passed, 0 failed / 44 files**. |
| TypeScript / production build | Exit 0 / exit 0; 1686 modules transformed. Existing index/Communications size warnings remain. |
| Bag browser | **78 passed**: 40 existing checks, 2 direct regression contexts, 36 text-layout contexts; 70 action measurements, 72 badge samples. Browser run 139.979 seconds. |
| Width/text/appearance | 320/390/768/1440px × 100/150/200% root text × light/dark: 24 cases; 390×320 short and 844×240 landscape × all three sizes × both appearances: 12 further cases. |
| Navigation browser | 39 passed. Prior artifacts copied before rerun; fresh artifacts copied to `green/navigation/`. |
| Dependency audit / security | 0 vulnerabilities / 8 local HTTP assertions passed. |
| Isolated HTTP / PostgreSQL | All nine workflow scripts pass; 6 public-trends checks. PostgreSQL17.10: 84 disposable checks. No genuine provider or production acceptance follows. |
| Source stability | Seven code/test/style/workflow hashes stable through final gates; all other tracked candidate files unchanged from parent. |

Every actual label line and the icon must stay inside the button with at least 8px clearance (0.5px subpixel tolerance); actual CSS padding is 12px. The icon remains at least 16px and centered, intended text size/line height cannot decrease, and the complete action/hit points fit the viewport after native modal scrolling. No horizontal overflow, Tab/Shift+Tab wrap, Escape and focus restoration remain checked.

The original guest/member × online/offline scenarios still preserve baskets, navigate to the existing account workspace, show honest unavailable copy, avoid false success and send no financial mutation. Cached-shell reload and A/B account isolation pass. No account baskets were combined.

Visually inspected original light RED, corrected 320px / 200% light/dark, 390px / 150% light, 1440px / 200% dark, 844×240 / 200% light and 390×320 / 200% dark screenshots. The action remains legible on its emerald surface and the drawer scrolls to reach it. Screenshot hashes, numeric results and exact commands are in `work/assignment-00a-r3/checks.json` and `final/gates.json`.

Two-frame synchronization follows the observed R2 browser-rendering diagnostic for synthetic root text changes. No arbitrary sleep, deadline extension or assertion/worker/isolation weakening was used. All previous failures remain retained; historical QA001 timing failures remain undiagnosed.

### Preservation and one auxiliary-document exception

All **15 original worktree HEADs/statuses and 3915 protected file hashes remain unchanged**. Inventory stays 16, including this isolated task worktree. All other candidate tracked files match the parent.

Of 157 earlier R1/R2 evidence files, 156 retain their original hashes. During this run, the auxiliary `work/assignment-00a-r2/REVIEW.md` acquired exactly one newline between “wider” and “redesign”; author/cause is not established. The preservation assertion caught this difference before writing the receipt. The current note and its original manifest were **left untouched**. Removing only that line-wrap in memory reproduced the original SHA256, and that hash-verified original text is archived separately as `work/assignment-00a-r3/R2-REVIEW-original-hash-verified.md`. Both hashes, the diagnostic failure and the exact exception are retained in `preservation-exception.json` and `receipt-guard-failure.json`. This is an evidence-document difference, not an application test failure or permission to overwrite unrelated work.

### Limits, risk and review handoff

Local desktop Chrome/macOS with synthetic identities and emulated viewport/root text sizes only. Physical phones, Safari/Firefox, native apps, device settings, screen readers, real-account/provider and hosted acceptance remain unverified. No new assets/effects, dependency, telemetry, retention, permission/API/financial authority, credential handling or fee was introduced; core access remains GH₵0.

No public-source publication, remote CI, merge, deployment, production migration, provider-setting change or payment activation occurred. Guest→member→guest basket restoration remains a separate product/storage decision. Contact Seller, durable orders and live payments remain outside this assignment.

Next smallest task: independent review of the new exact commit, original RED/final GREEN and preservation evidence, before separately authorized remote publication/CI and release steps. A future fallback must preserve honest unavailable copy, navigation-only action, private baskets, the accessible badge, content-responsive action and keyboard/modal behavior. Do not revert to pre-00A false success or accept the known fixed-height defect. No operational rollback drill is claimed.

R3 CSS SHA256: `5bfd16396eacd367bb2970c549e8022954b2610627277f3dd521ea2d8da89865`. R3 browser-test SHA256: `d8f44da63d23e242c0a64d8cb0d8c654a6215118820ac99afb1f0f63bd4c553c`. Receipt/source/screenshot hashes and the exact post-commit revision are in the R3 evidence/checkpoint, avoiding a self-referential Git SHA in this receipt.


## Assignment 00A-R5 — consolidated Bag corrections and test recovery

15–16 November 2026. **BLOCKED** for release: the three Bag findings are locally repaired and the current verification passes, but all 18 retained R4 regression failures still have unresolved historical causes. Do not equate fresh passes with dependable historical attribution or release approval. Parent `aad44d897961e12cc2d8193ca199c83fda97fa06`, same isolated branch `codex/bag-safety-00a-20261114`. The exact new commit/tree are recorded after the local commit in `work/assignment-00a-r5/checkpoint.json`.

### Bounded implementation and reuse

- `src/modules/App.tsx`: preserve the native dialog, existing storage/account boundary and navigation-only checkout guard. After removing a focused product, restore focus to the next row, otherwise the preceding row, otherwise Explore. The pending focus target is bound to the current storage owner and discarded on an account mismatch. No request, financial action, identity rule or basket merging was added.
- `src/modules/bag-safety.css`: scoped readable empty-state text and a content-responsive 48px-minimum Explore action; allow the subtotal label/amount to wrap or stack and preserve the full number. Earlier badge and primary-action corrections remain.
- `src/modules/App.checkout.test.tsx`: three synchronous removal-focus regressions and one exact six-unit subtotal/preservation assertion. Existing account, offline, navigation, modal and safety assertions remain.
- `scripts/test-bag-safety-browser.mjs`: actual rendered empty-state/amount/focus assertions; 108 empty/single/multiple layout cases; large actual GHS and explicitly display-only currency-length fixtures; unique default evidence folders and a 2GiB free-space guard. Existing checks and thresholds remain.
- This receipt: append evidence and limitations. No global redesign, dependency, workflow, server/API or database change.

The checkout guard remains byte-identical to the parent; SHA256 of its exact source line is `faadc4b19f395ac89123bba1a21b573de58bb9c421cf7d62fe9ef4e8ae452dc5`. It only closes the Bag and navigates to EcoVibes ID. No order/payment success or financial mutation is introduced.

### Environment investigation and retained failures

The interrupted R4 browser run failed with `ENOSPC` while writing `390-dark-member-online.png` (zero-byte file). Its source call, partial checks and error are preserved. The volume initially had approximately 156MiB available; workspace and temporary directories share that volume. Exact inventory, caches/sizes and diagnosis are in `environment-inventory.json`, `browser-interruption.json` and `PHASE1.md`. No worktree, cache, asset or other user file was deleted. Subsequent observed free capacity recovered without any agent cleanup; this does not establish who freed it. Testing resumed only after adequate actual capacity was observed. The complete corrected browser command began with **3,515,289,600 free bytes** and ended with **3,495,813,120**; its sampled capacity stayed between **3.25 and 3.27GiB**, above the 2GiB guard.

All 10 initial and 8 subsequent R4 failures were individually reviewed. Final classification is **14 timeouts, 2 duplicate-control errors and 2 missing-UI errors; all 18 historical causes remain UNRESOLVED release blockers**. `failure-classifications.json` remains the original diagnostic; `failure-resolution.json` corrects one diagnostic symptom label and maps every case to its fresh parent/focused/full result. All 18 corresponding cases pass in the unchanged-parent 35-test baseline and current 39/576-test runs. This establishes nonreproduction, not causation.

A private installed-Vitest diagnostic reproduces how an unguarded timed-out async body can resume after cleanup and mount during a later test. Four expected-outcome diagnostic checks pass. This proves a possible harness mechanism; it does not attribute the original 18 failures to that mechanism, disk pressure, or a specific application defect. Historical QA001 remains undiagnosed. No existing test deadline, assertion, worker count or isolation setting was weakened.

### Regression-first evidence and before/after behavior

Before application edits, `accessibility-red/checks.json` records **12/12 expected failing assertions** across the empty-state, subtotal and four removal-focus outcomes in both appearances. A second counterfactual serves the preserved parent build and detects all three findings in both appearances. The final exact unit assertions, run against the preserved parent App through a private resolver, produce **3 direct BODY-versus-control failures and 1 passing unchanged-calculation test**. The earlier wait-based parent run timed out in those three tests and is retained separately. No source reset or checkout was used.

| Finding | Before | Corrected behavior |
| --- | --- | --- |
| Empty description | 10px; light contrast 3.5962:1; dark contrast 6.5036:1 | 14px at default, 21px at 150%, 28px at 200%; ink contrast **15.8989:1 light / 14.3637:1 dark**. |
| Empty Explore | 10px text / 34px target | 15px / 48px minimum; 30px text and 110px content-driven height at 320px/200%. Full label and 16px icon contained. |
| Six-unit subtotal, 320px/200% | `GH₵540.00` ends at x323.90625 beyond the x304 padded edge; drawer scrollWidth324/clientWidth320 | Same exact value; label and amount can stack, amount ends at x197.015625, drawer width320 with no horizontal scroll. |
| Focused row removal | Focus falls to BODY | Next, preceding and final empty-state action receive focus; modal containment, Escape and return to opener pass. |

The large actual fixture remains `GH₵246913.56` (2 × 123456.78), including after reload. One complete browser attempt failed after 188 passing checks because the new test incorrectly expected grouped `GH₵246,913.56`. The product formatter has always used the ungrouped form. Only that new expectation was corrected; product values/formatting and every existing assertion remain unchanged. The failed run is retained in `final/gates.json`, `final/bag-browser.log` and `green/browser/checks.json`.

Additional GHS/USD/CHF strings stress layout only; they do not establish currency conversion, supported financial currencies or a payment feature. Four final 320px/200% light/dark empty/subtotal screenshots were visually inspected. No clipped money, hidden action text or horizontal drawer overflow was observed in the passing matrix.

### Actual verification and exact source binding

- Unchanged parent: **35 passed / 0 failed / 4 files**, before application edits.
- Corrected focused: **39 passed / 0 failed / 4 files**. Full regression: **576 passed / 0 failed / 44 files**, no skips.
- TypeScript and Vite production build: exit0. Existing index/Communications chunk-size warnings remain; no performance certification follows.
- Dependency audit: **0 vulnerabilities**. Existing security script: **8 assertions**, exit0.
- Nine isolated HTTP workflow scripts: exit0. Disposable PostgreSQL17.10: **84 checks**, exit0. No genuine provider or production database was used.
- Navigation browser: **39 checks**, exit0. Existing artifacts were copied with a manifest before rerun; fresh results are in `green/navigation/`.
- Corrected complete Bag browser: **194 checks**, zero failures. Includes original 78 checks, 6 direct consolidated checks, 108 layout states and 2 large/currency-length fixtures. The 108 states cover empty/single/multiple × light/dark × 100/150/200% × 320/390/768/1440px plus 390×320 short and 844×240 landscape contexts. Keyboard wrap, Escape, opener return, readable text, contained icons, touch targets, no horizontal scroll, account/offline baskets and zero financial mutations remain checked.

The successful full Bag browser command took **723.304 seconds** on this shared Mac; the earlier failed attempt reached 188 checks in 457.2 seconds. This is not a controlled performance comparison or a cause diagnosis. The unchanged `navigation-browser.yml` job has a **12-minute overall limit**, including installation/build/navigation. Its suitability for this expanded matrix remains UNVERIFIED and is a further remote-CI release gate. No timeout was raised or assertion/matrix reduced.

The first 18 commands in `final/gates.json` passed; its 19th command is the retained browser-format-expectation failure. The successful replacement browser command is in `final-browser/commands.json`. Its before/after hashes match. `final-browser/source-before.json` establishes that only the test's large-amount expectation changed after the previous gates; application, unit tests, styles, build/security/API inputs and all other recorded source hashes are identical. Those unrelated gates were not rerun merely for reassurance. No claim that the earlier 19-command attempt passed is made.

Exact argument arrays, runtime, timestamps, durations, capacities and outputs are retained in those command records. Pinned Node26.12.1 / Vite8.3.5 and existing dependencies were reused. Test commands include `node node_modules/vitest/vitest.mjs run`, `node node_modules/typescript/bin/tsc -b`, `node node_modules/vite/bin/vite.js build`, `node scripts/test-dependency-security.mjs`, the existing isolated workflow scripts, `node scripts/test-navigation-browser.mjs` and `BAG_SAFETY_OUTPUT=<fresh-folder> node scripts/test-bag-safety-browser.mjs`. Use a fresh output folder for every subsequent run; do not overwrite RED evidence.

### Preservation, risk, fallback and next task

All **15 original worktree HEADs/statuses and 3915 protected file hashes remain unchanged**. Inventory remains16 including this task. The checked 386 prior evidence files retain their R4-baseline hashes; R5 did not alter the previously documented R2 auxiliary-note exception. Other candidate files match the parent. Final manifests, exact five-file hashes, disk samples and post-commit identity are in `preservation-after.json`, `source-hashes.json`, `checks.json` and `checkpoint.json`.

The application change uses existing local state, system fonts and bounded DOM focus; it adds no media, animation, request, permission, telemetry, paid dependency, retention rule or fee. Core access remains GH₵0. No public publication, remote CI, migration, merge, provider-setting change, payment activation or deployment occurred. Local desktop Chromium with synthetic identities, browser offline mode and root-font scaling is not hosted, physical-phone, native-app, browser-zoom, Safari/Firefox or real screen-reader acceptance.

A future fallback must preserve truthful unavailable copy, navigation-only guard, private baskets, badge contrast, content-responsive actions, wrapped totals and modal/focus behavior. Prefer a tested bounded forward correction; do not restore pre-00A false success or use the known inaccessible parent as an accepted fallback. No production rollback drill is claimed. PR26/PR40 overlap remains subject to independent integration review; this assignment adopts neither wider commerce chain nor duplicate old repair.

**Next smallest task:** diagnose the retained intermittent App-shell failures with controlled, cancellation-aware test instrumentation, then independently review the exact R5 commit and complete separately authorized remote/release gates. The current green runs do not close those blockers. Guest→member→guest restoration remains a separate product decision. Contact Seller, durable orders, live payments and wider Marketplace development were not implemented.
