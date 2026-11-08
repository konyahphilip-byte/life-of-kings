-- Current private project content with explicit user-controlled checkpoints.
-- Operation receipts retain hashes/IDs only, not earlier private source.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE public.game_vaults(
 owner_id uuid PRIMARY KEY REFERENCES public.users(id),
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 1000000),
 snapshot_json jsonb NOT NULL CHECK(jsonb_typeof(snapshot_json)='object' AND octet_length(snapshot_json::text)<=160000),
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
 receipts_json jsonb NOT NULL CHECK(jsonb_typeof(receipts_json)='array' AND jsonb_array_length(receipts_json)<=50 AND octet_length(receipts_json::text)<=16000),
 updated_at timestamptz NOT NULL
);
ALTER TABLE public.game_vaults ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_vaults FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.game_vaults TO ecovibes_api_runtime;
CREATE POLICY game_vault_read ON public.game_vaults FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY game_vault_insert ON public.game_vaults FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
CREATE POLICY game_vault_update ON public.game_vaults FOR UPDATE TO ecovibes_api_runtime USING(true) WITH CHECK(true);
INSERT INTO public.ecovibes_schema_version(version) VALUES('20261108210000_game_vault');
COMMIT;
-- App rollback/deny-only switch retains current data. No destructive down migration.
