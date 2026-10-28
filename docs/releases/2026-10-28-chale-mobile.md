# Chale mobile display repair — 28 October 2026

LOCALLY BUILT; not merged, deployed or physically accepted. Based on PR25 dd53f2b; this is a separate mobile-only increment, not a rebuild of private-work routing. No Auth/Bag/server/database/provider changes.

## Code

Compact default launcher; left/right and hide options; floating control suppressed while chat is open, on Settings and over outside form editing. Profile → Settings → Personalization provides a permanent Open Chale AI route. Display-only preferences are sanitised and saved on the device, with an honest tab-only fallback when storage fails. Account identity/chat/private tools are not stored in these preferences.

The character checkbox changes only future visibility; production 3D assets/rig/GLB remain unavailable and explicitly described as such. Turning it off does not disable chat or cancel a pending reply. No character/GPU integration is claimed.

The panel uses reported visual viewport/keyboard dimensions, retains at least96px thread height, has a scrollable parent and expandable disclosure,44px close controls and confirmed focus restoration. This does not certify every keyboard, browser, low-end device or accessibility criterion.

## Changed source

src/modules/App.tsx; App.identity.test.tsx; assistant/Sidekick.tsx; Sidekick.test.tsx; sidekick.css; new ChalePersonalization.tsx, Sidekick.display.test.tsx, chale-ui.ts and chale-ui.test.ts.

## Evidence and retained failures

- Focused reviewed86/86 passed. Initial import RED; initial73/1 test assertion corrected from HTML attribute to live checkbox state. Later82/3 and85/1 reports retain existing5-second app-shell failures.
- Full-final504/504 across34files passed before the final type-only fixture correction. The last full fixture-isolated run passed503/504: its10 App identity/Settings tests passed; existing ProviderPortal edited-details test hit5seconds. No deadlines/assertions/workers/isolation were weakened. Historical QA001 remains undiagnosed; overall release regression gate stays open pending exact CI.
- Initial type command incorrectly referenced nonexistent tsconfig.app.json; corrected project check found an unsupported test-only exact property. Removed it without changing Testing Library's exact-name behavior. Verified project TypeScript passed before the final unrelated-language fixture isolation; final exact CI remains required.
- Vite production build1672 and dependency-security probes passed; fresh npm audit0. Existing Communications chunk warning remains.
- Independent nine-file source review found no remaining Important/Critical issue at the reviewed hash checkpoint. Final fixture-only mock isolates the unrelated language directory; source behavior is unchanged.
- Actual local browser390×844: compact56px launcher and16px gap above64px nav, no horizontal overflow.844×180: fixed thread96px,73px usable after padding; keyboard-scroll End reached latest reply;44px close control visible.
- Actual local UI: hide floating button → Open Chale AI from Settings → close restored focus to settings opener; compact/left preferences accepted through native selects. Last attempted left geometry used an incorrect selector and returned no launcher measurement; do not count it as left-geometry proof.
- Screenshot export to the evidence directory was denied EPERM; screenshots were seen inline but no exported PNG is claimed. Initial browser inventory/native startup failed, direct IAB navigation recovered. Earlier select-by-exact-label failed; a fresh grounded combobox locator worked.
- Local preview had no API on8787, so status fell back to App guide. Native greeting is a template, not real inference. Existing hosted browser was signed out. No new hosted private/account/model acceptance or production change occurred.

Primary evidence: work/chale-mobile-20261028 with all RED/focused/full/type/build/audit/security reports and source hashes. Protected dirty primary source/assets remain outside publication.

## Remaining gates

Exact candidate CI and final source/evidence review, owner approval to merge/deploy, hosted mobile/keyboard/real-account acceptance, PR25 two-account nonempty/privacy/provider/quota gates. This build does not solve SMTP, calling, GPS, durable publishing/checkout, or 3D production assets.

