-- Additive API-only accepted-friend text messages. Does not enable calls.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE public.connect_direct_messages(
 sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id uuid NOT NULL UNIQUE,
 low_user_id uuid NOT NULL,high_user_id uuid NOT NULL,
 friendship_revision integer NOT NULL CHECK(friendship_revision>=0),
 sender_id uuid NOT NULL REFERENCES public.users(id),
 client_id uuid NOT NULL,body text NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL,UNIQUE(sender_id,client_id),
 FOREIGN KEY(low_user_id,high_user_id) REFERENCES public.people_friendships(low_user_id,high_user_id),
 CHECK(low_user_id<high_user_id),CHECK(sender_id IN (low_user_id,high_user_id))
);
CREATE INDEX connect_direct_messages_pair ON public.connect_direct_messages(low_user_id,high_user_id,friendship_revision,sequence DESC);
ALTER TABLE public.connect_direct_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_direct_messages FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE public.connect_direct_messages_sequence_seq FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.connect_direct_messages TO ecovibes_api_runtime;
GRANT USAGE ON SEQUENCE public.connect_direct_messages_sequence_seq TO ecovibes_api_runtime;
CREATE POLICY ecovibes_runtime_select ON public.connect_direct_messages FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY ecovibes_runtime_insert ON public.connect_direct_messages FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
INSERT INTO public.ecovibes_schema_version(version) VALUES('20261027070000_connect_direct_messages');
COMMIT;
-- Application rollback: redeploy 7ad983c6; retain immutable messages and friend data.
-- Do not drop production conversations as part of rollback.
