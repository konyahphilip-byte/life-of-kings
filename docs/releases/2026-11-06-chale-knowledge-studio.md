# Chale Knowledge Studio — local implementation evidence

6 November 2026. **LOCALLY BUILT**, not publicly published, merged, migrated or deployed. Branch `codex/chale-knowledge-studio-20261106` starts directly from production PR39/main `56e0c2ebf83dfc2c89fccd0bc552691e4ae42b9b`. It does not include the other open drafts, including the compact chat-layout PR46. The local commit identity and exact file hashes are recorded in `work/chale-knowledge-20261106/checkpoint.json` and `source-hashes.json` in the primary workspace.

## Actual code completed

- Admin-only Knowledge Studio inside the existing EcoVibes ID workspace. Existing database-derived staff roles, production MFA, session, CSRF/origin and rate controls remain authoritative. Non-admin, support and trust role membership does not grant Studio access.
- Selected plain-text/Markdown file or pasted text stays in memory until an explicit save. A separate exact-version review is required for publication to the admin search preview. There is no whole-library scan, URL fetching or AI transmission.
- Four additive API-only tables hold source provenance, immutable versions/chunks and append-only lifecycle events. Source IDs survive retries; new versions do not silently replace publication. Revision checks protect concurrent edits. PostgreSQL source creation is serialized so simultaneous identical retries both return one saved source.
- Keyword retrieval supplies source, licence, attribution, content hash, version, check time and expiry. Drafts, withdrawn versions and expired versions are excluded. Reviewed rollback preserves prior text/history. This is not semantic search or factual certification.
- Pilot limits:20 sources,10 versions/source,20,000 characters/document,1,200-character chunks,200 search candidates/three distinct results,30 knowledge requests/minute/account and10-second UI requests. No new dependency or provider is required.
- A default-off `CHALE_KNOWLEDGE_ENABLED` gate and missing-migration guard fail closed. Chale chat, its optional character, existing provider/quota and domain tools are unchanged.

## Files

- Server: `server/chale-knowledge.mjs`, its tests and six-line integration in `server/index.mjs`.
- Client: `KnowledgeStudio.tsx`, its tests and stylesheet; bounded admin-tab integration in `BackendWorkspace.tsx`.
- Database: generated additive `supabase/migrations/20261106184616_chale_knowledge_studio.sql` — **UNAPPLIED** to Supabase.
- Verification: actual HTTP and disposable PostgreSQL scripts plus existing release-workflow hooks.
- Documentation: corrected `docs/chale-ai.md`, [audit/architecture/ADR/source licences/stages/cost report](../ai/CHALE_KNOWLEDGE_ENGINE.md), this receipt.

## Executed checks

All JavaScript checks used pinned Node26.12.1, Vite8.3.5 and the existing installed dependencies. No deadlines, assertions, workers or isolation were weakened.

| Check | Actual final result | Evidence |
|---|---|---|
| `node node_modules/vitest/vitest.mjs run --reporter=json` |579 passed/0 failed,45 files,123.255s; includes8 knowledge server and6 Studio component tests | `full-final-reviewed.json` |
| `node scripts/test-chale-knowledge.mjs` |14 grouped actual HTTP/SQLite checks passed | `http-final.json` |
| `PG_BINDIR=<existing binaries> node scripts/test-chale-knowledge-postgres.mjs` |36 grouped checks passed on disposable PostgreSQL17.10, exact proposed migration | `postgres-retry-final.json` |
| `npm run build` |TypeScript and production build passed;1687 modules | Final tool output; prior build log retained |
| `npm audit --audit-level=high --ignore-scripts` |0 vulnerabilities | `audit.json`; package/lock files unchanged |
| `node scripts/test-dependency-security.mjs` |8 local HTTP assertions passed, pinned versions verified | Final tool output |
| Local browser |Official selected-file flow → unpublished save → inspect exact text → publish → cited search → withdraw → no search result → reload with retained history.390px viewport/390px document width, no horizontal overflow; default809px also inspected | `browser-checks.json` and CUA session |
| Protected primary workspace |All145 source/asset hashes unchanged | `root-preservation.json` |

Browser checks used a synthetic admin and synthetic public text with the built app/actual API over disposable SQLite. No real user account, private document, Supabase Auth session, inbox, payment or live inference was used. Browser checks preceded the last two narrowly tested UI race/cache fixes; those fixes passed the final component/full suite and production build, not a second physical-browser pass. Temporary tab/viewport and preview were cleaned up.

PostgreSQL evidence verifies RLS, direct denial to anon/authenticated/service_role, runtime SELECT/INSERT and publication-column UPDATE only, no DELETE/TRUNCATE or version/chunk/event/provenance mutation, concurrent identical saves, concurrent publish/withdraw and expired-source exclusion. API evidence verifies guest/member/support denial, CSRF/origin, strict fields, licence/privacy attestation, retries, unpublished versions, reviewed rollback, restart, withdrawal, operator disable and omission of source text/query from logs. This does not prove production MFA, legal rights, general security or native-language answer quality.

## Failures retained and repaired

- Missing-module RED collected0 tests before implementation.
- Initial actual HTTP startup failed because its existing fixture required the exact synthetic marker/capture path; corrected fixture startup then passed.
- TypeScript unused-parameter error was corrected.
- Actual PostgreSQL concurrency RED: two identical saves preserved one source but one request failed. Transaction-scoped advisory serialization repaired both retry outcomes.
- Slow selected-file RED:12 passed/1 failed. New blank draft now invalidates pending file reads.
- Withdrawal-view RED:5 passed/1 failed. Confirmed lifecycle changes now clear displayed search excerpts.
- Configuration/telemetry/temporary-file/process-inspection permission failures, stale accessibility indices, oversized accessibility output and a browser checkbox action that did not toggle are retained in the session/evidence. The UI check re-observed state and used supported semantic controls.
- Earlier576/578 green runs are superseded by the final579 run. Historical QA001 timing failures remain undiagnosed. Existing oversized index/Communications build warnings remain.

## Remaining gates and next increment

**This is the first knowledge foundation, not the completed knowledge engine.** General Chale answers are unchanged. Automatic source connections/scheduling, document PDF/OCR, embeddings/pgvector, end-user cited RAG, native-language quality, operational private-tool acceptance and model fine-tuning remain unimplemented or separately gated.

Read-only audit confirmed the existing Cloudflare Free model and40 member/guest requests with no paid fallback. Supabase has44 public tables; vector0.8.2 is available but not installed. Official licence/access documentation was checked for Wikidata, World Bank and OpenAlex. These are candidate sources, not successful content integrations; no Ghana-language corpus is cleared or ingested yet.

Before production: independent source/security review; exact-source CI including PostgreSQL; approved migration and capacity/retention/erasure/backup plan; real administrator/MFA and unauthorized-account acceptance; actual mobile selected-file/cancel/failure checks; explicit publication/merge/deployment approvals. Draft publication does not authorize migration or release. Licence allowlisting plus administrator attestation does not independently establish rights to a submitted document. Withdrawal preserves text/history and is not legal erasure.

The next smallest implementation is fixed, licence-recorded public-source ingestion with bounded fetching, change detection and review staging. Then connect evidence to the existing Chale provider with server-generated citations, injection/fake-citation tests and bounded real-model evaluations. Private operational records continue through separate authorized tools, never this public corpus.

Incremental provider spend in this milestone:US$0; no new resource, paid fallback, platform fee, production setting or user-data transfer. Remaining free database/inference capacity is unverified; storage/embedding estimates and ongoing costs are documented in the architecture report. Core EcoVibes fees remain GH₵0.
