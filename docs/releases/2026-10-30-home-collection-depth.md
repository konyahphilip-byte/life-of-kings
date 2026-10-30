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

Primary evidence directory: `work/home-collection-depth-20261030/`. The initial pending-CI note is superseded by the final evidence below. mac13 cannot install the current isolated Chromium; Linux CI supplies browser verification. Narrow desktop emulation is not a physical phone or low-end-device acceptance pass.

## Boundaries and remaining work

The 3D art is decorative CSS depth, not a geographic map, live collector position, completed pickup, verified impact, payout, functioning game or rigged character. GPS draft PR32, geographic maps/routes, owned media, Finance, checkout, email and profile/privacy releases retain their own acceptance gates. No new permissions are requested by these scenes; separate privacy controls remain a distinct draft.

Safe release has no database change. A source rollback retains domain data and restores the prior visual presentation. Exact candidate CI, bounded desktop/narrow screenshot review, explicit merge/deployment authorization and hosted checks are required. Real phones/low-end rendering, physical GPS and server/provider journeys remain UNVERIFIED or BLOCKED. Approval to style pages does not authorize production deployment.


## Final reviewed implementation evidence

Draft PR34 final implementation remote `5d9922f8462f6e17538920294af59ddfee5c1995` / local `6f4746e80e188ca783c14dda2b55c83d5ea0ae0d` share tree `a29133a25ec8fd6164ca263f2d051fe61aab3c3f`. Exact release CI **41031696807** (job123982701444) and browser CI **41031696809** (job123982700818) passed. Actual logs read: **484 tests / 37 files**, TypeScript/build1676, audit0, dependency security assertions, all eight existing HTTP workflows, disposable PostgreSQL18.6/84 and **20 built Chromium desktop/narrow scenarios**. These remain synthetic, not hosted or physical-account acceptance.

Six valid captures in primary `work/home-collection-depth-20261030/browser-reviewed/`: Home and Waste at1280/390 plus flat alternatives at390. Archive12966157569 SHA256 `00cdbb61dbc042930bd87ff7b62cf39a35255b3968e9a17e88e362912945ca71` verified. The first Home capture caught existing entrance effects before settling; it is retained and superseded. Final capture walks lazy content and finishes finite entrance effects without changing product motion.

Source review found noCritical/Important issues; a Minor conflicting toggle announcement was removed. Finish review confirmed the extension's materials, type, responsive reflow, actions and truthful disclosures; it required removing the touched Waste hero eyebrow. Final verdict **ship** scores that fix resolved, with valid recaptures and no visible regression from it. Documenter confirms the surface contract matches the incumbent system; missing PRODUCT/DESIGN files are pre-existing context debt, not a new visual system.

An actual mode-label RED exposed the sidebar's hardcoded Data Saver text in Standard mode; it now reflects the selected mode. All failed/interrupted attempts and QA001 history are retained. No schema, merge, deploy, provider configuration, money or hardware action occurred. Release still requires explicit bounded merge/deployment approval, green main CI and hosted checks. Later documentation-only updates retain the reviewed implementation source unchanged.
