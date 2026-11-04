# Free Ghana topics and music sources — 30 October 2026

LOCALLY BUILT, not deployed. Branch codex/free-ghana-happening-20261030 is stacked on personal-account checkpointcb9348a/PR35, itself on reviewed visualPR34/navigationPR33. No other drafts or primary dirty source are included.

## Implemented

The Home Happening now panel replaces fixed2.4k conversations/840playing/3days-left entries with a request-only public source reader. Google Trends is labelled Ghana search interest, never confirmed news or EcoVibes conversations. Apple Music is labelled Ghana Top Songs, never all-Ghana popularity. Four plain-text entries per source, direct HTTPS links, source attribution, chart/entry and check timestamps, Apple copyright and independent unavailable states. The panel is reachable in the mobile layout and follows the existing dark theme. No thumbnails, music playback or media downloads.

The API accepts no user query/region/account selector. Fixed official endpoints only, no credentials/cookies/private input, redirect refusal, native5s timeout,256KiB and100entry bounds, plain-text/region/date/link validation, deduplication and4entry cap. Independent single-flight caches use10minutes for search and60minutes for music, capped by source freshness; failures/empty results cache5minutes. Expiry during a request is checked at completion. Client clears expired results rather than polling. Six requests/minute persistent endpoint limit; deny-only ECOVIBES_PUBLIC_TRENDS_DISABLED=true. No model call, paid API, key setup, schema or provider setting change.

## Actual source verification

Official Google help documents RSS export and reuse with attribution subject to its terms: https://support.google.com/trends/answer/3076011 and https://support.google.com/trends/answer/4365538. Native Ghana feed returned200/text-xml/21601bytes with Ghana search topics. Actual adapter also returned four current entries.

Apple explicitly offers RSS feeds for website lists: https://performance-partners.apple.com/tools. The legacy domain returned301 to https://rss.marketingtools.apple.com/api/v2/gh/music/most-played/10/songs.json. A direct request returned200/application-json/6725bytes, countrygh/10songs, chart updated30October2026 09:42:41UTC, Apple author/copyright and music.apple.com/gh song links. No API key or paid subscription was needed for these public reads. This is metadata linking, not a licence to download or redistribute audio/artwork.

Availability is intermittent: first7s canonical probe timed out; the longer direct verification succeeded in1631ms. Subsequent actual adapter checks returned Google available/Apple unavailable; diagnostic captured Apple502/text-html/910ms, not a timeout. These observations do not establish the cause of the earlier timeout or guarantee provider uptime. No automated retries/polling or access bypass. Primary work/free-ghana-live-provider.json and free-ghana-live-diagnostic.json preserve actual partial failures.

## Validation and retained failures

Final514/514 tests across40files pass; TypeScript and production build1681 pass. Existing dependency security8/assertions and npm audit0 pass. Actual isolated HTTP6checks passed: anonymous/no-store/no cookie, deny switch, rejected selectors and seventh-request429. Tests use synthetic data/no hosted accounts. New source tests cover cache/single-flight, RSS entities/MIME, forged links/region, wrong date/oversize bodies, provider403/429/503, completion-time expiry, attribution and UI failures.

Retained REDs: two missing-module suites; first focused19/20 failed because fixture expiry exceeded its declared timestamp; corrected contract20/20. Review reproduced three failures (RSS MIME, near-cutoff cache, misleading updated-label), fixed23/23. Final in-flight expiry RED1failure reproduced and fixed before514full. Source review also fixed mismatched dark selector; no remaining blocking findings in bounded re-review. HistoricalQA001 cause undiagnosed; no deadlines/assertions/isolation weakened. Existing large Communications/index warnings remain.

Local built browser loaded the panel and showed honest failure feedback using a captured response that had expired during a163s browser startup. That is not positive provider/UI acceptance. Added Linux browser scenarios cover mobile/desktop source links, fabricated-count removal, theme contrast and no overflow; not executed locally because current isolated Chromium is unsupported onmac13. Exact CI, reviewed captures and hosted/physical acceptance remain open. Preview tab closed and exact owned localhost process stopped. All145 primary source/asset hashes preserved.

## Release and next task

No database migration. Guard-preserving rollback is the prior source; no domain data changes. Exact CI and explicit bounded approval are required before merging/deploying this stacked candidate. No source changed on the deployed app. Full world news/events, X/TikTok signals, broader Chale tools, real GPS/maps, media, Finance and pilot gates remain separate. Next smallest task: run the added exact-source Linux browser/HTTP checks, then connect Chale to the same attributed public data without inference-memory substitution.

Changed source: server/public-trends.mjs/test, shared/public-trends.mjs/.d.mts, src/modules/HappeningNow.tsx/test/css, server/index.mjs, src/modules/App.tsx, scripts/test-public-trends-http.mjs, scripts/test-navigation-browser.mjs and .github/workflows/release-checks.yml.
