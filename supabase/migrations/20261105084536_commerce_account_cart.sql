-- API-only account cart and immutable checkout commands; no payment/provider activation.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE public.commerce_carts(
 user_id uuid PRIMARY KEY REFERENCES public.users(id),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 9007199254740990),
 updated_at timestamptz NOT NULL
);
CREATE TABLE public.commerce_cart_items(
 user_id uuid NOT NULL REFERENCES public.commerce_carts(user_id),
 product_id uuid NOT NULL REFERENCES public.products(id),
 variant_key text NOT NULL DEFAULT '' CHECK(length(variant_key)<=180),
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 1000000),
 PRIMARY KEY(user_id,product_id,variant_key)
);
CREATE TABLE public.commerce_order_commands(
 user_id uuid NOT NULL REFERENCES public.users(id),
 client_id uuid NOT NULL,
 cart_revision bigint NOT NULL CHECK(cart_revision>=0),
 request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
 order_id uuid NOT NULL REFERENCES public.orders(id),
 created_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,client_id),
 UNIQUE(user_id,cart_revision)
);
CREATE INDEX commerce_commands_recent ON public.commerce_order_commands(user_id,created_at DESC);
ALTER TABLE public.commerce_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_order_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commerce_carts,public.commerce_cart_items,public.commerce_order_commands FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.commerce_carts TO ecovibes_api_runtime;
GRANT SELECT,INSERT,DELETE ON public.commerce_cart_items TO ecovibes_api_runtime;
GRANT SELECT,INSERT ON public.commerce_order_commands TO ecovibes_api_runtime;
CREATE POLICY commerce_carts_select ON public.commerce_carts FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY commerce_carts_insert ON public.commerce_carts FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
CREATE POLICY commerce_carts_update ON public.commerce_carts FOR UPDATE TO ecovibes_api_runtime USING(true) WITH CHECK(true);
CREATE POLICY commerce_cart_items_select ON public.commerce_cart_items FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY commerce_cart_items_insert ON public.commerce_cart_items FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
CREATE POLICY commerce_cart_items_delete ON public.commerce_cart_items FOR DELETE TO ecovibes_api_runtime USING(true);
CREATE POLICY commerce_order_commands_select ON public.commerce_order_commands FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY commerce_order_commands_insert ON public.commerce_order_commands FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
-- SELECT FOR SHARE requires UPDATE privilege. Keep sessions INSERT/SELECT/DELETE-only
-- for the runtime; this fixed helper may only lock/check an exact captured session.
CREATE FUNCTION public.ecovibes_cart_session_authorized(p_hash text,p_user uuid,p_csrf text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp
AS $function$
DECLARE session_expiry timestamptz;
BEGIN
 SELECT s.expires_at INTO session_expiry FROM public.sessions AS s
 WHERE s.token_hash=p_hash AND s.user_id=p_user AND s.csrf_token=p_csrf
 FOR SHARE;
 RETURN session_expiry IS NOT NULL AND session_expiry>clock_timestamp();
END;
$function$;
REVOKE ALL ON FUNCTION public.ecovibes_cart_session_authorized(text,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.ecovibes_cart_session_authorized(text,uuid,text) TO ecovibes_api_runtime;
INSERT INTO public.ecovibes_schema_version(version) VALUES('20261105084536_commerce_account_cart');
COMMIT;
-- Roll back application only; retain cart/command data. Do not erase command history to permit retries.
