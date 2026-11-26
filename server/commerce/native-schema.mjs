export const NATIVE_STUDIO_VERSION = '20261126090000_native_studio';
export const NATIVE_STUDIO_SCHEMA = `
CREATE TABLE IF NOT EXISTS m01_shops(
 id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),request_id TEXT NOT NULL,
 name TEXT NOT NULL,slug TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','suspended')),
 visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public')),
 approved_by TEXT REFERENCES users(id),created_at TEXT NOT NULL,UNIQUE(owner_id,request_id));
CREATE TABLE IF NOT EXISTS m01_shop_members(
 shop_id TEXT NOT NULL REFERENCES m01_shops(id),user_id TEXT NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('owner','administrator','product_manager','designer','enquiry_operator','analyst')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),PRIMARY KEY(shop_id,user_id));
CREATE INDEX IF NOT EXISTS m01_members_user ON m01_shop_members(user_id,status,shop_id);
CREATE TABLE IF NOT EXISTS m01_shop_aliases(slug TEXT PRIMARY KEY,shop_id TEXT NOT NULL REFERENCES m01_shops(id),created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS m01_product_publication(
 product_id TEXT PRIMARY KEY REFERENCES products(id),shop_id TEXT NOT NULL REFERENCES m01_shops(id),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),publication TEXT NOT NULL DEFAULT 'draft' CHECK(publication IN ('draft','published','archived')),
 moderation TEXT NOT NULL DEFAULT 'pending' CHECK(moderation IN ('pending','approved','rejected')),
 approved_revision INTEGER,approved_by TEXT REFERENCES users(id),availability TEXT NOT NULL CHECK(availability IN ('in_stock','made_to_order','out_of_stock')),
 collection_name TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL REFERENCES users(id),request_id TEXT NOT NULL,
 published_at TEXT,updated_at TEXT NOT NULL,UNIQUE(shop_id,request_id));
CREATE INDEX IF NOT EXISTS m01_publication_shop ON m01_product_publication(shop_id,publication,moderation,product_id);
CREATE TABLE IF NOT EXISTS m01_photos(
 asset_id TEXT PRIMARY KEY REFERENCES media_assets(id),shop_id TEXT NOT NULL REFERENCES m01_shops(id),
 rights_actor_id TEXT NOT NULL REFERENCES users(id),width INTEGER NOT NULL,height INTEGER NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS m01_photos_shop ON m01_photos(shop_id,asset_id);
CREATE TABLE IF NOT EXISTS m01_product_media(product_id TEXT NOT NULL REFERENCES products(id),asset_id TEXT NOT NULL REFERENCES m01_photos(asset_id),
 position INTEGER NOT NULL CHECK(position>=0 AND position<6),alt TEXT NOT NULL,PRIMARY KEY(product_id,position),UNIQUE(product_id,asset_id));
CREATE INDEX IF NOT EXISTS m01_media_asset ON m01_product_media(asset_id,product_id);
CREATE TABLE IF NOT EXISTS m01_theme_versions(shop_id TEXT NOT NULL REFERENCES m01_shops(id),version INTEGER NOT NULL CHECK(version>0),
 config_json TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,PRIMARY KEY(shop_id,version));
CREATE TABLE IF NOT EXISTS m01_theme_current(shop_id TEXT PRIMARY KEY REFERENCES m01_shops(id),draft_version INTEGER NOT NULL DEFAULT 0,
 applied_version INTEGER,FOREIGN KEY(shop_id,applied_version) REFERENCES m01_theme_versions(shop_id,version));
CREATE TABLE IF NOT EXISTS connect_product_enquiries(
 id TEXT PRIMARY KEY,shop_id TEXT NOT NULL REFERENCES m01_shops(id),product_id TEXT NOT NULL REFERENCES products(id),
 buyer_id TEXT NOT NULL REFERENCES users(id),state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','closed')),created_at TEXT NOT NULL,
 UNIQUE(buyer_id,product_id));
CREATE INDEX IF NOT EXISTS connect_enquiries_shop ON connect_product_enquiries(shop_id,created_at);
CREATE TABLE IF NOT EXISTS connect_enquiry_messages(
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,enquiry_id TEXT NOT NULL REFERENCES connect_product_enquiries(id),
 sender_id TEXT NOT NULL REFERENCES users(id),client_id TEXT NOT NULL,body TEXT NOT NULL CHECK(length(body)>0 AND length(body)<=2000),
 created_at TEXT NOT NULL,UNIQUE(sender_id,client_id));
CREATE INDEX IF NOT EXISTS connect_enquiry_thread ON connect_enquiry_messages(enquiry_id,sequence);
`;
