# EcoGames selected-folder source import — local receipt
Date: 9 November 2026. Status: **LOCALLY BUILT**; not public, remotely CI-tested, merged, activated or deployed.

## Delivered change and buyer/creator value

The existing Vault & Studio now imports selected text source while keeping relative folders intact. A creator can choose a local project folder, inspect a metadata-only preview, select individual supported files, read those files into the existing draft and explicitly choose private storage before saving. This avoids flattening scene/script references and repeated manual path entry. The isolated browser journey imports five real synthetic files, saves/reopens them and independently extracts a source ZIP with the same paths and exact bytes. No real creator adoption, time saving or hosted-user result is claimed.

The browser's official selected-folder file input is used only after the user opens this feature and sees an explanation. No arbitrary filesystem handles, library scanning, contacts, camera, microphone or new device permission is requested. Unsupported folder selection offers the existing individual-file picker; it does not pretend to preserve folder metadata. Actual browser support and user-operated system-picker acceptance remain device checks.

Selection alone reads metadata, not file contents. Initially no source is selected. A distinct Read selected source into draft action reads the chosen subset; a separate existing private-storage checkbox and Save project action authorize upload. Device access, local reading and private storage remain separate choices. No source enters AI, analytics, public publishing or browser persistent storage through this increment. Ordinary source files can contain private data: filename filtering does not identify all secrets. The user must select appropriate source, review it and choose storage deliberately.

## Bounds, ownership and failure behavior

Preview accepts at most1000 metadata entries and100 supported source candidates. Hidden segments, dependency/build caches and binary/non-source formats are skipped without content reads. Only supported candidates and a skipped count are shown. One selected root name is removed; relative paths are preserved rather than guessed or silently renamed. The selected root may contain spaces/Unicode, while inner paths retain the existing ASCII-compatible source-path contract. Empty folders and binary assets are not imported.

The shared portable-path helper is reused by import and the existing ZIP exporter. It rejects traversal/absolute/drive paths, hidden names, reserved Windows device names, trailing dots, whitespace, file/directory conflicts and inconsistent folder capitalization. Existing Vault server validation is unchanged for compatibility. New imports never overwrite an existing source path. Select fewer files, or explicitly rename/remove current source, before retrying a collision.

The existing twenty-file/project,32768-byte/file and128000-byte canonical combined-Vault limits are unchanged. Metadata is rechecked before reads; sequential reads verify actual size, valid UTF-8 and existing content restrictions. BOM, CRLF, emoji and empty source are preserved. A full multi-project validation runs before replacing the draft, so failures add nothing partially. The existing API still authorizes the actual account, validates content and confirms durable saves; client checks alone do not provide server security.

A ten-second local read deadline and explicit Cancel stop subsequent reads. An already-started File.arrayBuffer read cannot itself be cancelled; its bounded late result is ignored. Account change/unmount invalidates the operation. Preview references stay in component memory and are discarded on cancellation, draft changes, account changes or navigation; they are not added to the resumable draft. Existing imported source follows the account-keyed in-memory draft rules. Closing/reloading can lose unsaved work.

Pending previews/reads block source ZIP export and save so older source is not misrepresented. Successful import says local draft/not uploaded; only server acknowledgement says saved. Revoked read access gives a generic error without private OS details and preserves the current draft. Keyboard focus returns to the folder picker after cancellation and the selected source editor after a successful import.

## Actual verification

