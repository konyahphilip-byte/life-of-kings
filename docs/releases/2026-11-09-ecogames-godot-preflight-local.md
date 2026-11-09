# EcoGames Godot source inspector — local delivery, 9 November 2026

Status: LOCALLY BUILT and independently reviewed. New source is not public, remotely CI-tested, merged, activated or deployed. Parent PR51–55 remain open drafts; parent migrations remain UNAPPLIED. No new migration, API, dependency, binary asset, provider, paid resource, AI call or fee is introduced.

## Actual increment

The existing Vault & Studio now offers an explicit on-device Godot source inspection. It recognizes root project.godot, parses the supported Godot4/config5/text-format3 subset, constructs file-reference edges, and explains missing source, binary assets, ID/UID/case/type conflicts, malformed structures and unsupported plugins/languages/dynamic references. Friendly manual repairs accompany issues. Exact original text is unchanged; there is no automatic rewrite, upload, asset fetch, script/plugin/native execution or AI transmission.

The current report is bound to the active owner and exact current draft; edits, cancellation, account changes and disabled state invalidate it. Source and reports remain in memory. Supported-reference success is not script compilation, engine import, a security certification or playability. Limits remain bounded and visible; details and official format references are in [GODOT_PREFLIGHT.md](../ecogames/GODOT_PREFLIGHT.md).

A future typed Chale tool contract separates sanitized explain consent, selected-source processing consent, prepared diffs and confirmed application, with server-derived authority, expected revision/source hashes and idempotency. It has no live endpoint/model/edit executor. Turning off the optional character remains unrelated to Chale chat functionality.

## Source and dependency identity

Local branch: codex/ecogames-godot-preflight-20261109.
Base: 6924ff83e9eda0ef64b3c87a6406fa3f8a7558d1 / tree0ac0a486e280ba99178f82f11be13962b689536d.
Final commit/tree, exact file manifest and SHA256s are recorded in ignored work/ecogames-godot-preflight-20261109/checkpoint.json, manifest.json and source-hashes.json after committing.

Fresh PR51–55 metadata, changed files and current workflows were inspected; all are draft/open/unmerged and both workflows pass. Exact order: hub51 → Control52 → Vault53 → export54 → folder-import55. Full heads/checks are in GODOT_PREFLIGHT.md and pr-reconciliation.json.

PR55 public dd07c2ba5974c5a63015cc92b27d6cb3c9e82e9a and CI merge856fe5d9b4d99cbcfb4344c70b532577ccfe7065 share tree8586533315bdae3d68122b4555e6b4b17a7c86c4. Its14published blobs match local5411bcf; only3excluded prior local-only publication receipts differ in the complete trees. Actual retained Release42585263187 and Browser42585263372 logs show748/748tests53files37.97s/build1700/audit0/security8/folderBrowser34. CI native import remains UNVERIFIED. VAULT_STUDIO.md and CONTROL_HUB_INTEGRATION.md now distinguish public draft/remote evidence from local/native/production acceptance; dated historical receipts remain.

## Files

- shared/game-godot-preflight.mjs, its declaration and RED-first regression tests: bounded tokenizer, reference graph, findings and sanitized summary.
- shared/game-project-tools.d.mts: future explain/prepare/apply interface only.
- GameGodotInspector.tsx and tests; GameVaultStudio.tsx and vault-studio.css: explicit local inspection, draft/owner/cancel/focus guards and readable results.
- scripts/test-game-godot-preflight.mjs and its regression tests: trusted-only static/ZIP/native checks and strict native-outcome classification.
- scripts/test-game-godot-preflight-browser.mjs: built-app/local API synthetic-account browser acceptance.
- Existing release/browser workflows: new repeatable checks/artifacts, no engine installation.
- GODOT_PREFLIGHT.md, VAULT_STUDIO.md, CONTROL_HUB_INTEGRATION.md, this receipt and CONTINUATION.md: scope, dependency evidence, release gates and next stage.

No server/database/auth/payment/race implementation is changed.

## Repeatable evidence

All commands use task-local Node26.12.1, Vite8.3.5, built-in Undici8.12.2 and development Undici8.12.3. SystemNode24.21 is unchanged. Evidence folder: work/ecogames-godot-preflight-20261109/.

| Check | Actual result | Evidence |
| --- | --- | --- |
| Focused parser + inspector UI + existing Studio | 71/71,3files | focused-last.log |
| Native outcome regression after independent review | 10/10 | native-acceptance-green.log |
| Final complete Vitest suite | 801/801,56files,77.74s | full-final-accepted.json/log |
| Production TypeScript/build | PASS,1702modules | build-final-accepted.log |
| New built-app Chrome/local API | 24/24 at390/1440, two synthetic accounts | browser/report.json, browser-final.log |
| Existing selected-folder import | 34/34 at390/1440 | folder-browser-retained.log |
| Optional verified local Godot + static/ZIP | 5/5, trusted fixed fixtures only | native-final.log, fixture-report.json |
| Dependency audit | 0 vulnerabilities | audit.json |
| Bounded dependency security | 8/8 HTTP/version checks | security.log |
| Source preservation | All135protected primary source/assets match | root-preservation.json |
| Final source identity | Code/test/CI hashes match pre-final-suite snapshot | source-hashes.json |

