-- Private manual Games workspace revisions. No public release or game execution authority.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE public.game_control_revisions(
 owner_id uuid NOT NULL REFERENCES public.users(id),
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 100),
 operation_id uuid NOT NULL,
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
 snapshot_json jsonb NOT NULL CHECK(jsonb_typeof(snapshot_json)='object' AND octet_length(snapshot_json::text)<=160000),
 created_at timestamptz NOT NULL,
 PRIMARY KEY(owner_id,revision),UNIQUE(owner_id,operation_id)
);
ALTER TABLE public.game_control_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_control_revisions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.game_control_revisions TO ecovibes_api_runtime;
CREATE POLICY ecovibes_control_select ON public.game_control_revisions FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY ecovibes_control_insert ON public.game_control_revisions FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
INSERT INTO public.ecovibes_schema_version(version) VALUES('20261108150000_game_control_revisions');
COMMIT;
-- Compatible app rollback: disable the module/redeploy the previous application; retain revisions.
-- No destructive down migration. No production schema has been applied by this source change.
