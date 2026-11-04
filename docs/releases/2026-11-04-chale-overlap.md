# Chale overlap repair — 4 November 2026

LOCALLY BUILT on current live main1ee894d5; not merged/deployed or physically accepted. Reuses only PR27's display/keyboard helpers, without PR25 private-work routing, model/server/Auth/schema changes. New source is isolated on codex/chale-overlap-20261104; dirty primary source/assets are preserved.

## Actual change

The unsolicited fixed Chale launcher covered the lower feed and form controls in the live390px capture. It now occupies a reserved header slot via a React portal, with a44px compact target. The opened dialog stays outside the sticky header. Phone widths force compact display even when the desktop label preference is selected. No floating shortcut is rendered over page content.

Reused compact/hidden preferences, chat left/right placement, Settings restore route, outside-form editing suppression, focus restoration, visual-viewport keyboard handling,44px close/send targets, scrollable short-screen panel and expandable disclosure. The optional character visibility preference does not disable chat or interrupt an answer; no production character model is included. Preferences persist only display fields, with an honest tab-only fallback.

## Files

App.tsx/App.identity.test.tsx; assistant/Sidekick.tsx,Sidekick.test.tsx,sidekick.css; reused ChalePersonalization.tsx,Sidekick.display.test.tsx,chale-ui.ts,chale-ui.test.ts; scripts/test-navigation-browser.mjs. Current screen recovery, optional signup purposes, public feed and server behavior remain unchanged.

## Tests and preserved failures

- First focused test could not collect because its temporary folder was denied EPERM. Approved normal rerun reproduced the actual defect:0passed/1failed, shortcut not inside its reserved host.
- After repair69/69 focused across4files, then565/565 full regression pass. No deadlines, assertions, worker settings or isolation weakened; QA001 remains undiagnosed.
- Production TypeScript/build1685 passed. Existing index/Communications large-chunk warning remains.
- Fresh npm audit0 and8 existing dependency HTTP assertions pass on pinned Node26.12.1/Vite8.3.5/Undici8.12.2built-in/8.12.3dev.
- Browser regression script now asserts reserved header geometry and nonintersection with other controls, visible feed heading,320px compact display, hide/restore/focus and844×180 input/close access. Its actual runner result is pending; no browser pass claimed yet.
- Live browser control returned browser.user unavailable for both existing/fresh tab handles and AX/DOM access. Recent live screenshot from the approved discovery release remains reproduction evidence, not new-fix hosted acceptance. No alternate control mechanism or credential workaround used.
- Display-only extraction had3merge conflicts; resolved preserving current screen boundary and excluding requestedWork/private-work imports. No unrelated drafts pulled in. An optional process diagnostic was denied; no process output or intervention.

## Release gates

Prepare a reviewable commit/draft PR, require exact-source CI including browser tests and scoped review, then obtain explicit bounded merge/deployment approval. Existing PR33–38 approval does not include this new change. No schema migration; current1ee894d5 is a compatible application rollback, not drilled. Actual hosted phone/keyboard/accessibility acceptance still required. No new resources, paid services, uploads, private records, provider inference or real money.

Primary work/chale-overlap-20261104 retains RED/focused/full reports and extraction previews. This document will be updated with actual CI evidence before release approval is requested.
