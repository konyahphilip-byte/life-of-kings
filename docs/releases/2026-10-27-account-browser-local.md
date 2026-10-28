# Local recovery-completion confirmation - 27 October 2026

Status: **LOCALLY BUILT**. Branch `codex/account-browser-confirmation-20261027`, base `c3118d89a0f86926710a97c558c3d4dac3cd3083`. No source publication, CI, production migration, provider setting or deployment. Hosted PR23/main26c1b555 remains unchanged.

## Reproduced problem and repair

With the actual installed Supabase JS/Auth JS2.117.2, a synthetic revoked-refresh response returned `session:null` and `refresh_token_not_found` while the unexpired original session remained in the SDK's supplied memory storage and was returned by the next public `getSession()`. One synthetic request; no real provider, account, browser credential, email or private Auth data was accessed. The fixture token is unsigned synthetic data, not authentication evidence.

The existing recovery screen accepted that known error as completion. A UI regression reproduced its premature success message. The new `recovery-browser.ts` helper preserves unknown-error handling and independently reads the current public SDK session before leaving cleanup. Errors, malformed snapshots and any remaining same-owner session keep cleanup unconfirmed. Only a valid null session or a different account can finish this check. Numeric/object/blank user IDs are rejected.

A retained session is not removed by this helper. A different account stays untouched; a newer session of the original account also stays untouched and conservatively keeps cleanup unconfirmed. No private SDK method, custom storage deletion, mutable account sign-out or new credential persistence was introduced. The read is a point-in-time observation, not proof of atomic clearing across future tab events.

The installed SDK's default lock is null; custom `lock` is a deprecated opt-in compatibility path. The earlier comment promising refresh under a default SDK storage lock was removed. A supported ownership/session-aware removal design remains required; do not invent that contract or rely on private SDK state.

## Actual verification and failures

- UI RED:0passed/1failed,17skipped, reproducing premature completion.
- First focused run:24passed/1failed. Second focused run:23passed/2failed. Failures were existing confirmation/sign-in tests reaching the unchanged5second deadline; the new helper checks passed. Both reports/logs are preserved.
- TypeScript initially rejected the test-only Buffer reference. The ASCII synthetic fixture now uses standard btoa; final TypeScript passes without a new dependency.
- Reviewer Minor finding for truthy non-string IDs was fixed and its malformed cases added. No remaining bounded source findings.
- One confirmation test passed in isolation; temporary phase instrumentation produced no useful emitted timing samples and was removed. This does not diagnose the timeout.
- Final full run on unchanged four-file source: **470passed/1failed of471,36files,299.10seconds**. All7 helper/actual-SDK tests and18 recovery UI tests passed. Sole failure: existing DirectMessages test “opens a real friend conversation, displays saved text and sends without HTML execution” reached5seconds.
- That unchanged message test subsequently passed in isolation:1passed/9skipped. **The full-suite failure remains a release gate and QA-001 cause remains UNVERIFIED.** A rerun is not a cause diagnosis. No deadlines, assertions, worker count or isolation were weakened.
- Final Vite build passes with1672modules; existing Communications large-chunk warning remains. Full-run source hashes were checked unchanged afterward.
- Independent source review resolved the Minor finding. No new schema/server/dependency changes; parent HTTP30+15 and PostgreSQL17.10/67 are retained historical evidence, not rerun or expanded acceptance in this increment.

Primary evidence: `work/account-browser-20261027/` sdk-probe.json, ui-red.json/log, focused-initial.json/log, focused-final.json/log, phase-probe.log, full.json/log, message-isolated.json/log, typecheck.log, typecheck-final.log, build.log, source-before-full.json, checks.json and root-preservation.json.145 protected primary source/assets remain unchanged. The isolated checkout's absent sprint-file path was not created; only the existing authoritative primary sprint tracker is updated.

## Remaining acceptance and release gates

- Actual safe browser-session removal, including cross-tab/new-A/B/refresh/save/cleanup races; the current helper refuses false completion instead of claiming removal.
- Provider-global-logout response-loss retries and actual provider primary-auth/session/clock/recovery behavior.
- Existing server guard proposed migration remains unapplied. Guard-first reviewed rollout, guard-preserving rollback, exact source CI including PostgreSQL and authenticated hosted acceptance are required. Old26c1b555/cf9 ignores barriers and is not a security-compatible rollback once barriers exist.
- Investigate QA-001 and obtain a green exact candidate regression/CI result. Preserve all historical failures.
- SMTP/domain/approved sender/SPF/DKIM/DMARC/required credential workflow and branded template installation remain BLOCKED. Two real inboxes, actual callbacks/expiry/new-password/restart/two-account/mobile-email checks remain UNVERIFIED. No repeated emails or weakened confirmation.
- Internal demo, Ghana pilot and public launch remain separate incomplete gates. No purchase, paid service, DNS, new hosting, media/GPS/payment change or private credential handoff.
