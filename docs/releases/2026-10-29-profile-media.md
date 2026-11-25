# Profile photo, cover and relationship sync — 29 October 2026

LOCALLY BUILT in isolated codex/profile-media-20261028, separately from Auth24/Chale25/Bag26/mobile27. PR28 notifications/navigation are retained as the approved baseline. No profile migration, hosted source, storage setting, paid resource or real-account image has been changed.

## Implemented behavior

The own Profile now has an editor for JPG/PNG/WebP profile and cover images up to5MB, with remove controls. Images reuse existing media assets/storage. Member visibility is disclosed before save; authenticated image reads check current active accounts and request blocks and return private/no-store. Already downloaded bytes cannot be recalled. Profile changes appear successful only after an account-bound server acknowledgement. Extreme Saver omits profile image requests until an explicit Load action.

Friend, follower and following counts query existing saved active relationships, not preview numbers or a limited roster. Private selectors/foreign image ownership/video-as-photo are rejected. Uploads include a captured-owner assertion. Profile saves use owner-row locking, optimistic revisions and transactional metadata events; exact retries do not add another revision. Referenced images have foreign-key protection and indexed references.

Closing the editor discards all selections/removal flags. A revision conflict offers an explicit draft-discard/reload action; ordinary refresh never silently rebases an edit. Read errors keep the native file fields mounted and disable Save until the profile is verified again. Confirmed upload IDs remain reusable for an unchanged save retry. Account changes abort/ignore old responses.

## Verification

Final457/457 tests across34files;18focused/2files; TypeScript/build1673; audit0 and dependency security probes;15 actual local HTTP checks passed. Disposable PostgreSQL17.10 passed116 exact migration/runtime/concurrency checks, retaining receipt coverage. Eleven source/workflow hashes stayed unchanged during final verification. All145 protected primary source/assets remained unchanged.

Actual local browser390×844: signed into a synthetic account, chose two1×1PNG fixtures via native file choosers, saved both, decoded both, reloaded and re-opened Profile with both still present. Counts matched one accepted friend/one follower/zero following. No horizontal overflow; Extreme Saver showed zero profile images until Load, then both decoded. This is local synthetic acceptance, not hosted storage or physical-account acceptance. Temporary viewport reset/tab closed; no exported screenshot is claimed.

Review reproduced and fixed three Important editor lifecycle findings. Retain editor-red0/2 and refresh-red0/1, earlier missing-module RED, UI5-second timeouts and a restricted-temp-folder0-collected EPERM report. Passing current checks did not diagnose historical QA001. Local preview creation was unusually delayed; initial sign-in locator timeout was followed by inspected correct state. Preview stdin had closed; cleanup used the exact owned preview process signal and exact synthetic asset/database cleanup. Existing bundle-size warning remains.

## Proposed migration and release gates

Additive migration20261028233000_people_profile_media.sql remains UNAPPLIED. SHA256 ddcc73a450aa96d83e5145773c20a0107cb21f1ff40b13fa2db7b1c13dde3979. API-only RLS SELECT/INSERT/UPDATE policies; no direct anon/authenticated/service_role access, no runtime DELETE/TRUNCATE. Image/follow reverse indexes support reference/count queries. Marker gating leaves counts usable while media editing is unavailable.

Rollback retains profile/media/relationship data; never drop user images or the new table. Production storage/private bucket access, restart durability, hosted two-account ownership/block checks, exact CI and explicit migration/merge/deployment approval remain gates. No production rollback drill or launch certification.

Changed files: server/people-profile.mjs and test; server/index.mjs; src/modules/App.tsx; src/modules/profile/PeopleProfile.tsx, test and stylesheet; proposed migration; local HTTP/PostgreSQL scripts; release-checks.yml; this report. No new dependency.

Create's general composer/photo gallery/short-video publishing remains a separate next increment. Existing Stories are24hour records; do not describe them as permanent photo posts. Reuse existing media/reel services with safe publication retries.
