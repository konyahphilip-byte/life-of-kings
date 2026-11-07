# Chale private conversation history — local P1a receipt

Completed locally 6–7 November 2026 on `codex/chale-history-20261106`, based on `8f330e3b3b3f356cbc04fa57d77eda005bc71f80` (PR46 compact-chat code). The local commit/tree are recorded after commit in `work/chale-history-20261106/checkpoint.json`. No public PR, CI, production migration, merge, feature enablement or deployment occurred.

**LOCALLY BUILT; ready for independent review.** This is persistent chat history, not the completed ultimate knowledge/memory/agent program. Last verified production remains PR39; no fresh hosted acceptance is claimed.

## Actual code

- Existing signed-in Chale can opt into private saved questions and server-generated answers, reload, find/pin/rename/archive/unarchive chats, load earlier turns, export actual JSON and confirm deletion.
- New Temporary Chat mode remains usable with normal saving enabled and preserves its visible privacy label. It does not write history/memories or recommendation feedback.
- Existing provider, quotas, zero-model greetings, app guide, compact conversation layout and character-off chat are preserved.
- Stable conversation/turn commands prevent duplicate model redispatch. Failure/timeout is not reported as successful saving; an in-flight reply cannot resurrect a deleted chat or persist after the captured session is revoked.
- History text is separate from public knowledge and future confirmed memory. No private conversation training, new paid service, platform fee or real provider request was introduced.

## Files

| Area | Files |
|---|---|
| API/data | `server/chale-history.mjs`, `server/chale-history.test.mjs`, `server/index.mjs` |
| Client | `src/modules/assistant/ChaleHistory.tsx`, `Sidekick.tsx`, `Sidekick.history.test.tsx`, `chale-history.css` |
| Real local integration checks | `scripts/test-chale-history.mjs`, `scripts/test-chale-history-postgres.mjs`, `scripts/chale-history-test-provider.mjs` |
| Proposed database change | `supabase/migrations/20261106220412_chale_conversation_history.sql` |
| CI wiring | `.github/workflows/release-checks.yml` adds history HTTP and PostgreSQL commands |
| Documentation | Canonical ultimate directive, [history/memory architecture and matrix](../ai/CHALE_MEMORY_AND_HISTORY.md), this receipt, continuation/readiness/sprint updates |

Migration SHA256: `945685165e587166ee1af6892a103be93fd5e4bed7ead2a3a7dda7341c5eff00`. Three new tables, existing-user/session boundary, RLS/direct-role denial, narrowly scoped runtime grants and schema marker. It is **UNAPPLIED** to production. The proposed sessions column UPDATE privilege exists only to permit row locking and needs independent privilege review.

## Actual test results

Pinned task-local Node26.12.1 was used; the system runtime was not changed.

| Check | Result | Retained evidence |
|---|---|---|
| Focused history/API/UI | 26 passed / 0 failed in 2 files | `focused-export-final.json` |
| Final full regression | 594 passed / 0 failed, 45 files, 68.900 seconds | `full-final.json` |
| TypeScript and production build | Passed; 1,687 modules | `build-final.log` |
| Dependency audit | 0 reported vulnerabilities; no installation | `audit-final.json` |
| Bounded security probes | 8 HTTP assertions passed; pinned Vite/Undici verified | `security-final.json` |
| Actual isolated API/SQLite | 16 checks passed | `http-final.json` |
| Exact migration/runtime/concurrency | 36 checks passed on disposable PostgreSQL17.10 | `postgres-final.json` |
| Primary workspace protection | All145 protected source/asset hashes unchanged | `root-preservation.json` |
| Built browser | Synthetic A/B account lifecycle and390px no overflow passed | `browser-checks.json`, `synthetic-export.json` |

Commands: `node_modules/vitest/vitest.mjs run --maxWorkers=1`; focused server/history UI files; `node_modules/typescript/bin/tsc -b`; `node_modules/vite/bin/vite.js build`; `scripts/test-dependency-security.mjs`; `scripts/test-chale-history.mjs`; `PG_BINDIR=<existing17.10binaries> node scripts/test-chale-history-postgres.mjs`; npm audit with separate empty config files. The exact executable and source hashes are recorded in local evidence.

Fixtures intercept provider transport and use only synthetic identities. Successful fixture answers are not real model-quality evidence. The API restart/second session check is not a physical two-phone pass.

The browser exercised consent→saved question/reply→full reload→dated snapshot→Temporary question excluded→rename/pin→real JSON download→archive/unarchive→account B empty→return A→cancel deletion→confirm deletion. Final rebuilt phone view showed the Temporary label beside preference changes and no horizontal overflow. The subsequent late-export guard was verified with a reproduced RED and final component/full/build tests; that guard did not receive another full browser pass. Native screenshots were inspected, without a screenshot-file artifact claim.

## Failures retained and fixed

- Initial missing-module RED and zero-collected temporary-cache EPERM runs.
- Initial registration fixture used an invalid one-character display name; corrected the fixture contract without weakening validation.
- PostgreSQL cursor default exceeded integer capacity after20 checks; replaced with the bounded201 cursor and verified exact PG migration/service behavior.
- Existing strict Sidekick request-body assertion failed65/1 when a false temporary flag was added everywhere; the ordinary chat contract was restored and the assertion retained.
- Type errors for UUID-ref inference and unsupported test locator options were corrected.
- Initial module/inline script syntax diagnostics remain recorded; a failed construction call did not edit source.
- Browser success notices hid Temporary mode; fixed visible mode labeling and preference/mode independence.
- Author review reproduced the late-export account-switch race:0 passed/1 failed targeted RED, followed by the request-generation guard and final26 focused/594 full green.
- npm rejected using the same /dev/null file for both configs before making an audit request; the failed log is retained and the audit passed with distinct empty configs.
- Existing bundle-size warnings and historical QA001 timing failures remain. Passing reruns do not establish their cause. No timeouts, assertions, worker count or isolation protections were weakened.

## Limits, review and release gates

This bounded pilot retains30 active chats/account,200 turns/chat,500 turns/account and1,000 global turns, with30-day expiry and explicit minimal deletion identifiers. Pending work has a120-second save window. Review storage headroom, identifier retention, technical backups, provider retention and operational purge monitoring before enabling it. No background push, full attachments, streaming, cross-chat memory, automatic summaries or whole-library export exists in this increment.

Independent source/security/privilege review, compatible integration with unmerged recovery and tool drafts, approved public publication, exact-source CI, real account/MFA/session and two-device acceptance, and explicit migration/merge/deploy approval remain open. Approval alone does not close the technical gates. Disable `CHALE_HISTORY_ENABLED` for a safe feature shutdown; preserve schema/deletion records and any separately introduced recovery barriers. No destructive rollback is proposed.

Next smallest implementation: independent owner-scoped confirmed memory with provenance and correction/delete/export, a truthful “What do you remember about me?” overview, and Temporary/cross-account/deletion tests. Saving history must never imply memory or training consent. Public Knowledge Studio remains a separate local branch.

