-- Immutable publication receipts; existing products remain the only sellable catalog.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE public.commerce_product_publications(
 user_id uuid NOT NULL REFERENCES public.users(id),client_id uuid NOT NULL,
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 product_id uuid NOT NULL REFERENCES public.products(id),published_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,client_id)
);
ALTER TABLE public.commerce_product_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commerce_product_publications FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.commerce_product_publications TO ecovibes_api_runtime;
CREATE POLICY publication_select ON public.commerce_product_publications FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY publication_insert ON public.commerce_product_publications FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
INSERT INTO public.ecovibes_schema_version(version) VALUES('20261105170000_product_publications');
COMMIT;
-- Application rollback retains receipts and products. Never erase receipt history for retries.
