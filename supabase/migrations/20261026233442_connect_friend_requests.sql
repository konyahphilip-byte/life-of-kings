-- Additive API-only friendship consent. Existing app/room permissions unchanged.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE public.people_friendships(
 low_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 high_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 requester_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'none' CHECK(status IN ('none','pending','accepted','closed')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 low_blocked integer NOT NULL DEFAULT 0 CHECK(low_blocked IN (0,1)),
 high_blocked integer NOT NULL DEFAULT 0 CHECK(high_blocked IN (0,1)),
 requested_at timestamptz,updated_at timestamptz NOT NULL,
 PRIMARY KEY(low_user_id,high_user_id),CHECK(low_user_id<high_user_id),
 CHECK(requester_id IS NULL OR requester_id IN (low_user_id,high_user_id)),
 CHECK(status NOT IN ('pending','accepted') OR (requester_id IS NOT NULL AND requested_at IS NOT NULL))
);
CREATE INDEX people_friendships_high_recent ON public.people_friendships(high_user_id,updated_at DESC);
CREATE INDEX people_friendships_low_recent ON public.people_friendships(low_user_id,updated_at DESC);
ALTER TABLE public.people_friendships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.people_friendships FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.people_friendships TO ecovibes_api_runtime;
CREATE POLICY ecovibes_runtime_select ON public.people_friendships FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY ecovibes_runtime_insert ON public.people_friendships FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
CREATE POLICY ecovibes_runtime_update ON public.people_friendships FOR UPDATE TO ecovibes_api_runtime USING(true) WITH CHECK(true);
INSERT INTO public.ecovibes_schema_version(version) VALUES('20261026233442_connect_friend_requests');
COMMIT;
-- Application rollback: redeploy d19376cb; retain this table and accepted requests.
-- Dropping the table discards consent/block state and is not a production rollback.
