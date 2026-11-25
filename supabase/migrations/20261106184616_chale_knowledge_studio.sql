-- Reviewed public text only; default-off application feature. No pgvector/provider activation.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=public;
CREATE TABLE knowledge_sources(
 id uuid PRIMARY KEY,title TEXT NOT NULL,source_url TEXT NOT NULL,license TEXT NOT NULL,
 license_url TEXT NOT NULL,attribution TEXT NOT NULL,category TEXT NOT NULL,language TEXT NOT NULL,region TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>=1),current_version INTEGER,created_by uuid NOT NULL REFERENCES users(id),created_at TEXT NOT NULL
);
CREATE TABLE knowledge_versions(
 source_id uuid NOT NULL REFERENCES knowledge_sources(id),version INTEGER NOT NULL CHECK(version>0 AND version<=10),
 content_hash TEXT NOT NULL,body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 20000),
 checked_at TEXT NOT NULL,expires_at TEXT NOT NULL,created_by uuid NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,
 PRIMARY KEY(source_id,version),UNIQUE(source_id,content_hash,expires_at)
);
CREATE TABLE knowledge_chunks(
 source_id uuid NOT NULL,version INTEGER NOT NULL,ordinal INTEGER NOT NULL,body TEXT NOT NULL,search_text TEXT NOT NULL,
 PRIMARY KEY(source_id,version,ordinal),FOREIGN KEY(source_id,version) REFERENCES knowledge_versions(source_id,version)
);
CREATE TABLE knowledge_events(
 id uuid PRIMARY KEY,source_id uuid NOT NULL REFERENCES knowledge_sources(id),version INTEGER,
 action TEXT NOT NULL CHECK(action IN ('created','revised','published','withdrawn')),
 actor_id uuid NOT NULL REFERENCES users(id),created_at TEXT NOT NULL
);
CREATE INDEX knowledge_live_sources ON knowledge_sources(category,language,region,current_version);
CREATE INDEX knowledge_version_expiry ON knowledge_versions(expires_at);

ALTER TABLE knowledge_sources ADD CONSTRAINT knowledge_source_licence CHECK(license IN ('CC0-1.0','CC-BY-4.0','ECOVIBES-OWNED'));
ALTER TABLE knowledge_sources ADD CONSTRAINT knowledge_current_version FOREIGN KEY(id,current_version) REFERENCES knowledge_versions(source_id,version);
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.knowledge_sources FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.knowledge_sources TO ecovibes_api_runtime;
GRANT UPDATE(revision,current_version) ON public.knowledge_sources TO ecovibes_api_runtime;
CREATE POLICY knowledge_runtime_select ON public.knowledge_sources FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY knowledge_runtime_insert ON public.knowledge_sources FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
CREATE POLICY knowledge_runtime_update ON public.knowledge_sources FOR UPDATE TO ecovibes_api_runtime USING(true) WITH CHECK(true);
ALTER TABLE public.knowledge_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.knowledge_versions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.knowledge_versions TO ecovibes_api_runtime;
CREATE POLICY knowledge_runtime_select ON public.knowledge_versions FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY knowledge_runtime_insert ON public.knowledge_versions FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.knowledge_chunks FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.knowledge_chunks TO ecovibes_api_runtime;
CREATE POLICY knowledge_runtime_select ON public.knowledge_chunks FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY knowledge_runtime_insert ON public.knowledge_chunks FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
ALTER TABLE public.knowledge_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.knowledge_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.knowledge_events TO ecovibes_api_runtime;
CREATE POLICY knowledge_runtime_select ON public.knowledge_events FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY knowledge_runtime_insert ON public.knowledge_events FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
INSERT INTO public.ecovibes_schema_version(version) VALUES('20261106184616_chale_knowledge_studio');
COMMIT;
-- Disable CHALE_KNOWLEDGE_ENABLED, then roll application back to56e0c2eb.
-- Retain reviewed versions/events. No destructive down migration or hosted application here.

