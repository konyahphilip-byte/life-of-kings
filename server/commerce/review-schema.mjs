export const NATIVE_REVIEW_VERSION='20261126100000_publication_review';
export const NATIVE_REVIEW_SCHEMA=`
CREATE TABLE IF NOT EXISTS m01_review_receipts(
 id TEXT PRIMARY KEY,shop_id TEXT NOT NULL REFERENCES m01_shops(id),product_id TEXT REFERENCES products(id),
 review_type TEXT NOT NULL CHECK(review_type IN ('shop','product')),
 revision INTEGER NOT NULL CHECK(revision>0),content_hash TEXT NOT NULL CHECK(length(content_hash)=64),snapshot_json TEXT NOT NULL,
 creator_id TEXT NOT NULL REFERENCES users(id),reviewer_id TEXT NOT NULL REFERENCES users(id),
 capacity TEXT NOT NULL CHECK(capacity IN ('founder_self_review','moderator_review')),
 decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),reason TEXT NOT NULL CHECK(length(reason)>=5 AND length(reason)<=500),
 policy_version TEXT NOT NULL,request_id TEXT NOT NULL,created_at TEXT NOT NULL,
 CHECK((review_type='shop' AND product_id IS NULL) OR (review_type='product' AND product_id IS NOT NULL)),
 UNIQUE(reviewer_id,request_id));
CREATE INDEX IF NOT EXISTS m01_reviews_product ON m01_review_receipts(product_id,revision,decision,reviewer_id);
CREATE INDEX IF NOT EXISTS m01_reviews_shop ON m01_review_receipts(shop_id,created_at);
CREATE INDEX IF NOT EXISTS m01_reviews_product_history ON m01_review_receipts(product_id,created_at);
CREATE TRIGGER IF NOT EXISTS m01_reviews_no_update BEFORE UPDATE ON m01_review_receipts BEGIN SELECT RAISE(ABORT,'Review receipts are immutable'); END;
CREATE TRIGGER IF NOT EXISTS m01_reviews_no_delete BEFORE DELETE ON m01_review_receipts BEGIN SELECT RAISE(ABORT,'Review receipts are immutable'); END;
`;
