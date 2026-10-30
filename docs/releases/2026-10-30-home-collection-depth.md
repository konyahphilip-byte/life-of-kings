# Home and collection depth views — 30 October 2026

Status: LOCALLY BUILT. Stacked on the separate navigation-recovery draft. No migration, merge or deployment.

Founder selected **Home and collection views**, preserving EcoVibes' green identity and a lightweight 2D option. This is a refinement of those existing surfaces, not a new operational capability or a 3D Chale character.

## Source implemented

- Shared `DepthView.tsx` and `depth-view.css`: authored CSS 3D solids for the EcoVibes ID and recycling bin, plus authored flat SVG illustrations. Standard mode can switch between 2D/3D. Saver/Extreme, reduced motion or unsupported CSS 3D use the flat scene. Only the non-sensitive flat/depth preference is saved. No new rendering dependency, WebGL canvas, sensor, remote image, animation loop or account data.
- Home `EcoVibesAfricaOSHome.tsx` and `eco-home-depth.css`: sculpted ID scene, larger readable type, separated six pillar links, usable touch targets, retained ID and independent Chale actions. App passes the existing data mode.
- Collection `WasteHub.tsx`/`waste.css`: retained collection photo in a layered frame with authored recycling objects; retained request/provider controls, current sign-in and server workflow behavior. Extreme Saver still omits the photo. Existing factual disclosure stays visible.
- Browser harness extends the navigation check with real CSS 3D/flat rendering, desktop/narrow captures and a reduced-motion/default-Saver collection action check in isolated Chromium. It uses built files, intercepted synthetic guest APIs, blocked service workers/WebSockets/external requests and no provider access.

## Evidence

Initial missing-module RED retained in primary `work/depth-view-red.json`; first focused **23/23** (depth behavior plus 18 real page smoke checks). A first TypeScript check found an obsolete Leaf import after replacing the old decoration; it was removed. Final local full **483/483**, TypeScript, production build **1676 modules**, and eight dependency security assertions pass. No timeouts, assertions, workers or isolation were weakened. Historical QA-001 remains undiagnosed. Existing large bundle warnings remain.

Primary evidence directory: `work/home-collection-depth-20261030/`. Exact CI/browser screenshots and independent review start UNVERIFIED until their actual results are recorded. mac13 cannot install the current isolated Chromium; Linux CI supplies browser verification. Narrow desktop emulation is not a physical phone or low-end-device acceptance pass.

## Boundaries and remaining work

The 3D art is decorative CSS depth, not a geographic map, live collector position, completed pickup, verified impact, payout, functioning game or rigged character. GPS draft PR32, geographic maps/routes, owned media, Finance, checkout, email and profile/privacy releases retain their own acceptance gates. No new permissions are requested by these scenes; separate privacy controls remain a distinct draft.

Safe release has no database change. A source rollback retains domain data and restores the prior visual presentation. Exact candidate CI, bounded desktop/narrow screenshot review, explicit merge/deployment authorization and hosted checks are required. Real phones/low-end rendering, physical GPS and server/provider journeys remain UNVERIFIED or BLOCKED. Approval to style pages does not authorize production deployment.
