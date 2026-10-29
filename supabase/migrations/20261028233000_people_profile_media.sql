-- Additive member profile image references. Existing identity/friend/follow truth is reused.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE public.people_profiles(
 user_id uuid PRIMARY KEY REFERENCES public.users(id),
 avatar_asset_id uuid REFERENCES public.media_assets(id),
 banner_asset_id uuid REFERENCES public.media_assets(id),
 revision integer NOT NULL CHECK(revision>=1),updated_at timestamptz NOT NULL
);
CREATE INDEX people_profiles_avatar_asset ON public.people_profiles(avatar_asset_id) WHERE avatar_asset_id IS NOT NULL;
CREATE INDEX people_profiles_banner_asset ON public.people_profiles(banner_asset_id) WHERE banner_asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS people_follows_target_user ON public.people_follows(target_user_id,user_id);
ALTER TABLE public.people_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.people_profiles FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.people_profiles TO ecovibes_api_runtime;
CREATE POLICY ecovibes_runtime_select ON public.people_profiles FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY ecovibes_runtime_insert ON public.people_profiles FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
CREATE POLICY ecovibes_runtime_update ON public.people_profiles FOR UPDATE TO ecovibes_api_runtime USING(true) WITH CHECK(true);
INSERT INTO public.ecovibes_schema_version(version) VALUES('20261028233000_people_profile_media');
COMMIT;
-- Application rollback retains profile/media/relationship data. No production DROP.
