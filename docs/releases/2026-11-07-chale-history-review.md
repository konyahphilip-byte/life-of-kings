# Chale history review follow-up — 7 November 2026

Scope: review of local saved-chat checkpoint `2b1d0e0`; no public publication, CI, migration, merge or production change.

The review reproduced a misleading save-state defect in two journeys: a saved answer followed by an unsaved answer after the account setting changes, and an online saved answer followed by offline app guidance. The previous confirmation remained visible beside the later answer. Sidekick now clears the old confirmation before starting an answer that will not be saved. No permission, provider, quota or persistence contract changed.

Retained RED: two targeted failures, twelve skipped. Final focused14/14 and full596/596 in45 files pass, as do TypeScript, build1687 and eight bounded security assertions. Reports are under `work/chale-review-sync-20261107`: history-status-red.json, history-focused.json, history-full.json, history-build.log and history-security.json. Parent HTTP16/PostgreSQL36 checks are historical; no server or migration change in this client-only follow-up warranted claiming them as freshly rerun.

This is a bounded author review, not independent approval. Review also checked owner-bound SQL, existing session/CSRF/origin gates, exact turn idempotency, late-response cleanup, Temporary mode, expiry and private/public knowledge separation. No further confirmed defect was identified within that scope. Remaining gates include independent security/privilege review, publication approval, exact-source remote CI, combined current-main/recovery compatibility, retention/backup/capacity approval, real Auth/MFA/two devices, and explicit migration/merge/deployment approval. Existing bundle warnings and historical QA001 remain undiagnosed.

Proposed history migration remains UNAPPLIED and unchanged at SHA256945685165e587166ee1af6892a103be93fd5e4bed7ead2a3a7dda7341c5eff00. Character-off chat and free core access remain intact. Automatic knowledge-source updates are being built on a separate branch and are not included in this saved-chat candidate.



## Approved draft and first remote checks

Founder approved public saved-chat candidate4d6051b. Published draft PR47 remote8280dd56 and approved local source share treefa606b09, stacked on PR46. Exact Release42353196605 passed596 tests/build1687/audit0/security8/all existing HTTP, history HTTP16 and disposable PostgreSQL18.6 history36/message84; actual decoded logs inspected. Browser42353196615 passed39 baseline and the first three conversation checks, then failed the unchanged short-viewport history/composer reachability assertion. Ordinary390px conversation height680.703125/828px remained above70%. This failure is retained, not excused by the release pass.

The status row now has a compact, separately scrollable short-screen layout and keyboard focus; all privacy text remains available at its existing11px size. The history manager uses one outer scroll region on very short screens. Existing browser assertions, deadlines and fixtures are unchanged. Final candidate CI/screenshot verification is required. This follow-up remains within the approved saved-chat scope; knowledge sync is excluded. No migration, merge or deployment.
