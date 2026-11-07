# Chale public-source updates — local verified increment
Date:7 November2026. Status: LOCALLY BUILT, unpublished, unmerged, UNAPPLIED migrations, undeployed. Branch codex/chale-knowledge-sync-20261107 based77b21a143cc27dde2661c389f1af2a1a495c8b6d. No other draft stack is included.

## 7 November 2026 — approved public-source update pilot (local)
LOCALLY BUILT on the existing Knowledge Studio foundation; unpublished and disabled in production. One fixed Wikidata Q117 country-profile adapter has a successful bounded real HTTP probe. This is public structured geography metadata, not a news feed, popularity service or a complete African language corpus.

The existing API uses durable source jobs, expiring leases, change fingerprints, conditional requests, retry/backoff, versioned staging and admin review. Administrator approval to fetch is separate from exact-text draft import and canonical publication. No private account content enters the public-source request. Existing Chale model/provider, quotas, private tools and character settings remain independent.

New API: GET /api/v1/ai/knowledge/sync; POST /sync/:key/settings, /sync/check, /sync/:key/apply. Existing session/staff/MFA/CSRF/origin/no-store/30-per-minute boundary is reused. Fixed registry keys accept no URL or account selectors. CHALE_KNOWLEDGE_ENABLED and CHALE_KNOWLEDGE_SYNC_ENABLED must both be true and both schema markers present; defaults remain off.

ADR-K2: reuse the existing modular monolith and database. A completion-scheduled 60-second wake checks one due approved source; successful reads wait24hours. PostgreSQL transaction advisory locks serialize brief queue changes; network fetching happens outside transactions, with30-second leases. Local overlap shares one check, cross-worker checks share durable leases. Pausing invalidates late fetches; expired fetch/import leases cannot acknowledge completion. No new cron service, job broker, vector DB, paid model or resource is created. Render Free sleep means no exact wall-clock synchronization guarantee.

External request: fixed HTTPS Wikidata API for Q117 labels/descriptions in en and available tw, descriptive User-Agent, no cookies/credentials/user text, no redirects,5-second absolute timeout,128KiB actual response cap. Entity/revision/language/text validation strips unrelated claims. Public etag/modified validators are bounded;304 requires a requested validator. Busy/failed reads use15-minute exponential backoff up to24hours and honor bounded Retry-After up to7days. Error codes are allowlisted, no raw provider body in UI/log/audit.

