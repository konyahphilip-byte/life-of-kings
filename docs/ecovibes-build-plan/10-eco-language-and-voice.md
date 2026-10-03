# Eco Language and Voice

## Product goal

Build a shared, provider-neutral language layer for EcoVibes. It must work across the existing web app and future mobile, partner and admin surfaces without creating separate locale logic in every product module. A preference is not a capability claim: the registry owns explicit `FULL`, `PARTIAL`, `EXPERIMENTAL` and `COMING_SOON` states per language and per feature.

## Phase 1 foundation in this repository

- One versioned language registry shared by the browser and API. Each entry includes a BCP 47 tag, endonym, display name, relevant country/region and independently reviewed capability states for interface localization, search, translation, speech recognition, speech output and code-switch detection.
- An Eco ID language profile with preferred language, content languages, voice input/output preferences, regional context and code-switching preference. Signed-in preferences are stored per user by the API; guest preferences stay on the device. Preferences are not consent to share data with a translation or speech provider.
- Language settings show what is usable now, allow users to save future preferences, and explain when the app falls back to English. Voice preferences must not request microphone access or imply speech features are active.
- Semantic translation keys, explicit locale fallback, and locale-aware date/number/currency formatting. New language strings need native-speaker review before a locale or feature changes to `FULL`.
- Low-data behavior: keep the registry and interface strings small and bundled, do not load voice models/media on settings pages, and keep settings usable offline with a clear account-sync state.

## Later phases

1. Extract existing interface text into semantic keys; add language packs and reviewer status, then enable one Ghanaian-language screen only after independent native review and layout/accessibility checks.
2. Add multilingual search normalization, transliteration/alternate-name indexing and code-switch-aware query handling behind tests and measurable quality thresholds. Preserve original user text and names.
3. Add provider adapters for text translation, speech-to-text and text-to-speech. Pin supported models and language variants, enforce account permissions and consent, minimize payloads, record provider/version and handle provider failure with original-language fallback.
4. Add opt-in voice input/output and EcoAI tool actions only after language-specific quality, safety, cost and latency gates. Ask for confirmation before consequential actions; audio must not be retained by default.
5. Create staff language administration and a human contributor/reviewer workflow with source text, translation status, version, reviewer, date and rollback history. Never expose personal user content to translators without a lawful, necessary and consented workflow.
6. Expand country by country after local review for language variety, accessibility, connectivity, legal notices, support and provider coverage.

## Integration contract

Every module reads the same Eco ID language profile and the same registry. Product records retain their source language and original text. Search, recommendations and AI may use the declared language preference only when that module advertises matching capability; otherwise they return source-language results with a clear label. The profile itself must not be copied into generic behavioral-learning events. Sensitive account, payment, location and message data stay out of translation prompts unless a user explicitly invokes an authorized translation action.

## API and data

- `GET /api/v1/language/preferences` returns only the signed-in user's own profile and update timestamp.
- `PATCH /api/v1/language/preferences` validates language tags and regions against the shared registry, requires a CSRF-protected EcoVibes session, and changes only the caller's row.
- PostgreSQL stores one JSONB profile per EcoVibes user; RLS is enabled and direct browser roles receive no table access. Local SQLite mirrors the table for development.
- The registry is versioned in source now. A future admin-managed registry needs a privileged API, approval workflow and audit trail before it replaces the bundled source.

## Ghana-first locale set

Seed English (Ghana), Akan, Twi, Fante, Ga, Ewe, Dagbani and Hausa. Add Swahili, Yoruba, Igbo, French, Portuguese, Arabic, Amharic, Wolof, Zulu, Xhosa, Kinyarwanda, Somali, Chichewa and Lingala as registry entries for regional planning. Only English interface text is currently available; the other entries are preferences and planned coverage, not launch-ready translations. Validate language names, scripts and regional variants with Ghanaian language reviewers before enabling them.

## Release gates

- Reject unregistered language tags, oversized/malformed preference payloads and cross-account reads/writes.
- Check locale fallback for missing keys, plural/number/date behavior, Unicode names, right-to-left layouts, long strings and mobile/screen-reader navigation.
- Measure search and translation quality on native-reviewed, consented evaluation data for each specific language variety; never infer support from a generic model's language list.
- Verify offline save, account sync, sync conflict handling, provider outage fallback, deletion/retention and that no audio is captured without explicit action.
- Keep every capability below `FULL` until its own evidence, human review, privacy, cost and support gates pass.

## Standalone implementation prompt

Continue from the existing EcoVibes code. Inspect current settings, Eco ID/API/database, data saver, and build plan first. Preserve unrelated work. Implement the smallest complete vertical slice for Eco Language: shared versioned registry; server-validated, account-isolated language preferences with guest-local fallback; a low-data language settings screen; honest per-language capability states; semantic keys and English fallback for the new screen; migration and docs. Do not fabricate translated UI, AI translation, voice recognition/synthesis, code-switch detection, or admin language tools. Keep capabilities explicitly unavailable until backed by reviewed translations/providers. Add only consented language preference data; do not use it as cross-user training data. Verify the app build and report any hosted migration or account-sync dependency.
