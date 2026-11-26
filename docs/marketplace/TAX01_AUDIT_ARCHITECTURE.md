# TAX-01 audit and bounded architecture

26 November2026. Base996787505c5ded1dd6381150c25a36841a8653e0; tested M01 repair remains isolated on draftPR61. This branch adds a shared category registry. It does not activate broader catalogue publication, migrate hosted data or certify the remaining fifteen app journeys.

## Existing limitation and compatible reuse
The native form hard-codes Fashion/Beauty/Home in M01Studio.tsx. native-studio.mjs repeats the three input values; its public SQL and publication-review.mjs conservatively expose only eligible Fashion/Home goods. These are deliberate pilot boundaries, not a database capacity limit. Products currently retain a text category in the existing authoritative products row.

Older category branch7f6edfe (parent feature13a8c63) contains shared/marketplace-taxonomy.mjs, declarations and17 tests, with6 root groups/12 leaves, strict seller-declared enum/text/integer attributes and version1 reads. Its surrounding commerce stack is unmerged. Adopt the compatible shared validation/history source with attribution; do not merge its wider carts/orders/services.

## Architecture and data contract
One immutable-ID, versioned canonical registry serves later Seller Studio, storefront, Discover and Chale adapters. Separate category, listing type, intent, condition and selling unit. Rent/hire/lease and wholesale are dimensions, not duplicated category trees.

The v1 source is retained as a historical compatibility reader. A new registry snapshot supplies deeper parent/child relationships, canonical slugs, English labels, reviewed aliases, schema references, lifecycle and eligibility metadata. UUIDs must not depend on the category’s current path, label or parent. Destructive deletion is rejected; deprecated IDs remain resolvable. Reparenting requires a valid acyclic version transition.

TAX-01 provides tree/alias validation, breadcrumbs, bounded offline search, type/intent compatibility and explicit migration advice. Attribute inventory is a contract for TAX-03; it is not an implemented dynamic seller form. Broad native classifications require seller selection, not an inferred leaf assignment.

Publication remains governed by authenticated merchant ownership, current listing version, existing review receipts and the server eligibility layer. Registry metadata cannot grant publication, staff roles or regulatory approval. Live animals remain disabled; restricted/prohibited aliases never redirect to ordinary goods. No client or Chale response can enable a category.

No private user records, provider calls, model calls, financial mutations or new dependencies belong in this stage. There is no new catalogue service or per-merchant server.

## Research comparison and provenance
- [Shopify product-taxonomy v2026-11](https://github.com/Shopify/product-taxonomy/releases/tag/v2026-11) demonstrates versioned categories, attributes and localization. Its [MIT license](https://github.com/Shopify/product-taxonomy/blob/main/LICENSE) permits reuse with retained notices. Use the data model as a reference; this stage authors EcoVibes’ registry instead of importing a large upstream dataset. Current release assets replace the deprecated dist path.
- [Google’s product-category specification](https://support.google.com/merchants/answer/6324436?hl=en) separates predefined external categories from a merchant’s own product type. Keep future external mappings versioned and separate from EcoVibes IDs. No wholesale Google taxonomy import or redistribution right is asserted.
- [Jiji Ghana](https://jiji.com.gh/) covers classifieds spanning goods, property and services. Its split sale/rental paths inform the overlap audit; EcoVibes instead models intent independently. [Jiji terms](https://jiji.com.gh/rules.html) are not an open-data license. No listings, photos, branding, UI or bulk taxonomy are copied.
- [Jumia Ghana](https://www.jumia.com.gh/) emphasizes consumer retail and category navigation. It is a comparison source, not an integration, supplier or partner. Its [terms](https://one.jumia.com.gh/cms/customers-terms-and-conditions.html) do not establish an open taxonomy license. No assets/data are imported.
- [Ghana Statistical Service](https://ghin.statsghana.gov.gh/business-and-economy) provides agriculture context. Use ordinary crop names supported by official statistical sources; no economic figures or commercial dataset are republished.
- Source-integrity exception: a MoFA district page returned unrelated injected outbound links. Exclude it from trusted ingestion. An official SRID PDF request timed out; search snippets alone are not sufficient to certify its full contents. No such content is imported into the registry.

Brand/model search terms supplied in the founder directive (for example PS4) are descriptive aliases, not affiliation claims. Unverified language translations and assumed market-container weight conversions remain excluded.

## Overlap and migration decisions
- One produce classification serves retail and bulk sellers; units/minimum quantities distinguish the offer.
- Phones/computers/gaming/cameras belong under Electronics with related-category entry points.
- Pet supplies and farm-animal supplies are different uses; live-animal selling stays inactive.
- Software/digital rights remain explicit; no product certification is invented.
- Quick & Handi, jobs and Waste-to-Money retain their authoritative operational workflows. Later Discover adapters may surface eligible records without duplicating them.
- Existing fashion/beauty/home and v1 broad leaves are retained in migration advice. No silent reassignment, data rewrite or approval carry-over occurs.

## Acceptance and release boundaries
Regression-first tests must reject cycles, duplicate IDs/slugs, missing parents, orphan/ambiguous aliases, unsafe fields, incompatible type/intent, unknown/deprecated selections and destructive transitions. They must exercise deep breadcrumbs, researched synonyms, separation of hire/condition/wholesale, immutable snapshots and legacy advice.

TAX-02 adds the searchable selector inside the existing Add Product card; TAX-03 category-specific fields and incomplete drafts; TAX-04 shared search; TAX-05 consented Chale suggestions; TAX-06 publication integration; TAX-07 real application/security/accessibility journeys. The final universal Discover visual design remains subject to approval. The supplied mobile Messages/Status image is a deferred reference and is unrelated to current taxonomy implementation.

No claims of tomato/vehicle/property publication, AI assistance, native forms, hosted integration or complete taxonomy success follow from registry-only tests.
