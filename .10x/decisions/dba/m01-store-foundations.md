# M01 store foundations — dba

Recorded on 25 November 2026 while joining an existing assignment.

[DISCOVERED] Supabase schema read confirmed seller_profiles is user-keyed and products.seller_id references users; Connect direct messages reference friendship revisions. No merchant/shop/publication table found. No migration written or applied in this increment. Design additive tables/indexes/RLS and a transactionally safe legacy-owner backfill next.

See [source-based contracts](../../../docs/marketplace/M01_STORE_FOUNDATIONS.md). No production sign-off is implied.
