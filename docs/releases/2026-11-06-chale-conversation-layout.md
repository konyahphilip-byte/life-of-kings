# Chale conversation-first layout — 6 November 2026

LOCALLY BUILT on `codex/chale-conversation-layout-20261106`, based on production main `56e0c2ebf83dfc2c89fccd0bc552691e4ae42b9b`. No commerce draft, private-work draft, Auth/profile/privacy, model provider, server, schema or deployment changes are included.

## Actual repair

The founder's phone screenshots showed large header/decorative and disclosure sections crowding out conversation. The panel now has a compact56px header (48px at short heights), no decorative context banner, a readable16px composer and independently scrolling14px messages. On phones the chat uses the available app viewport and hides the app's bottom navigation while open; closing restores it. Browser/OS chrome remains under browser control.

Reply processing, allowance and learning information are behind the header information control. The information sheet has its own scroll area, leaves the thread's geometry intact and preserves the unfinished question and reading position. Back/Escape restores focus; Escape dismisses information before closing the chat. Inactive thread/input controls are inert while information is open. Disclosure and learning controls remain available, with original permission, identity, request and feedback checks retained. Character visibility never controls the chat.

An arriving reply no longer moves a reader away from older messages. Sending a new question or reopening chat follows the latest conversation. History remains in existing component memory; this does not add cross-device chat storage or private-conversation training.

## Files

- `src/modules/assistant/Sidekick.tsx`
- `src/modules/assistant/sidekick.css`
- `src/modules/assistant/Sidekick.test.tsx`
- `scripts/test-chale-conversation-browser.mjs`
- `.github/workflows/navigation-browser.yml`
- This receipt.

The existing browser workflow retains its navigation checks, adds dedicated conversation geometry/history/draft/information/short-viewport checks and reuses the already verified official HTTPS Ubuntu mirror transport correction. No browser dependencies, assertions or deadlines are removed.

## Verification at the local checkpoint

- Three behavior regressions reproduced:48pass/3fail. Existing behavior was retained.
- Initial implementation47pass/8fail: eight existing tests expected disclosure/learning text to be in the main conversation. Tests now explicitly open/back from information, retaining the same allowance, CSRF, consent, reset and feedback assertions. Model-configuration status remains separately identifiable.
- Final focused Sidekick/preferences:55 passed. Full local suite568 passed/43files before the final CSS-only mobile-navigation adjustment. TypeScript and production builds pass, and dependency audit/security receipts are recorded in primary `work/chale-conversation-layout-20261106`. Exact final CI/browser evidence is required separately.
- Local Chromium headless shell is known unsupported on this Mac's OS from the preceding milestone; no repeat install or platform-check bypass. The final built-browser geometry/screenshots must be read from Linux CI.
- Physical iPhone/Android keyboard, browser zoom, safe-area/rotation, low-end performance and hosted acceptance remain UNVERIFIED. Synthetic replies are not model-quality or two-account acceptance.
- Historical QA001 timing failures and the Communications chunk warning remain. No deadlines, assertions, workers or isolation weakened.

## Release boundaries

This is a reviewable UI increment, not a production release. Require exact CI/log/artifact and source review, explicit bounded merge/deployment approval, green main checks and hosted verification. Rollback is a code-only return to main56e0c2eb; no schema or private history changes. Do not merge other drafts as part of this repair.

Chale's model/tool authorization,40-request free allowance, guest network bucket, no paid fallback and independent optional-character settings are unchanged. No camera, microphone, photo or location access is requested. No secret, paid resource, fee, migration or real-user message is involved. All protected dirty-primary work must remain intact.



## Initial CI follow-up

Candidate c3aad4d3 release42258451406 passed. Browser42258451601 retained the existing navigation checks but the new conversation harness stopped before layout assertions: the unscoped Ask Chale AI selector matched both the header shortcut and Home's hero action. Both product entry points remain; the harness now selects the reserved header shortcut explicitly. No test deadline or assertion was weakened. Exact follow-up CI/screenshots remain required.


The follow-up browser42260263050 reproduced visible mobile navigation before any geometry checks. Chale is rendered outside the app wrapper, so the app-scoped :has selector did not match. The source now scopes that condition to the document body; navigation remains hidden only while the chat exists and returns on close. The original assertion is retained.
