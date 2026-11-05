-- Additive metadata on the existing API-owned products. No reclassification or new grants.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
ALTER TABLE public.products
 ADD COLUMN category_id text,
 ADD COLUMN category_version integer,
 ADD COLUMN attributes_json text NOT NULL DEFAULT '{}',
 ADD CONSTRAINT product_classification_shape CHECK (
  octet_length(attributes_json)<=4096 AND jsonb_typeof(attributes_json::jsonb)='object'
  AND ((category_id IS NULL AND category_version IS NULL AND attributes_json='{}')
   OR (category_id IS NOT NULL AND length(category_id) BETWEEN 3 AND 80 AND category_version IS NOT NULL AND category_version=1))
 );
CREATE INDEX products_category_discovery ON public.products(category_id,created_at DESC,id DESC) WHERE status='active';
INSERT INTO public.ecovibes_schema_version(version) VALUES('20261105120000_product_classification');
COMMIT;
-- Application rollback retains these columns and seller declarations. Do not drop data.
