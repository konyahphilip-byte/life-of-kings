-- Additive, API-only recipient acknowledgements; no message bodies or read tracking.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE public.connect_direct_message_receipts(
 message_id uuid PRIMARY KEY REFERENCES public.connect_direct_messages(id),
 recipient_id uuid NOT NULL REFERENCES public.users(id),
 delivered_at timestamptz NOT NULL
);
ALTER TABLE public.connect_direct_message_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_direct_message_receipts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.connect_direct_message_receipts TO ecovibes_api_runtime;
CREATE POLICY ecovibes_runtime_select ON public.connect_direct_message_receipts FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY ecovibes_runtime_insert ON public.connect_direct_message_receipts FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
INSERT INTO public.ecovibes_schema_version(version) VALUES('20261028220000_connect_message_receipts');
COMMIT;
-- Roll back application only; retain receipt/message data. Older code ignores receipts.
