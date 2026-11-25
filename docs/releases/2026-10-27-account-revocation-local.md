# Local account revocation barrier - 27 October 2026

Status: **LOCALLY BUILT**. Branch `codex/account-auth-revocation-20261027`, based on local email checkpoint `cf9b2820946ca180dd679acf473dfddf53124eee`. No publication, CI run, hosted migration, provider setting or deployment in this increment. Hosted PR23/main26c1b555 is unchanged.

## Implemented boundary

Verified provider tokens now supply strictly validated internal subject/session/issue/expiry/primary-authentication context after the installed Supabase signature/issuer verifier and authoritative user lookup. Refresh timestamps, unknown methods, MFA-only step-up and email-change events are not fresh primary authentication. The internal context is not added to public account responses.

App-owned tables retain a per-account revocation boundary, seen/revoked provider-session IDs and immutable owner/session-bound cleanup-operation results. Admission and cleanup lock the same mapped user row. Session insertion occurs in that transaction; the cookie is published only after commit. Local SQLite transactions are serialized on their single connection. Linked legacy-password login shares the user lock and remains retired.

Recovery cleanup uses a stable memory-only operation reference. A response-lost retry returns its original result without moving the boundary or deleting a later fresh app session. Different-operation reuse of revoked proof is refused. Bearer cleanup never sends Set-Cookie: it revokes server rows without erasing a different or newer browser sign-in through a delayed response. A dead cookie can remain in the browser; this is not browser-storage clearing.

After reset, a newly authenticated session must have primary proof strictly later than the boundary; the boundary includes a conservative60-second provider-clock allowance. The original known session ID stays denied even if its claims change. Unknown/missing fresh proof fails closed after revocation; established pre-boundary sign-in paths are retained. The app directs the user to wait one minute and sign in again. Actual provider AMR/clock/recovery behavior remains UNVERIFIED.

`ECOVIBES_SUPABASE_ADMISSION_DISABLED=true` denies email-to-app admission; it never bypasses the guard. It is not enabled in hosting. The proposed additive migration is `20261027121500_identity_auth_revocations.sql`; **not applied to Supabase**. It enables RLS, denies PUBLIC/anon/authenticated/service_role access, limits runtime privileges, and creates no private Auth-schema access or security-definer function.

## Actual checks

- Full local unit/UI suite:463 passed,0failed,35files,296.10seconds. No test deadline/assertion/worker/isolation weakening.
- Final focused signed-proof/policy/captured-operation/UI checks:32passed across4files, including stable cleanup references across remount/retry.
- Actual installed signature verification uses synthetic ES256 keys, inline synthetic public JWKS and a mocked user endpoint. Tampered, wrong-issuer, expired and mismatched-subject cases are rejected. This is not hosted Supabase acceptance.
- Actual isolated HTTP/SQLite:30 revocation checks and15 retained recovery checks. The external verifier and child clock are synthetic. Old/refreshed proof is denied, a later new session is admitted, delayed cleanup does not erase its cookie, another account remains accessible, failed insertion produces no session cookie, and the deny switch refuses admission.
- Disposable private-socket PostgreSQL17.10:67 actual migration/runtime/privilege/concurrency checks. Both admission/cleanup lock orderings, concurrent identical retries, rollback of failed issuance and retained barriers passed. Migration SHA256:49f1f61cd4a145dc365095d790fb0f6c8664bb41142c3535a17944c1767ccc42. Cluster stopped and temporary files removed. PostgreSQL CI wiring/exact candidate CI remain UNVERIFIED.
- TypeScript and Vite build passed,1671modules. Existing Communications chunk warning remains.
- Existing dependency security checks passed: pinned Node26.12.1/Vite8.3.5/Undici8.12.2built-in8.12.3dev and eight bounded local HTTP probes. Not complete application security.
- Independent read-only source/security review: no remaining Critical/Important/Minor finding in this server increment. Reviewed HTTP30/PG67 receipts and current migration hash.

Full regression began before the final cookie-only router fix and the added retry-body assertion. The affected router behavior was subsequently verified by final HTTP30; the added UI assertion by final focused32, followed by TypeScript/build. Do not call this exact-source CI or infer hosted behavior from these local results.

Evidence lives in primary `work/account-revocation-20261027/`: full-initial.json/log, focused-final.json/log, postgres.json, http-final.json/err, typecheck.log, build.log, cookie-red.log, checks.json and source/preservation hashes.

## Preserved failures and limits

Initial TDD import RED collected no tests before the new module existed. A claim-extraction test expectation was corrected to retain the actual distinct issued/expiry values. PostgreSQL initially stopped before startup because PG_BINDIR was absent; rerun with the verified local binary directory passed. Review reproduced a stale-cookie replay returning an expired ev_session instead of no cookie; cookie-red.log is retained, then HTTP30 passed after removing all bearer-cleanup cookie headers. Restricted process inspection was denied then repeated with approved read access; a report read used the wrong checkout-relative evidence path before the correct primary path was used. None is hidden by later passes.

QA-001 and earlier445/1 ProviderOnboarding timeout remain undiagnosed;296-second runtime is evidence, not a timing-cause diagnosis. All earlier failures/history remain preserved.145 protected primary source/assets are unchanged. Dirty root and old job-call/message WIP were not published.

## Gates before release or complete recovery

1. Prove browser session clearing under the installed SDK's storage/lock contract while preserving B or a new A session, including refresh rejection retaining an old access token.
2. Resolve provider-global-logout retry uncertainty: a response-lost global sign-out retried later may affect a newer provider session. App-session idempotency alone does not prove provider-session idempotency.
3. Controlled real Auth AMR/session/recovery/clock acceptance, actual callbacks and two-account isolation. In-flight sensitive domain requests authorized before revocation need separately scoped transaction-time acceptance.
4. Review a staged guard-first rollout and guard-preserving rollback. Old26c1b555/cf9 code ignores new barriers; it is not a safe security rollback after revocations exist. Retain all revocation history. No production rollback/restore drill performed.
5. Exact candidate CI including PostgreSQL and review, compatible production schema/marker application, hosted artifact checks and authenticated acceptance before deploying this candidate.
6. SMTP/sending-domain/credential workflow, branded template installation, two real inboxes, confirmation/recovery/expiry/new-password/restart and representative mobile email-client checks. Sender setup remains BLOCKED; no repeated emails, weaker confirmation or private credential handoff.

Internal demo, Ghana pilot and public launch remain separate incomplete gates. No new hosting, DNS, purchase, paid service, media/GPS/payment change or public launch.
