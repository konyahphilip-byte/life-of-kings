# Automatic foreground friend-request updates

This bounded client release improves the saved friend-request capability from PR21. It does not activate voice/video, room tokens or push notifications.

## Behavior

- While the page is visible and online, the request inbox checks the existing authenticated API about15seconds after the previous check completes. A selected search result also checks its own relationship, so acceptance can replace Request sent without another search.
- Inbox rows consume the parent snapshot and do not each start a polling loop.
- Hidden/offline pages abort pending reads and pause checks. Returning, reconnecting, an explicit refresh or a committed local friend action wakes the checker.
- Checks do not overlap. Each network request has a10second deadline; failed reads back off30/60/120seconds.401/403 stops automatic checks until explicit interaction or identity change.
- Account/query change, sign-out and unmount invalidate generations and abort old work. Stale responses cannot restore another account's state.
- Friend actions still require an explicit click and existing server consent/revision/CSRF checks. A timed-out action is not silently re-submitted; refresh checks the latest saved state.
- This is foreground polling, not instant/push/background call delivery. Existing manual refresh remains available. Browser/mobile timer throttling and retries can delay updates.

## Scope and evidence at preparation

Isolated branch codex/connect-friend-updates-20261027 is based on verified main29cd5dbf. Only FriendsPanel.tsx, its tests, PeopleLookup.test.tsx and this receipt are included. PeopleLookup's existing shared FriendActions consumer needed no source edit. No schema/server/provider/secret/auth permission/paid/media/GPS/email/payment change; unrelated dirty-primary work excluded.

Behavior RED14pass/5fail reproduced missing receipt updates, visibility return, bounded stalled reads and stale searched status. First GREEN19passed. Explicit successful-retry restoration then reproduced13pass/1fail and was corrected; final focused20passed. Full suite405tests/29files and TypeScript passed before the review's wording correction; final focused20passed after neutral timeout wording. Initial interrupted verification did not produce a final report and is not counted as a pass. Existing QA-001 history remains undiagnosed; no test deadline/assertion/worker/isolation weakening.

Independent source review found no Critical/Important issue, and one Minor timeout sentence that incorrectly promised an automatic action retry. It is now neutral and directs the user to refresh saved status. Exact final CI, hosted artifacts/access, and actual account/device behavior remain release/acceptance gates at this preparation cutoff.

## Rollback and remaining work

Previous29cd5dbf is schema-compatible application rollback, retaining the existing friendship/block table. No production rollback drill is claimed. Source/local/CI/hosted evidence is recorded separately under work/connect-friend-updates-20261027 in the primary workspace.

Founder two-phone friendship acceptance is still pending. EcoVibes-owned media infrastructure, strict admission/revocation, incoming call delivery, per-call/video consent, actual voice/video, slow-network and device tests remain incomplete. Chale remains independent of call media. No simulated call or polling loop is described as real media communication.
