# Happening now automatic updates and news — 4 November 2026

Status: LOCALLY BUILT. Separate increment stacked only on draft PR36 (and its navigation/visual parents33–35). No merge, production deployment, schema, credentials, paid API or infrastructure change.

## Implemented behavior

Home loads public sources automatically while visible and online. It refreshes at the earliest source expiry, with a minimum30second gap, one client request at a time,12second cancellation and1–5minute failure backoff. Hiding/leaving/offline cancels work; return/reconnection resumes. Expired entries disappear with an honest stale label. Manual refresh remains optional. No images, audio, video, account data or AI inference are fetched by this panel.

All/Trends/Music/News controls filter already-loaded data. Trends are Google search interest in Ghana. Music is the Apple Music Ghana Top Songs chart, with artist/chart date/copyright/direct links. News has two distinct groups: allowlisted publisher headlines linked in Ghana’s Google Trends RSS (labelled Trend date, not article publication date), and UN Geneva briefings (original publication dates). Neither is comprehensive world/national news or independently fact-checked by EcoVibes; no fabricated platform activity or popularity metrics.

The existing endpoint keeps its two core sections and adds news. Ghana related headlines reuse the same Google response. UN uses one fixed canonical public RSS URL,5second native timeout,256KiB/100entries/4shown,15minute single-flight success cache and5minute failure cache; source age capped at7days. Own-key publisher allowlist, plain text/HTTPS/host/calendar/date validation, deduplication and final-response deny switch prevent forged/expired data. Core rate/failure/cache controls remain.

## Sources and permissions

- [Google reuse and attribution](https://support.google.com/trends/answer/4365538)
- [Apple RSS lists for websites](https://performance-partners.apple.com/tools)
- [UN Geneva RSS website display permission](https://www.ungeneva.org/en/news-media/rss)
- Fixed UN feed: https://www.ungeneva.org/en/news-media/press-items-list/rss.xml

Show metadata and original links only; no full articles, images, music playback or scraped X/TikTok content. These public reads required no keys or payment in the observed checks. Provider availability and terms remain source-specific.

## Actual evidence and retained failures

4November11:12UTC one actual local adapter request: Google200/four search topics; three allowlisted related headlines; UN200/four dated briefings. Apple hit the5second timeout and is reported unavailable. This is local public-provider evidence, not hosted acceptance, sustained availability, article fact certification or a positive music result. Historical30October direct Apple200/10Ghana songs and later502 remain valid bounded history.

Focused60/60, TypeScript, production build1683, security8 and six isolated actual HTTP endpoint guards passed before draft preparation. Source review reproduced/fixed final disable race, inherited publisher keys and invalid calendar normalization; all RED reports retained. Initial full regression550 tests:549passed/1failed, the existing account route heading lookup timed out at1132ms. No timeout/assertion/worker/isolation settings changed; cause remains undiagnosed. Final full-suite/exact CI/browser results are recorded in the authoritative dashboard and work/happening-auto-news-* after execution, never inferred from these focused results.

Retained: original missing-module/UI REDs, temp EPERM0-collected run, invalid Testing Library option/type error, review metadata/disable RED40/2 and validation RED22/4, initial Apple timeout/502 history. Passing checks do not diagnose historical QA001. Large index/Communications bundle warnings remain.

## Release gates

Require exact-source release/browser CI, review, explicit bounded stack merge/deployment approval, green main CI and hosted checks. No database migration is needed. Pre-release rollback is the prior app36 with the same schema; this has not been drilled. Existing ECOVIBES_PUBLIC_TRENDS_DISABLED is deny-only and covers the final assembled response. Check returned per-source status/timestamps; no private data or raw upstream bodies in diagnostics.

Physical mobile/network/hosted source acceptance, broader Ghana/world/event coverage, reliable music availability, Chale source-tool integration and genuine EcoVibes trend aggregation remain UNVERIFIED or NOT IMPLEMENTED. Other authentication/email/media/GPS/Finance/Waste/pilot gates remain open.

The founder selected multiple interests for later optional connected-account recommendations. No other-app activity collection, OAuth connection, personal data import or recommendation-consent feature is implemented by this increment. Each future service requires official supported scopes, separate informed opt-in, access/cost verification, revocation/deletion and account-isolation tests. Device permission alone cannot grant service data access. Public-source ranking remains separate.