Rights: only Wikidata structured entity data from [Q117](https://www.wikidata.org/wiki/Q117) is in scope. [Wikidata Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing) declares structured data CC0; article text and images are excluded. [Data access](https://www.wikidata.org/wiki/Wikidata:Data_access) and [API etiquette](https://www.mediawiki.org/wiki/API:Etiquette) informed the request limits. Public availability alone never grants rights to other sources. No Ghana-language accuracy claim is established by a Twi label.

Three additive tables: knowledge_sync_jobs (approval/schedule/lease/status), knowledge_sync_snapshots (immutable staged public text with7-day expiry) and knowledge_sync_events (append-only redacted actor/event trail). Existing canonical knowledge_sources/versions/chunks/events remain the publication source of truth. Draft save and queue acknowledgment are separate transactions: a response-loss or settings race can leave a saved draft; feedback says to inspect source history. Stable source ID plus exact text/expiry reuse prevents duplicate canonical versions. No publication pointer changes automatically. Reviewed rollback/withdrawal/expiry still use canonical services.

Limits: one registry source,50 cache snapshots,10k audit rows, existing20 sources/10 versions/20k characters. Expired cache text is pruned on the next enabled worker check, not continuously while the feature is off. Canonical immutable history retains its own retention rules. Ten canonical versions remain an explicit pilot limit, so indefinite unattended operation is not promised. Legal erasure, audit retention and capacity approvals remain release gates.

Cost: tests added0 model/embedding calls,0 paid services and GH₵0 platform fees. Only bounded metadata HTTP and existing DB/API capacity are used; no guarantee of permanent free upstream availability. At one unchanged source, successful checks are at most roughly one per awake24-hour cycle plus bounded retry attempts; API sleep can delay them. Worst configured50×20k×4 UTF-8 cache bytes≈4MB text before row/index overhead (estimate, not measured capacity). Existing core DB capacity has priority.

Final local evidence:605/605 tests in47files/74.99s; TypeScript/build1688; audit0/security8; existing Studio HTTP14 and PG17.10/36 plus sync HTTP12 and PG17.10/46 pass. Built local synthetic admin consent→fetch/stage→reviewed draft→reload→pause passed;390px viewport/document390px, Studio356px, no horizontal overflow. Source text was synthetic in UI/HTTP, the live source probe was separate. Screenshot was observed but local screenshot-file save failed EPERM; do not claim a saved Studio screenshot or physical-device evidence.

Review reproduced/fixed an old-account refresh hiding the new panel and an expired import lease claiming completion; both RED0/1 are retained. Initial unit16/1 control-character fixture, focused27/3 stale-copy/unsupported matcher errors and test-only TS mock typing failure are retained, then final605 green. No assertion/deadline/worker/isolation limits were weakened. This is author review, not independent approval.

Proposed migration20261107064239 SHA256 e7637431eab0d1d316c06b1d46c8d9b137b7534f7e0eb890e1088b2e538c7a00 is UNAPPLIED. Parent20261106184616 is also UNAPPLIED. Rollback disables sync first and retains canonical versions/audit; do not remove any separately introduced authentication barriers. Public publication of this queue/foundation, independent review, exact remote CI, current-main/recovery compatibility, real admin/MFA/unauthorized devices, measured capacity/retention/backups, and explicit migration/merge/deployment approval remain open. No production/provider/schema change occurred. End-user cited RAG, embeddings/pgvector, larger licensed source coverage, confirmed user memory, language/model evaluation, broader agents and fine-tuning remain incomplete.


## Exact implementation files
- server/chale-knowledge-sources.mjs
- server/chale-knowledge-sync.mjs
- server/chale-knowledge-sync.test.mjs
- server/index.mjs
- src/modules/assistant/KnowledgeSyncPanel.tsx
- src/modules/assistant/KnowledgeSyncPanel.test.tsx
- src/modules/assistant/KnowledgeStudio.tsx
- src/modules/assistant/KnowledgeStudio.test.tsx
- scripts/chale-knowledge-sync-test-provider.mjs
- scripts/test-chale-knowledge-sync.mjs
- scripts/test-chale-knowledge-sync-postgres.mjs
- supabase/migrations/20261107064239_chale_knowledge_sync.sql
- .github/workflows/release-checks.yml
- docs/ai/CHALE_KNOWLEDGE_ENGINE.md
- docs/CONTINUATION.md
- this receipt

## Commands and evidence
Pinned task-local Node26.12.1; Vite8.3.5/built-in Undici8.12.2/dev8.12.3. System runtime unchanged.
- node node_modules/vitest/vitest.mjs run --maxWorkers=1 --reporter=json --outputFile=.../sync-full-verified.json
- npm run build; npm audit --audit-level=high --ignore-scripts --json
- node scripts/test-dependency-security.mjs
- node scripts/test-chale-knowledge.mjs; node scripts/test-chale-knowledge-sync.mjs
- PG_BINDIR=<existing17.10> node scripts/test-chale-knowledge-postgres.mjs
- PG_BINDIR=<existing17.10> node scripts/test-chale-knowledge-sync-postgres.mjs
Evidence retained in primary work/chale-review-sync-20261107: final full/build/audit/security/HTTP/PG reports, first failures, source hashes, live-source probe and browser observations. No hosted migration was used. All145 protected primary source/assets are unchanged. Production last verified remains PR39; no new production audit this increment.