Commands:

```sh
node node_modules/vitest/vitest.mjs run shared/game-godot-preflight.test.mjs src/modules/games/GameGodotInspector.test.tsx src/modules/games/GameVaultStudio.test.tsx
node node_modules/vitest/vitest.mjs run scripts/test-game-godot-preflight.test.mjs
node node_modules/vitest/vitest.mjs run --reporter=default --reporter=json --outputFile=work/ecogames-godot-preflight-20261109/full-final-accepted.json
npm run build
node scripts/test-game-godot-preflight-browser.mjs
node scripts/test-game-folder-import-browser.mjs
node scripts/test-game-godot-preflight.mjs
```

The final command without GODOT_BIN explicitly marks native import UNVERIFIED. Separate native acceptance selected only the previously verified task-local official Godot4.7.2 macOS binary; no new download/install. Archive SHA256 c58a24e31d720be9d62f60cb5627c4e695fb72f21b0cfe1bc9ccaa9a3b3ba63e; actual installed binary matches its archive entry SHA256 c7cccbf8fb143e34e02fd6521e09be2c2b974f0d5db080b19071c9c570718ccf; Apple codesign validation passes. Portable editor data is task-local and HOME unchanged.

Native positive: six exact source files independently extracted from ZIP; Node3D scene references script/material with nested paths; headless --editor --import exits0/noERROR and creates editor cache. Native negative: fixed undefined ExtResource at res://scenes/main.tscn:3 emits the precise expected parse/load errors despite exit0. Acceptance requires completed process/no error/signal/exit0, exact intended messages and no unrelated ERROR lines. It never runs a creator folder. Native logs are separate from static engineExecuted=false reports.

Browser evidence covers explicit/offline inspection, focused results, graph, no horizontal overflow, unchanged durable source/revision, invalidated old reports, missing source/assets, no inspector writes/AI, cancellation/focus and accountB isolation. The only permitted app mutation outside this feature is the existing presence heartbeat with exact {} body; no source enters it. Screenshots inspected. Local Chrome width is not a physical low-end phone or hosted real-Auth test.

Parent PostgreSQL/HTTP evidence is retained history; no new database migration or server behavior requires rerunning those historical schema suites in this client-only increment. New actual local API/browser checks were executed. No hosted source/schema/provider change occurred.

## Retained failures and fixes

- Initial module/UI missing-module REDs preceded implementation; initial tool-string syntax failure occurred before file writing/test dispatch.
- Incremental parser REDs, resource-ID string handling, C#/native coverage and an unsafe-edge test locator expectation are retained. The unsafe-path assertion was not removed; edge selection now identifies its actual originating file.
- Independent review reproduced3P2 false-all-clear gaps: threaded ResourceLoader path, invalid project-setting RHS and duplicate header UID. RED3/27skipped then30green; all closed.
- Strict header/version tests RED4/30skipped; UID-metadata tests RED2. A quote typo during implementation caused module collection/build failures, including full702pass/2fail/7failedsuites; repaired and retained in full.json/full-final.log and strict-syntax logs.
- Immediate focus assertion reproduced68pass/1fail; useLayoutEffect fixed timing without relaxing the assertion/deadline.
- Initial browser harness treated the preexisting empty presence heartbeat as an inspector upload; observed path/body and actual App source identified it. Harness now permits only that exact empty heartbeat, while zero inspector writes/AI assertions remain.
- Independent native review reproduced7fail/3pass: any ERROR previously counted as the intended negative fixture result, even with timeout/crash/unrelated errors. Strict completed/exact-error acceptance fixed it; independent10case probe and actual native rerun closed it.
- Earlier785green and791green full runs are superseded by final801green; failed runs are not overwritten. Historical QA001/Home timing cause remains undiagnosed. No deadline, assertion, worker, isolation, quota or existing source cap was weakened.

## Review, release and remaining gaps

Independent source/UI/privacy/harness/docs review has no remaining actionable finding in this bounded increment. Final full report/source hashes are separately recorded; passing synthetic checks are not hosted acceptance.

No authorization is granted by this receipt. This new source needs scoped public draft publication approval and exact remote CI. Preserve draft status. Then current-main/dependency compatibility, review, explicit parent migration/merge/activation/deploy approval, guard-preserving rollback and hosted real-account/physical-device/retention/restore/capacity checks remain. No migration/merge/deployment was performed.

Next smallest implementation: private owner/project-bound binary asset manifest and explicit selected-file upload through the existing authorized storage service, with exact-byte/MIME/quota/duplicate/retention/expiry/isolation tests. Isolated playable builds, preview runners and Chale visual-edit proposals require separate executable/permission boundaries and verification. Generation, public publishing, multiplayer and AAA RumbleRush2 remain unfinished. No fake gameplay or source import is claimed.

No new paid dependencies, paid inference, service or platform fee. GH₵0 core access retained.
