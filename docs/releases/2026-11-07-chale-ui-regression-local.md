# Chale UI regression investigation — 7 November 2026

## Outcome and scope
LOCALLY BUILT follow-up on local082bc1b, whose exact13-file tree is public in [draft PR49](https://github.com/konyahphilip-byte/life-of-kings/pull/49). The nine files in this follow-up are separate: two application files, six test files and this receipt. They are not in PR49's tested head8ea1478c and have no public-source, merge or deployment approval yet.

The UI follow-up passed **47 focused tests**, **581/581 full tests in45files**, TypeScript/production build1685,8 dependency security assertions and npm audit0. The final complete run exited0 and reported all45 expected files. Compiled-code caching was enabled for the successful full local run; assertions, five-second test deadlines, one worker and fresh per-file isolation were retained. No Vitest configuration, dependency, API/server, schema, paid service or financial behavior changed.

## Investigation and actual fixes
1. A cold account-route test reproduced the loading fallback instead of its expected heading. The instrumented real module took about2.3seconds to import, beyond the query's default1second wait. Awaited rendering alone and vi.dynamicImportSettled experiments still failed; both experiments were reverted. Functional route/navigation tests now compile their actual lazy screen modules before the cases. Screens are not replaced with mocks. A new controlled pending→resolved test preserves explicit loading/success coverage alongside existing rejected-module, stuck-load, offline and safe-recovery tests. Route heading checks additionally require level1.
2. The composer Back/draft case unnecessarily rendered Home before opening Create. It now starts at the real Create deep link, then exercises the same composer→browserBack→reopen/draft assertions. No assertion was removed.
3. Personal-use cases await the real React render updates. The personal Messages action is selected inside its actual labelled region; account-role/no-POST assertions remain.
4. A separate focused regression proved that attaching the Chale header slot rendered Home twice. App stored that presentation-only DOM node in app-wide state. App now holds a stable ref; Sidekick resolves the committed target in its own layout effect/state. Only Chale updates to attach the portal. The test now observes one Home render, and a new real Sidekick test confirms the shortcut stays inside its header while the opened dialog stays outside it. Existing direct HTMLElement/standalone hosting remains compatible. No floating fallback is introduced when the explicit ref is pending.

This establishes two bounded issues: cold module loading coupled to functional assertions, and an unnecessary App-wide render. It does not establish a single cause for every historicalQA001 timeout or every worker-start failure. The reported render-count improvement is a synthetic App regression, not a measured physical-device speedup.

## Files
Application:
- src/modules/App.tsx
- src/modules/assistant/Sidekick.tsx

Tests:
- src/modules/App.launcher-host.test.tsx
- src/modules/assistant/Sidekick.display.test.tsx
- src/modules/App.navigation.test.tsx
- src/modules/App.routes.test.tsx
- src/modules/backend/BackendWorkspace.personal.test.tsx
- src/modules/ScreenBoundary.test.tsx

Documentation: this receipt. Runtime media, inference, authorization, account recovery and other pillar drafts are untouched.

## Exact validation and retained failures
Evidence is in primary work/chale-2-gateway-20261107.

- Original local13-file checkpoint:151 focused pass; full575/578 and UI28/32 failures retained. Separate PR49 remote CI later passed578/578 in44files on an identical tested merge, not these new UI changes.
- account-cold-diagnostic.json:0/1, actual Opening EcoVibes ID fallback; account-awaited-diagnostic.json and account-import-settled.json:0/1 each. The temporary trace source/log is retained in evidence, removed from the working test set.
- ui-repair-focused.json:36/38; ui-repair-final.json:37/38. Account and personal failures cleared, while Home/composer timing failures persisted.
- home-profile.json:1/1, CPU profiles and cpu-summary.json retained. The successful isolated Home profile does not prove all previous Home failures share a cause.
- launcher-render-red.json collected0; verbose collection diagnostic exceeded5seconds. launcher-render-scoped-red.json collected0 because the forks worker failed to start. Neither is a passing test or an assertion reproduction.
- launcher-render-warm-red.json:0/1, actual “expected1, got2” assertion, followed by the source fix and green regression.
- ui-host-fix-focused.json:47/47; ui-host-fix-build.log:TypeScript/build1685 pass. Existing large chunk warning retained.
- full-host-fix.json reported576passed/0failed but the command exited1 and the personal-account file was missing. It is **not a full pass**, despite JSON success:true. The original result is retained.
- Final full-host-fix-cached.json and verbose log:581passed/0failed,45/45files, process exit0,65.74seconds. Compiled-code/V8 bytecode caches only; no cached test results/state or changes to test deadlines/isolation. Default Vitest configuration is unchanged.
- ui-host-fix-security.json:8 HTTP security assertions pass, Node26.12.1/built-inUndici8.12.2/devUndici8.12.3/Vite8.3.5. ui-host-fix-audit.json:0 vulnerabilities.
- Pre-full tracked source hashes match; the new App render test predates the full run. git diff --check passes. Primary source changes from other ongoing work remain untouched; no historical145-file preservation pass is claimed.

A read-only local diagnostic found8GiB physical memory and about2.1GiB swap use. This is bounded resource metadata, not proof that swapping caused a particular test failure. No other processes were killed, resources purchased or timeouts enlarged.

## Public PR49 CI, separately verified
Approved local082bc1b/tree79095b9e is remote8ea1478ca72cf343e9cc16b5f010dcb96c72bf4a. Release42392015906 and Browser42392015968 passed. Decoded logs confirm tested merge1c1b7b488a814128d139f2a05837d0b3b2609dfe; remote comparison has zero differing files.578/44/build1685/audit0/security8, all existing release HTTP steps, disposable PostgreSQL18.6 receipt checks and39 Chromium desktop/narrow checks passed. Artifact13581389981/digest3efe229e4644f1a3b6aed80a9271c73817f98cc187d71379a1adfd110919b3ae is registered; its bytes/screenshots were not newly inspected in this session. No hosted or physical-phone acceptance.

## Review, release and next task
Bounded author review, not independent approval: checked header ref commit timing, no transient floating launcher, compatibility with the existing HTMLElement prop, portal/dialog placement, account-remount behavior and preservation of character-off chat. Functional route assertions/permission checks remain; pending/failure behavior has separate controlled coverage. Real browser geometry/keyboard/device checks on the final follow-up source remain required.

These nine files form a separate reviewable local commit; its exact SHA/tree is recorded in the work evidence. Before publication, obtain explicit approval for these additional public UI sources; the earlier approval covered13other files. Then rerun exact-source release/browser CI on PR49, inspect relevant screenshots and obtain independent review. No merge or deployment is authorized. Neither PR49's green CI nor this local full pass closes actual Auth/MFA/two-account/model/media/GPS/finance/email gates.

GH₵0 platform fees remain. No paid inference/fallback, new resources, private-conversation training, production data mutation or real payments.

References: [React act](https://react.dev/reference/react/act), [Testing Library async methods](https://testing-library.com/docs/dom-testing-library/api-async/), [Vitest compilation cache and isolation](https://vitest.dev/guide/improving-performance). Installed library source/type definitions were checked; live documentation defaults can differ from the pinned installed version.
