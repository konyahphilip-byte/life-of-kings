-- Additive API-only latest collection position. No location-history table.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE public.job_tracking_current(
 job_id uuid PRIMARY KEY REFERENCES public.jobs(id),
 session_id uuid NOT NULL UNIQUE,
 customer_id uuid NOT NULL REFERENCES public.users(id),
 collector_id uuid NOT NULL REFERENCES public.users(id),
 provider_revision integer NOT NULL,
 status text NOT NULL CHECK(status IN ('active','paused','stopped','revoked','expired')),
 started_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,
 sequence integer NOT NULL DEFAULT 0 CHECK(sequence>=0),
 latitude double precision,longitude double precision,accuracy double precision,
 captured_at timestamptz,received_at timestamptz,point_hash text,
 CHECK(latitude IS NULL OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND accuracy BETWEEN 0 AND 1000)),
 CHECK((latitude IS NULL AND longitude IS NULL AND accuracy IS NULL AND captured_at IS NULL AND point_hash IS NULL)
 OR (latitude IS NOT NULL AND longitude IS NOT NULL AND accuracy IS NOT NULL AND captured_at IS NOT NULL AND point_hash IS NOT NULL))
);
CREATE TABLE public.job_tracking_operations(
 id uuid PRIMARY KEY,job_id uuid NOT NULL REFERENCES public.jobs(id),collector_id uuid NOT NULL REFERENCES public.users(id),request_hash text NOT NULL,created_at timestamptz NOT NULL
);
CREATE INDEX job_tracking_expiry ON public.job_tracking_current(expires_at);
CREATE INDEX job_tracking_operations_expiry ON public.job_tracking_operations(created_at);
ALTER TABLE public.job_tracking_current ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_tracking_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_tracking_current,public.job_tracking_operations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.job_tracking_current TO ecovibes_api_runtime;
GRANT SELECT,INSERT,DELETE ON public.job_tracking_operations TO ecovibes_api_runtime;
CREATE POLICY runtime_select ON public.job_tracking_current FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY runtime_insert ON public.job_tracking_current FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
CREATE POLICY runtime_update ON public.job_tracking_current FOR UPDATE TO ecovibes_api_runtime USING(true) WITH CHECK(true);
CREATE POLICY runtime_select ON public.job_tracking_operations FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY runtime_insert ON public.job_tracking_operations FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
CREATE POLICY runtime_delete ON public.job_tracking_operations FOR DELETE TO ecovibes_api_runtime USING(true);
INSERT INTO public.ecovibes_schema_version(version) VALUES('20261029210000_job_tracking');
COMMIT;
-- Application rollback retains additive tables/metadata. Disable publishing first;
-- clear precise positions using an approved runtime cleanup, never DROP live data.
