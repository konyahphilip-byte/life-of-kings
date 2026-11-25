-- API-only admission barriers. Retain these records on application rollback.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE public.identity_auth_state(
 user_id uuid PRIMARY KEY REFERENCES public.users(id),
 auth_after bigint NOT NULL CHECK(auth_after>=0),
 revision integer NOT NULL CHECK(revision>0)
);
CREATE TABLE public.identity_provider_sessions(
 user_id uuid NOT NULL REFERENCES public.users(id),provider_session_id uuid NOT NULL,
 revoked_at bigint CHECK(revoked_at IS NULL OR revoked_at>=0),
 PRIMARY KEY(user_id,provider_session_id)
);
CREATE TABLE public.auth_revocation_operations(
 user_id uuid NOT NULL REFERENCES public.users(id),operation_id uuid NOT NULL,
 provider_session_id uuid NOT NULL,auth_after bigint NOT NULL CHECK(auth_after>=0),
 revision integer NOT NULL CHECK(revision>0),created_at bigint NOT NULL,
 PRIMARY KEY(user_id,operation_id)
);
ALTER TABLE public.identity_auth_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_provider_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_revocation_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.identity_auth_state,public.identity_provider_sessions,public.auth_revocation_operations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.identity_auth_state,public.identity_provider_sessions TO ecovibes_api_runtime;
GRANT SELECT,INSERT ON public.auth_revocation_operations TO ecovibes_api_runtime;
CREATE POLICY ecovibes_runtime_select ON public.identity_auth_state FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY ecovibes_runtime_insert ON public.identity_auth_state FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
CREATE POLICY ecovibes_runtime_update ON public.identity_auth_state FOR UPDATE TO ecovibes_api_runtime USING(true) WITH CHECK(true);
CREATE POLICY ecovibes_runtime_select ON public.identity_provider_sessions FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY ecovibes_runtime_insert ON public.identity_provider_sessions FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
CREATE POLICY ecovibes_runtime_update ON public.identity_provider_sessions FOR UPDATE TO ecovibes_api_runtime USING(true) WITH CHECK(true);
CREATE POLICY ecovibes_runtime_select ON public.auth_revocation_operations FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY ecovibes_runtime_insert ON public.auth_revocation_operations FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
INSERT INTO public.ecovibes_schema_version(version) VALUES('20261027121500_identity_auth_revocations');
COMMIT;
-- Schema compatibility is insufficient for rollback: old source ignores barriers.
-- Deploy only with a reviewed guard-preserving rollback target or deny admissions.
-- No Auth-schema access, security-definer functions or production data removal.
