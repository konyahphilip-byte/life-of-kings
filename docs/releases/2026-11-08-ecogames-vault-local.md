# EcoGames Vault/Studio — local verification, 8 November2026

**LOCALLY BUILT; not public, merged, migrated, enabled or deployed.** Branch codex/ecogames-vault-studio-20261108 extends clean local7a1c70d673790588aa8a861160163ba5bb32d056 and existing public draftPR52. PR51/52 remain unmerged dependencies. The checkpoint commit/tree and exact manifest are recorded in work/ecogames-vault-20261108/checkpoint.json after committing this receipt.

## Actual code delivered

- Existing Games route gains a private project gallery, Story Bible and plaintext source editor, using existing EcoVibes identity/API/database.
- Official selected-file picker reads UTF-8 text locally; separate private-storage consent and Save are required for upload. No whole-library access, source execution/HTML rendering, binary assets, AI processing or public publishing.
- Five projects, twenty files each,32KB/file, three explicit checkpoints/project,128KB combined. Local integrity JSON export/import with verified preview and conflict rejection; restore is a separately saved draft.
- Server owner checks, expected-owner guard, CSRF/origin/no-store, strict paths/fieldsets, SHA-256 validation, atomic revision comparison and duplicate-safe retry receipts. Separate30read/10attempted-write per-minute buckets retain failures/retries.
- Account-keyed memory preserves dirty drafts and stable pending operation across internal tabs/routes; original revision prevents silent rebasing. Clean source refreshes from the verified head, including deletion elsewhere. Account changes clear private memory. Full close/reload can still lose unsaved work; save/export first.
- Unknown/offline saves retain drafts without false success; export and confirmed discard/reload recover conflicts. Pending file reads cannot be overwritten by save acknowledgements. Confirmations trap focus, support Escape and restore an enabled target, including five-project capacity.
- Mobile file-picker width and title/engine overlap fixed; long source paths wrap. Existing navigation browser script now decodes file URLs with spaces and uses already-installed Chrome on macOS; Linux CI behavior stays unchanged.

New proposed migration20261108210000_game_vault SHA25607fb41cafa40c9f0de12746a4bc8969ad17610e377e1563f65a3f7c7f299f45b is **UNAPPLIED** in production. It holds current private content plus explicit checkpoints and fifty bounded ID/hash receipts, rather than retaining every prior raw-source revision. Removing source clears current payload after ACK; provider backups/WAL/physical erasure are not certified.

Files: shared/game-vault.{mjs,d.mts,test.mjs}; server/game-vault.{mjs,test.mjs}; server/index.mjs; GameVaultDraft.tsx, GameVaultStudio.tsx/test, useGameVault.ts, vault-studio.css and GamesHub.tsx; narrow App.tsx provider wiring; new HTTP/PostgreSQL/browser scripts; navigation script compatibility fix; existing two CI workflows; proposed migration; architecture, continuation and this receipt. Exact manifest is in the checkpoint.

## Verification

Pinned task-local Node26.12.1/Vite8.3.5/built-inUndici8.12.2/dev8.12.3; system Node24.21 unchanged.

| Check | Actual result |
| --- | --- |
| Full Vitest, unchanged --maxWorkers=1/deadlines/assertions/isolation | 692/692 tests,51files,78.72s; full-final-current.json |
| New model/service/UI tests | 18+7+15=40 passing within full run |
| Final TypeScript / Vite production build | Pass;1697modules, existing index/Communications chunk warnings |
| Actual isolated SQLite HTTP/API | 21 groups pass; server restart, consent, isolation, retries, checkpoints, removal/log exclusion |
| Disposable PostgreSQL17.10 | 31 pass; exact migration, PR52 coexistence, grants/RLS, concurrency, atomic failure, bounded receipts |
| Real local installed Chrome/API | 36groups pass at390/1440; source not executed, reopen, offline recovery, backups, conflicts, account switch, focus and geometry |
| Existing actual HTTP regressions | ControlHub13, Games9, direct messages13 pass |
| Existing browser regressions | Navigation39, Games5, ControlHub10 pass |
| Dependency checks | audit0; eight security HTTP assertions pass |
| Independent review | Bounded source findings reproduced/fixed/closed; final code review no remaining actionable finding |

The full runtime source was unchanged by the final test-tooling corrections; the unsupported test option and navigation file-URL/macOS-browser repair were checked by final TypeScript/build and real browser regressions. CSS/accessible names are covered by the final geometry/browser run. These are synthetic local accounts and desktop viewports, not hosted/real owner/physical phone acceptance. Screenshots were inspected; raw source appears only in synthetic fixture captures, not real-user evidence.

All source, commands, process outcomes, hashes and reports are in work/ecogames-vault-20261108/. The exact proposed migration/hash was tested locally, never against production.

## Failures retained and fixed

Missing-module RED; UUID-case and path-prefix REDs; asynchronous selected-read/save, navigation, initial removal-focus and stale clean-cache regressions; separate rate-bucket RED; capacity-focus RED; browser accessible-field-name timeouts; actual429 save from mixed read/write bucket; account-reset browser-harness navigation timeout; measured390px/413px file-picker overflow; title/engine screenshot overlap and Engine-label lookup; unsupported Testing Library option compile failure; existing navigation test encoded-path ENOENT and missing bundled Chromium. Raw logs remain, including initially passing partial/intermediate runs. No assertions, limits, deadlines, workers or isolation were loosened. Historical QA001/Home5000ms failure is still undiagnosed; current green does not establish its cause.

## Release gates and remaining work

No new publication, remote CI, database mutation, merge, provider/hosting change or production deployment occurred. This new source needs scoped public-draft approval, exact remote checks and current-main/dependency compatibility review. Applying migrations, merging, enabling a pilot and deploying require explicit authorization and a guard-preserving reviewed rollout/rollback.

Set ECOVIBES_GAME_VAULT_DISABLED=true for an approved guarded rollout; missing schema/deny flag returns unavailable. Retain additive data on rollback. Real Auth/two-owner/device/slow-network/backup-restoration and operational capacity/retention remain unverified. The single current readiness dashboard is in the primary workspace; no second dashboard was created here.

Binary assets/object storage, folder-preserving engine export, isolated runner/build jobs, Forge/generation, moderation/public publishing, multiplayer, automatic CI sync and AAA RumbleRush2 remain incomplete. Existing Rumble source/assets and the dirty primary application source are unchanged. No new dependency/infrastructure/spending/model call or platform fee; GH₵0 core launch retained.

Next smallest implementation: safe per-project source archive with relative paths and exact byte-roundtrip tests, enabling creators to open their saved work in the local engine. Do not execute source as part of export.
