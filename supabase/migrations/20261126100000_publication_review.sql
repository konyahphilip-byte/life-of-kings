-- Proposed only. No real scope, admin grant or product publication is configured.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE m01_review_receipts(
 id uuid PRIMARY KEY,shop_id uuid NOT NULL REFERENCES m01_shops(id),product_id uuid REFERENCES products(id),
 review_type TEXT NOT NULL CHECK(review_type IN ('shop','product')),
 revision INTEGER NOT NULL CHECK(revision>0),content_hash TEXT NOT NULL CHECK(length(content_hash)=64),snapshot_json TEXT NOT NULL,
 creator_id uuid NOT NULL REFERENCES users(id),reviewer_id uuid NOT NULL REFERENCES users(id),
 capacity TEXT NOT NULL CHECK(capacity IN ('founder_self_review','moderator_review')),
 decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),reason TEXT NOT NULL CHECK(length(reason)>=5 AND length(reason)<=500),
 policy_version TEXT NOT NULL,request_id uuid NOT NULL,created_at TEXT NOT NULL,
 CHECK((review_type='shop' AND product_id IS NULL) OR (review_type='product' AND product_id IS NOT NULL)),
 UNIQUE(reviewer_id,request_id));
CREATE INDEX m01_reviews_product ON m01_review_receipts(product_id,revision,decision,reviewer_id);
CREATE INDEX m01_reviews_shop ON m01_review_receipts(shop_id,created_at);
CREATE INDEX m01_reviews_product_history ON m01_review_receipts(product_id,created_at);
ALTER TABLE public.m01_review_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.m01_review_receipts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.m01_review_receipts TO ecovibes_api_runtime;
CREATE POLICY runtime_read ON public.m01_review_receipts FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY runtime_append ON public.m01_review_receipts FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
INSERT INTO public.ecovibes_schema_version(version) VALUES('20261126100000_publication_review');
COMMIT;
