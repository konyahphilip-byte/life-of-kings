# Privacy and permission controls — 29 October 2026

Status: **LOCALLY BUILT**. Separate branch `codex/privacy-permissions-20261029`, based on profile draft PR29/c4476052. No merge, deployment, provider setting, new service, purchase or migration was performed. Current hosted application remains approved PR28/main9d344a2d.

## Actual implementation

- Web/PWA inventory: selected photo/video/CSV files, LiveKit camera/microphone, explicit clipboard writes and system Share actions. No native Android/iOS app, address-book reader, genuine device GPS publisher or push-permission integration exists. Those absent features were not added or prompted for.
- Joining a media room starts with automatic audio/video capture disabled. Custom controls replace prefabs that could capture or screen-share directly. Each microphone/camera request explains its purpose and calls the official browser getUserMedia API separately, only after a user action and current room authority checks. A second Share action authorizes transmission to participants. Extreme Saver keeps camera controls off.
- Device permission is checked on capture and publication. Unknown browser query support does not mean granted. Browser denial is respected without automatic retries; a later explicit request can recover only when a supported query reports a genuine grant. Browsers unable to report status may require reopening the room after a settings change.
- Permission revocation, ended/muted tracks, account changes, hidden pages, room permission loss, reconnect, leaving and unmount stop owned tracks. Pending grants/publishes cannot retain a device after cleanup. There is no device enumeration, recording, contact access or screen capture in these controls.
- Official individual-file pickers remain the only library access. Explanations precede them; separate, audience-specific upload/storage choices guard profile images, Story photos, Reel videos, product photos and both CSV imports. A changed file/audience resets consent. Product-photo cancellation/withdrawal aborts local reading and invalidates subsequent requests; a request already sent cannot be recalled.
- Captured expected-owner assertions on social assets, Stories, Reels and catalog writes reject account switches. Social viewers/feed state and seller/store state clear on identity changes; late reads and pending posting operations are invalidated. Files/blob URLs are released on editor/view cleanup rather than persisted to browser storage.
- Chale model processing requires a separate memory-only chat choice, reset on account changes or withdrawal. It covers recent chat text, the current screen **name**, data mode and relevant public listings. Local guidance and separately authorized work-status controls remain independent. Withdrawal cancels the local wait and clears visible chat; it cannot recall a provider request. No uploaded files, private messages, contacts or device coordinates were added to model context.
- Settings and Chale link to Privacy & Permissions. The page queries status without requesting capture, offers Stop devices and Turn off model processing, explains browser/device settings, and discloses server-copy/provider-retention limits. After the founder's screenshot question, raw “prompt” became “Ask when needed”; permission is explicitly distinguished from active capture.
- No new sensitive-data logging or analytics were introduced. Web Permissions-Policy also disables screen capture; location remains disabled.

## Files changed

New `src/modules/privacy/` contains the permission controller, room controls, file-consent components, settings page, styles and their tests. Integration changes are in:

- `src/modules/App.tsx`
- `src/modules/Communications.tsx` and its test
- `src/modules/MarketplaceHub.tsx`
- `src/modules/SocialHub.tsx`
- `src/modules/backend/BackendWorkspace.tsx`
- `src/modules/profile/PeopleProfile.tsx`, existing tests and new privacy regression
- `src/modules/assistant/Sidekick.tsx`, its test, `assistant.ts` and `guide.ts`
- `server/index.mjs`, `server/web.mjs`
- `scripts/test-profile-workflow.mjs`
- `public/privacy.html` and this report.

## Verification and retained failures

- Full local regression: **487/487 tests, 40 files**. Final screen-label-only follow-up: **1/1**, TypeScript and production build **1,678 modules** pass. Exact draft CI is a separate gate and must be read before claiming it passed.
- Actual isolated HTTP/SQLite workflow: **16 checks** including five wrong-owner upload/catalog denials, saved profile media and existing friend/message/receipt isolation.
- Dependency audit: **0 vulnerabilities**. Pinned Node26.12.1 / builtin Undici8.12.2 / npm Undici8.12.3 / Vite8.3.5 security checks and **8 local HTTP assertions** pass.
- Independent read-only review reproduced private Story state surviving logout and product uploads continuing after withdrawal/cancellation. Both were fixed and covered. No remaining Critical/Important findings; final review also verified the saved full results/source hashes. Minor wording, settings-recovery and actual room-event coverage suggestions were addressed.
- Retained reports: initial missing media module/profile consent RED; flows-red0/4; page-red0 collected; focused-first73/2 (new-account consent fixture and in-flight test synchronization); focused-second75/0; integration-first33/0; account-race-red7/3 (Story leak plus two incorrect Join locator names); review-red10/3 (cancelled read, denial recovery and muted capture); review-green87/2 (same locator errors corrected to Join live); full-first485/0; full-final487/0; labels-final1/0. Initial restricted heredoc/Git metadata failures and browser locator attempt are documented as environment/fixture failures, not feature passes. No test deadline, worker, assertion or isolation relaxation. Historical QA001 cause is not diagnosed by these passes.
- Local browser: Settings → Privacy & Permissions opens; actual browser reports camera/microphone in ask state without opening a capture prompt. Desktop and narrow layouts inspected. A fresh 390px DOM measurement has scrollWidth390/no horizontal overflow; an immediate earlier resize sample reported433 before the fresh settled read. Rebuilt screen shows “Ask when needed”. Mobile Profile → Settings → Privacy is reachable. No real camera, microphone, location or contacts were granted by the agent.
- Existing large application/Communications JavaScript chunks remain a performance warning. Chale's broader launcher overlap repair remains separate draft PR27.

## Remaining gates and approval

1. This branch is stacked on **unmerged PR29**. Its profile migration and approved private storage remain prerequisites; no hosted bucket exists in the last bounded metadata check. Keep other draft PRs separate.
2. Obtain exact-source CI, reviewed merge approval and a compatible controlled release before deployment. No new schema is introduced by the privacy delta. Restore/rollback must preserve consent gates; disabling affected media/model features is safer than restoring code that bypasses them. No production rollback drill occurred.
3. Actual Safari/installed-PWA/Android browser granted, restricted, denied and revoked device flows, native selected-item behavior and real two-account/device acceptance remain **UNVERIFIED**. Unit tests use controlled browser/transport boundaries and are not hardware tests.
4. Owned TLS/media/TURN, genuine call consent/lifecycle and provider revocation remain **BLOCKED/UNVERIFIED**. These UI controls do not enable private calling or certify hosted media safety.
5. Provider retention/training, final upload retention/deletion, media metadata stripping, support handling and operational privacy compliance need further verification/work. Browser denial cannot delete server copies. No guarantee of erasure, legal compliance or complete application security is made.
6. GPS, contacts and push should receive their own minimum-access permission flows only when those features are genuinely implemented.

Founder approval needed for release, not for this local implementation: reviewed PR29 prerequisites/private storage and migration, then a separately reviewed merge/deployment of this privacy change. No paid service or broader launch is approved.

Next implementation-ready task: review the exact draft CI and integrate the independent Chale mobile launcher repair with these controls, preserving local guidance and character-independent chat.

Primary evidence: `work/privacy-permissions-20261029/` reports, source hashes, HTTP/security/audit/build results and release receipt. Official API references: [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [permission queries](https://developer.mozilla.org/en-US/docs/Web/API/Permissions/query), [LiveKit publication](https://docs.livekit.io/reference/client-sdk-js/classes/LocalParticipant.html).
