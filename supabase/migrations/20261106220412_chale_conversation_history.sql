BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=public;
-- Narrow existing-session row-lock permission, matching the existing users(id) lock grant.
-- This permits transaction-time session revocation checks without widening client access.
GRANT UPDATE(token_hash) ON public.sessions TO ecovibes_api_runtime;

CREATE TABLE chale_history_settings(owner_id uuid PRIMARY KEY REFERENCES users(id),enabled INTEGER NOT NULL CHECK(enabled IN(0,1)),consent_version TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE chale_conversations(id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users(id),title TEXT NOT NULL CHECK(length(title)<=100),pinned INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN(0,1)),archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN(0,1)),deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN(0,1)),revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,expires_at TEXT NOT NULL,UNIQUE(id,owner_id));
CREATE TABLE chale_turns(id uuid PRIMARY KEY,conversation_id uuid NOT NULL,owner_id uuid NOT NULL,seq INTEGER NOT NULL CHECK(seq BETWEEN 1 AND 200),text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 1200),context_json TEXT NOT NULL CHECK(length(context_json)<=1000),response_text TEXT CHECK(length(response_text)<=12000),source TEXT CHECK(source IN('model','greeting','app_guide','public_updates')),status TEXT NOT NULL CHECK(status IN('pending','complete','failed','interrupted')),created_at TEXT NOT NULL,completed_at TEXT,FOREIGN KEY(conversation_id,owner_id) REFERENCES chale_conversations(id,owner_id),UNIQUE(conversation_id,seq));
CREATE INDEX chale_history_owner_list ON chale_conversations(owner_id,deleted,archived,updated_at,id);
CREATE INDEX chale_history_expiry ON chale_conversations(expires_at,deleted);
CREATE INDEX chale_turn_order ON chale_turns(conversation_id,owner_id,seq);

ALTER TABLE chale_history_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON chale_history_settings FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON chale_history_settings TO ecovibes_api_runtime;
CREATE POLICY history_read ON chale_history_settings FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY history_insert ON chale_history_settings FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
CREATE POLICY history_update ON chale_history_settings FOR UPDATE TO ecovibes_api_runtime USING(true) WITH CHECK(true);

ALTER TABLE chale_conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON chale_conversations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON chale_conversations TO ecovibes_api_runtime;
CREATE POLICY history_read ON chale_conversations FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY history_insert ON chale_conversations FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
CREATE POLICY history_update ON chale_conversations FOR UPDATE TO ecovibes_api_runtime USING(true) WITH CHECK(true);

ALTER TABLE chale_turns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON chale_turns FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON chale_turns TO ecovibes_api_runtime;
CREATE POLICY history_read ON chale_turns FOR SELECT TO ecovibes_api_runtime USING(true);
CREATE POLICY history_insert ON chale_turns FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
CREATE POLICY history_update ON chale_turns FOR UPDATE TO ecovibes_api_runtime USING(true) WITH CHECK(true);
GRANT UPDATE(enabled,consent_version,updated_at) ON chale_history_settings TO ecovibes_api_runtime;
GRANT UPDATE(title,pinned,archived,deleted,revision,updated_at) ON chale_conversations TO ecovibes_api_runtime;
GRANT UPDATE(response_text,source,status,completed_at),DELETE ON chale_turns TO ecovibes_api_runtime;
CREATE POLICY history_delete_text ON chale_turns FOR DELETE TO ecovibes_api_runtime USING(true);
INSERT INTO ecovibes_schema_version(version) VALUES('20261106220412_chale_conversation_history');
COMMIT;
-- Rollback disables CHALE_HISTORY_ENABLED, retains schema/deletion identifiers and requires a compatible application baseline.
