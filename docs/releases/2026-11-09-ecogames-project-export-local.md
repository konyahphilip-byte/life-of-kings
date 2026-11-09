# EcoGames folder-preserving project source export — local receipt
Date: 8–9 November 2026. Status: **LOCALLY BUILT**, independently reviewed; no new public draft/remote CI, migration, merge, activation or deployment.

## Delivered change

The existing Vault & Studio now downloads one selected project as a standard ZIP with its relative source folders intact. A stable project UUID defines the archive/root name; a user title never becomes a filesystem path. The clean control says “Export project source ZIP”; dirty work says “Export draft source ZIP.” Export includes the current source, including unsaved edits, without saving, uploading, clearing storage consent or changing the server revision. It works from already-loaded source while offline. Feedback says download requested, never download completed or server saved.

Only current text source is included. Story Bible, checkpoints, other projects, credentials and authority fields are excluded. Existing integrity-checked JSON backup/restore remains available for the full Vault. No source is executed, rendered or sent to AI by the export feature. An external engine import in the verification harness uses only hard-coded trusted synthetic source.

The writer reuses existing strict project/path/size validation. It additionally rejects Windows device names, trailing-dot path segments, surrounding path whitespace, inconsistent folder casing and unpaired UTF-16 surrogates rather than silently renaming references or replacing bytes. ZIP entries use forward slashes, UTF-8, CRC32, STORE method, deterministic timestamps and regular nonexecutable file attributes; no symlinks, compression, ZIP64 or new dependency. Archives are capped at140000bytes, within existing twenty-file/32KB-per-file/128KB-canonical-Vault limits. Missing project.godot or binary assets are not invented.

Download remains synchronous inside the user action, so no late asynchronous account/file-read result can export a previous owner’s source. Busy/loading/pending reads disable the control; an explicit handler guard also rejects pending reads. Errors preserve the draft. A temporary download anchor is removed and its object URL is revoked after30seconds. Already downloaded files cannot be retroactively revoked.

## Actual verification

- Pinned Node26.12.1: full **721/721 tests,52files,86.46seconds**; zero failed. Final focused **44/44 in2files**. Full tests ran after all application/archive/UI test changes; subsequent changes were confined to the standalone native checker and were exercised separately.
- TypeScript passes; Vite8.3.5 production build transforms1698modules. Existing main/Communications chunk-size warnings remain.
- Existing dependency-security checks pass8syntheticHTTP assertions; built-inUndici8.12.2/dev8.12.3. npm audit reports0vulnerabilities. No dependency or system Node change.
- Python standard-library ZIP reader independently validates CRCs/entry attributes, extracts five nested UTF-8 files with BOM/CRLF/emoji/empty content and compares exact bytes. A separate twenty-file104372byte archive also passes.
- Actual built app/local API/Chrome: **14checks at390/1440px**, two synthetic accounts, real downloaded ZIP extraction, offline unsaved-source export with unchanged durable revision, invalid-path/no-download/draft preservation, account switching and no horizontal overflow/page errors. Both screenshots inspected. Not physical-phone or hosted acceptance.
- Official Godot4.7.2 macOS Universal170622178byte archive SHA256 c58a24e31d720be9d62f60cb5627c4e695fb72f21b0cfe1bc9ccaa9a3b3ba63e matches official release metadata; Apple codesign verification exits0 before use. It is unpacked only in ignored task-local work, not Applications.
- Correctly self-contained Godot4.7.2.stable.official.ed1daf0bf imports the trusted exported fixture headlessly: **exit0, no engine errors, imported editor cache exists**. Native output is saved before assertions. Its existing OS HOME is passed through unchanged, never redirected; portable editor data stays beside the task-local bundle. This proves bounded native source-project import, not gameplay, a packaged build, arbitrary creator-project compatibility, GPU fidelity or AAA acceptance.
- Independent source review found no remaining actionable findings. Optional failed-native-log retention issue was corrected and re-reviewed. Reviewer independently checked ZIP interoperability and twenty boundary probes.

Evidence: work/ecogames-project-export-20261108/full.json, full.log, focused-final.log, typecheck.log, build.log, audit.json, security.log, archive-roundtrip.json, browser/report.json and export-390/1440.png, official-engine-metadata.json, engine-verify.json, engine-import.log and **native-roundtrip-accepted.log**. source-hashes.json/checks.json/checkpoint.json record the final candidate and exact limits. Parent HTTP/PostgreSQL evidence belongs to PR53; no server/API/schema changed and these suites were not rerun for this client-only delta.

## Preserved failures

Initial missing-module RED; UI16pass/4missing-control failures; first integrated43pass/1failure caused by testing a button’s own disabled property rather than its inherited fieldset-disabled state (correct native :disabled assertion retained); Python checker’s older-version is_relative_to error (replaced by an equivalent resolved-parent containment check); UI mock TypeScript errors; and denied read-only diagnostic commands remain disclosed. All assertions, deadlines, workers, isolation and quotas retain their existing strengths.

Native attempt1 used the wrong portable marker and stripped OS HOME; editor cache and user:// errors caused a correctly failing test despite exit0. Attempt2 fixed the marker using actual4.7.2 source, but user:// still failed with HOME absent. Attempt3 preserves the existing HOME unchanged and passes with the correct outside-.app marker. Original native-marker-red-* and native-environment-red-* reports plus native-roundtrip.log/native-roundtrip-final.log remain failed history; they are not the accepted run. Earlier no-engine report remains archive-roundtrip-before-engine.json. Passing results do not diagnose historical QA001/Home timing failures.

## Release, privacy, cost and next task

Parent private Vault remains public draftPR53 stacked on unmergedPR52/51. Its migrations remain UNAPPLIED. This export adds no API, database migration, service, fee, inference request or paid resource. Core access stays GH₵0; browser memory/download bandwidth and existing bounded Vault storage still have real resource costs.

Public-source approval is required for this new candidate before fresh remote CI. Current-main/dependency integration, explicit parent migration/merge/activation/deployment approval, guard-preserving rollback and hosted/real-Auth/owner-device/low-end/backup-retention/capacity acceptance remain. No release authority is inferred from local tests or manual evidence. Original primary source/assets and unpublished racing work are preserved.

Next smallest implementation: selected-folder import preserving relative names, with a preview, existing text/size/path caps and separate save consent. Binary asset storage, isolated runner/build jobs, Forge, publishing/moderation, CI sync, multiplayer and AAA RumbleRush2 remain separate unfinished work.

Primary references: [ZIP APPNOTE](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT), [Godot resource paths](https://docs.godotengine.org/en/stable/tutorials/io/data_paths.html), [official4.7.2 release](https://github.com/godotengine/godot-builds/releases/tag/4.7.2-stable) and [actual4.7.2 portable-editor path implementation](https://github.com/godotengine/godot/blob/4.7.2-stable/editor/file_system/editor_paths.cpp).
