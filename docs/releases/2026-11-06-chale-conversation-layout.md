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


A390px local browser verified704/828px (85%) conversation height, hidden navigation, three complete turns, retained draft/processing disclosure and restored navigation on close. CI42262180495 still observed navigation visible at its immediate opening check. The harness now waits for the same required hidden/visible states before asserting, with viewport/body/style diagnostics retained and no deadline or hide/show assertion removed. The timing difference is not relabelled as a product pass; final CI must establish the outcome.


Browser42263296124 passed the mobile visibility wait and conversation-space check, then failed its pending-reply reading-position expectation. The initial fixture had only three short prior replies, which can fit inside the enlarged thread; scrolling to zero does not establish that a user left the bottom in that case. The fixture now provides six completed turns and explicitly requires more than100px of earlier-history overflow before holding a seventh reply. The original no-jump assertion and all limits remain. Final logs must verify this strengthened precondition; no product cause is inferred merely from a passing rerun.


## Verified code checkpoint

Remote4f2bce99136f68219cce356280cf3cf844048435, localaa302c4a0fd75ca580e2bc2011b635cffb9315a4 and actual CI merge0f589980b5f72ba6b5ee5cda9bd921061e07ed3d share tree3e315727319fbed9d68ccbfceb23d530cb2246ff. Release42268051123 and Browser42268051022 both passed; complete decoded job logs were inspected.568tests/43files, TypeScript/build1685, audit0, eight dependency-security assertions, existing HTTP workflows and disposable PostgreSQL18.6/message84 passed. Existing navigation produced39 result records plus10 dedicated conversation records, all passed; this is49 grouped browser checks, not the earlier unverified41 baseline assumption.

Verified artifact13528461370 contains6,427,814bytes, SHA25686a8892e9cb09e478fe4e7920ca0f11d9ccef4eb8cfb6fb92db6b0754b52b6eb. The320/390/1280px conversation and information views and844x180 short view were inspected. Conversation geometry is704/828px at390,600/724px at320 and596/720px at1280 (83–85%). Six completed turns plus a pending seventh produced470/722/578px of true overflow before the original reading-position assertion passed. Information preserves draft, focus and history; navigation returns after closing. These are actual Chromium UI tests with synthetic replies, not physical-device, live-model or hosted acceptance.

A bounded author source/security review found no remaining blocking findings in this six-file increment. This is not an independent GitHub approval: no submitted review was returned. Independent review, explicit merge/deploy approval, green main CI and hosted checks remain release gates. Physical keyboard/zoom/rotation/low-end checks remain UNVERIFIED. All preceding failures remain in primary evidence, including the four browser attempts, original REDs and the old-Python artifact-extraction diagnostic; no deadline/assertion/worker/isolation was weakened. The documentation-only follow-up must also pass head CI before any release.
