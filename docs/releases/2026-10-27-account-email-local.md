# Account email and recovery repair - local receipt, 27 October 2026

**LOCALLY BUILT. This candidate is not deployable as complete account recovery.** Existing live source remains PR23 main26c1b555 / dep-dbg4e7142hec73difkjg. No new source, email template, DNS, SMTP credential, domain or hosting purchase was deployed/activated.

## Implemented scope

- Explicit confirmation resend, generic request acknowledgments that do not claim inbox delivery or disclose account existence, one-minute UI cooldown and duplicate account-action guard.
- Recognised account callback entry, early provider recovery-event capture, no password form from a URL flag/ordinary session alone, owner checks, preserved focus and consumed callback/remount lifecycle.
- Destructive password/provider logout requests use the captured recovery access token, not shared Auth SDK methods that reread another tab's account. Credential stays in a function closure, capped at ten minutes/provider expiry; no refresh token, password, provider response or credential is persisted/logged by the helper. HTTPS, no redirects/cookies, native10s deadline.
- Nonsecret saving/saved/cleanup phases survive screen remounts. A confirmed save is retained even if accounts change during the request. Interrupted cleanup retries cleanup only; acknowledged provider logout is idempotent. A different browser account is not targeted with password change or logout.
- Bearer-verified API logout maps only the existing verified subject, never links/creates/accepts actor selectors, deletes that subject's existing API sessions and preserves a different account's cookie. Linked IDs no longer accept their former legacy password. Own-session linkage is a boolean, with no external subject exposed. No schema migration.
- Customer account wording simplified and redundant linking prompt suppressed for linked identities.
- Two branded responsive HTML templates and prepared plain-text alternatives, clear buttons and latest-link/safety/help guidance. Generic greeting avoids interpolating untrusted metadata. One-hour copy is supported by the actual3600-second dashboard setting read today; recheck before installation.

## Actual local evidence

- Final regression: **451 passed / 0 failed, 33 files**,163.8s, `work/account-email-20261027/bound-full.json`.
- Earlier focused36passed; the final full report also includes the remount-completion regression added afterward. TypeScript passed; Vite build1671 passed. Existing large Communications chunk warning remains.
- Actual isolated HTTP/SQLite:47 own-link/identity role checks;15 recovery session checks. Recovery fixture waits for its own child-owned ephemeral listener before any writes. Provider verification is explicitly synthetic in that fixture; it does not verify real JWT/provider revocation.
- Controlled network tests verify captured Authorization after the original session object changes to another account, failed provider-logout retry, deadline/disposal and no credential serialization. These are actual helper requests against controlled responses, not real Supabase acceptance.
- Template structure/safe-link/plain-text checks passed. Actual browser rendered both templates in390px and600px panes with synthetic links. These are local HTML panes, not physical-phone or email-client/inbox acceptance. Frame-dimension inspection was unsupported; no measured overflow claim.
- Independent read-only review resolved the bounded findings, including cross-account SDK retargeting, cleanup phase loss, save-in-flight acknowledgment loss and remount completion. Its Important broader session-revocation gate remains open.
-145 protected primary source/assets remain unchanged. All implementation is in the isolated branch; dirty primary source was not published.

## Hosted configuration evidence and blockers

**DEPLOYED:** the founder explicitly approved adding exact `https://ecovibes-api.onrender.com/?recovery=1`. Browser Save URLs completed and subsequent configuration read showed both the root and exact recovery address. Root Site URL remains unchanged. No wildcards or weakened confirmation were added.

**BLOCKED:** Supabase dashboard explicitly shows custom SMTP missing and templates locked until it is configured. Email confirmation remains enabled. Sender ownership, SPF/DKIM/DMARC and actual delivery are unverified. The required `aws-secrets-manager` workflow is unavailable, so no credentials were read, replaced or bypassed. No actual email was sent. Plain-text sources are prepared alternatives; actual outgoing MIME support must be verified.

**Important release gate - UNVERIFIED:** browser-session clearing, concurrent API session issuance, and old-provider-access-token rebridging. The installed SDK may retain an old browser session after refresh rejection while its access token is still valid. `loadSession(false)` avoids immediate rebridging after cleanup; this does not prove future ordinary restoration or malicious cached-token rejection. Existing-cookie deletion and provider logout acknowledgments are not complete local/global revocation certification. Do not deploy this as fully repaired recovery without the next security increment and real Auth evidence.

Two controlled real inboxes/accounts still need signup/receipt/confirmation/expiry/resend/recovery/new-password login/restart, actual desktop/mobile email rendering and account/org isolation. No private auth rows or credentials were inspected, no repeated email sent, and confirmation was not disabled.

## Preserved failures and limits

Initial missing-module RED and temp-directory EPERM were followed by executable regression failures; scripts reran with approved disposable access. Initial identity assertion failed because linkage flag was missing; review REDs reproduce lifecycle/race defects. Earlier full445/1 ProviderOnboarding5s timeout remains in `full-final.json`; later447/0 and current451/0 did not diagnose QA-001. No deadlines, assertions, workers or isolation were weakened.

Local Python preview server failed importing `email.message`; the pinned Node preview served the static files instead. Saving a browser screenshot to disk was denied; the setting was verified by the subsequent visible configuration read, and email panes were visually inspected. Unsupported iframe window inspection and a denied process-list attempt are not acceptance passes. Keep all reports, including failed/superseded ones.

## Roadmap and hosting

The [single authoritative dashboard](../partner-readiness/README.md) follows the founder's latest ten-step order. The previous dashboard is archived without dropping its dated evidence. New Activity Centre/low-data/Trust/support/impact work is queued, not implemented just because it is listed. Phase0/security gates take precedence over calls and expansion.

Hostinger VPS KVM2 is a candidate for app/owned LiveKit capacity testing; it is not purchased or provisioned. The founder's screenshot shows USD210.96 upfront for24months and renewal USD14.99/month for the same term, before an independently confirmed final quote. Unlimited shared web hosting is not the proposed media host. Domain eligibility, tax, region, TLS/TURN, load, backups and rollback remain to verify. Existing Render/Supabase stay in place. Costs are planning; no spending cap, checkout, DNS/migration or paid inference was activated.

Rollback to current26c1b555 is schema-compatible because this candidate changes no schema, but it restores old account UX/security defects. No production rollback/restoration drill occurred. No source PR/CI or hosted account acceptance exists for this local candidate.
