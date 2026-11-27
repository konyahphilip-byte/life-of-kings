# TAX-01 shared category contract
The immutable manifest is original EcoVibes category data. It has persisted opaque UUIDs, explicit parent IDs, slugs, lifecycle, eligibility metadata, field schemas and mappings for the founder's forty starting domains. IDs do not change when labels or parents change. Read the complete tree in TAX01_TREE.md and provenance in TAX01_PROVENANCE.md.

## Consumption
Import createRegistry and MANIFEST from shared/taxonomy/registry.mjs. Construct one registry per snapshot, then use roots, children, breadcrumbs and bounded search. Search returns suggestions and eligibility descriptions; it never assigns a category. The caller must present the exact chosen category ID and current version to normalize. Do not persist a display label, alias or guessed category.

normalize validates declared attributes, listing type and intent. With partial:true, missing required fields become friendly issues for private drafts; malformed, unexpected or incompatible fields still fail. Strict normalization is not publication approval. Disabled/prohibited classifications cannot pass strict normalization. Do not display a certification, reserve stock or create an order from these results.

schema supplies a deterministic field inventory for TAX-03, not a form currently rendered in Seller Studio. English Ghana aliases are reviewed terms only; no Akan translation or market-bag weight conversion is invented. Unit bag/crate is a declared package, never an assumed number of kg. Any future import must validate rights, category, current version and server policy.

## Versioning
Persist the registry and schema versions with the listing revision at a later integration stage. Retain historical manifests alongside version-specific readers before writing upgraded classifications. The existing v1 files are byte-identical historical readers. legacyAdvice returns non-private browse suggestions and requires seller review; it never guesses a leaf or copies attributes between versions.

validateTransition checks both complete snapshots, rejects deletion and ID/key replacement, verifies schema version changes, and keeps deprecated IDs inspectable. Prohibited categories cannot be downgraded by a registry transition. A valid transition is a review aid, not a database migration or category-activation authority. No v2 listing has been persisted, so rollback of this increment simply withdraws its unused consumer. Future writes must first implement historical snapshot storage and version-aware reads; do not reinterpret old data using current schema defaults.

## Integration boundary
No native form, API, DB, publication guard, public listing, Chale tool, profile, shop routing or financial behavior is changed. TAX-02 wires the selector; TAX-03 drafts/forms; TAX-04 shared discovery; TAX-05 consented Chale suggestions; TAX-06 server eligibility and version-bound review; TAX-07 the fifteen required app journeys. Existing product ownership, shop identity, Connect and review receipts remain authoritative. Restricted-content evasion is not solved by a label registry; moderation/content checks remain required.

## Repetition
Run the existing Vitest suite, node scripts/test-taxonomy-contract.mjs, and tsc --ignoreConfig --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext shared/taxonomy/contracts.typecheck.ts. The normal remote build additionally proves compatibility with the unchanged application. Local direct performance numbers are host observations, not device or CI guarantees.