- Pinned Node26.12.1: **748/748 tests,53 files,73.67seconds**; zero failed. Final focused **71/71 in3files**. Full suite ran after all application/helper/UI test changes; later browser-harness additions only assert actual keyboard focus.
- TypeScript passes; Vite8.3.5 production build transforms1700modules. Existing main/Communications bundles remain large; no new low-end performance acceptance is inferred.
- Existing dependency checks pass8synthetic HTTP assertions; built-inUndici8.12.2/dev8.12.3. npm audit reports0vulnerabilities. No dependency/system Node change.
- Built app/installed desktop Chrome/local API: **34checks at390/1440px** using real synthetic folder files and two synthetic accounts. Checks cover no-read preview/cancel, explicit subset/offline read, skipped hidden/cache/binary files, pre-read collision rejection, atomic import, separate upload consent, exact durable source/reload, safe read denial, in-flight cancellation, late account-A reads after switching toB, keyboard focus, no horizontal page overflow and no page errors.
- Actual downloaded ZIPs independently extracted by Python's standard-library ZIP reader preserve all five nested source files and exact BOM/CRLF/emoji/empty bytes. This does not execute creator source, produce a playable build or certify AAA graphics.
- Browser preview screenshots at390/1440 were inspected. Playwright supplies a synthetic directory to the genuine file input; this is not a human-operated OS-picker, physical phone, native mobile permission or hosted-owner test.
- Independent source review reproduced one P2 keyboard-focus defect, which was fixed with a failing regression first and then passing component/browser checks. Final independent review closed the finding and found no remaining actionable source/privacy/integrity/accessibility/harness issues; exact reviewed hashes are recorded in work evidence.
- No server/API/schema/migration change. Separate full HTTP/PostgreSQL suites and native Godot import were not rerun for this client-only delta; parentPR53/54 evidence stays historical. The browser does use the real isolated local API for save/reopen/account transitions.

Commands: pinned node node_modules/vitest/vitest.mjs run; pinned node node_modules/typescript/bin/tsc -b; pinned npm run build; pinned node scripts/test-game-folder-import-browser.mjs; pinned node scripts/test-dependency-security.mjs; pinned npm audit --json. The new browser check/artifact directory is wired into the existing Navigation browser workflow for later exact remote CI.

Evidence: work/ecogames-folder-import-20261109/{base,checks,checkpoint,source-hashes,root-preservation,full,audit}.json, focused-final.log, build-first.log, typecheck-first.log, security.log, browser-final.log, browser/report.json and preview-390/1440.png. Source/commit/tree and exact manifest are in the checkpoint.

## Preserved failures

Initial missing-module RED; UI20pass/7missing-control failures; initial integrated69pass/1failure caused by expecting CRLF from a browser textarea's normalized display value; saved-byte assertion remains exact and unchanged. Reviewer keyboard-focus defect reproduced1fail/27skipped before repair. Read-only ps/heredoc diagnostics were denied; the necessary report was then read with approved execution. All original reports remain retained. No test deadline, assertion, worker, isolation, capacity or quota was weakened. Fresh green does not diagnose historical QA001/Home timing failures.

## Release, cost and next task

This new local increment depends on unmerged public draftsPR51–54; their proposed parent migrations remain UNAPPLIED. It needs scoped public-source approval, exact remote CI, current-main/dependency compatibility and explicit parent migration/merge/activation/deployment authorization. Guarded rollout/rollback, hosted real-Auth/two-owner journeys, physical low-end Android/iOS picker behavior and capacity/retention/restore acceptance remain open. No production/provider/auth configuration, resource, spending or fee changed. All135 protected primary source/assets and unpublished racing work are preserved.

No new library, provider, inference request, compute or storage service is introduced. Browser preview holds at most100 supported metadata references; file reads stay sequential and existing source/Vault bounds remain. Actual storage/transport/backup overhead still applies under existing plans. Core access stays GH₵0; this is not an unlimited free-capacity guarantee.

Next smallest implementation-ready task: a nonexecuting Godot source preflight that checks root project.godot and supported scene/script references, showing missing dependencies before external-engine import. Binary asset storage, isolated build/runner jobs, Forge, public publishing/moderation, multiplayer and AAA RumbleRush2 remain separate unfinished work.

Primary references: [browser selected-folder input](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory), [folder-relative paths](https://developer.mozilla.org/en-US/docs/Web/API/File/webkitRelativePath), [BOM-preserving decoding](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/ignoreBOM), [browser file-upload verification](https://playwright.dev/docs/input#upload-files).
