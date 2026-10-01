import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";
import { AccessToken, IngressClient, IngressInput, LiveKitAPI, WebhookReceiver } from "livekit-server-sdk";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import { readFile, writeFile, unlink } from "node:fs/promises";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
  createHmac,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { authenticateSupabaseRequest } from "./supabase-auth.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dbPath =
  process.env.ECOVIBES_DB_PATH || resolve(root, "server/data/ecovibes.sqlite");
const port = Number(process.env.PORT || process.env.API_PORT || 8787);
const isProduction = process.env.NODE_ENV === "production";
const postgresMode = Boolean(process.env.DATABASE_URL);
if (isProduction && !postgresMode) {
  throw new Error("DATABASE_URL is required in production; refusing to start with local SQLite.");
}
const transactionClient = new AsyncLocalStorage();
const pool = postgresMode
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: true },
      max: Number(process.env.DB_POOL_MAX || 8),
      idleTimeoutMillis: 30_000,
    })
  : null;
if (postgresMode) await pool.query("SELECT 1");
let db = null;
if (!postgresMode) {
  mkdirSync(dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec(`
 PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, eco_id TEXT NOT NULL UNIQUE COLLATE NOCASE, display_name TEXT NOT NULL, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS supabase_identities(supabase_user_id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS roles(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('customer','seller','provider')), created_at TEXT NOT NULL, PRIMARY KEY(user_id,role));
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf_token TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
 CREATE TABLE IF NOT EXISTS provider_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, provider_type TEXT NOT NULL DEFAULT 'individual', business_name TEXT, service_area TEXT, verification_state TEXT NOT NULL DEFAULT 'unverified', created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS seller_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, business_name TEXT, location TEXT, verification_state TEXT NOT NULL DEFAULT 'unverified', created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY, seller_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL, product_type TEXT NOT NULL DEFAULT 'physical', currency TEXT NOT NULL DEFAULT 'GHS', price_minor INTEGER NOT NULL CHECK(price_minor > 0), cost_minor INTEGER CHECK(cost_minor IS NULL OR cost_minor >= 0), stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0), variants_json TEXT NOT NULL DEFAULT '[]', fulfillment_type TEXT NOT NULL CHECK(fulfillment_type IN ('own_inventory','supplier_fulfilled','dropship','external_checkout')), supplier_name TEXT, shipping_info TEXT, location TEXT, image_url TEXT, source_type TEXT NOT NULL DEFAULT 'direct', source_url TEXT, source_external_id TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','removed')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS products_active ON products(status,category,created_at DESC);
 CREATE INDEX IF NOT EXISTS products_seller ON products(seller_id,status);
 CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES users(id), category TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, area TEXT NOT NULL, budget_minor INTEGER NOT NULL CHECK(budget_minor >= 0), currency TEXT NOT NULL DEFAULT 'GHS', timing TEXT NOT NULL DEFAULT 'asap' CHECK(timing IN ('asap','scheduled')), scheduled_at TEXT, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','assigned','in_progress','awaiting_customer','completed','cancelled','disputed')), assigned_provider_id TEXT REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS jobs_open ON jobs(status,area,created_at DESC);
 CREATE INDEX IF NOT EXISTS jobs_customer ON jobs(customer_id,created_at DESC);
 CREATE TABLE IF NOT EXISTS job_offers(id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, provider_id TEXT NOT NULL REFERENCES users(id), amount_minor INTEGER NOT NULL CHECK(amount_minor > 0), note TEXT NOT NULL, eta TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','selected','declined')), created_at TEXT NOT NULL, UNIQUE(job_id,provider_id));
 CREATE TABLE IF NOT EXISTS job_messages(id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, sender_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, buyer_id TEXT NOT NULL REFERENCES users(id), currency TEXT NOT NULL DEFAULT 'GHS', total_minor INTEGER NOT NULL CHECK(total_minor > 0), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','partially_shipped','shipped','delivered','cancelled','disputed','refund_requested')), payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','pending','paid','partially_refunded','refunded')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS orders_buyer ON orders(buyer_id,created_at DESC);
 CREATE TABLE IF NOT EXISTS fulfillment_groups(id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, seller_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','shipped','delivered','cancelled')), tracking_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS fulfillment_seller ON fulfillment_groups(seller_id,status,created_at DESC);
 CREATE TABLE IF NOT EXISTS order_items(id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, group_id TEXT NOT NULL REFERENCES fulfillment_groups(id) ON DELETE CASCADE, product_id TEXT NOT NULL REFERENCES products(id), product_name TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0), unit_price_minor INTEGER NOT NULL CHECK(unit_price_minor > 0), seller_id TEXT NOT NULL REFERENCES users(id));
 CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), provider TEXT NOT NULL, provider_reference TEXT, amount_minor INTEGER NOT NULL CHECK(amount_minor > 0), currency TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('created','pending','paid','failed','refunded')), created_at TEXT NOT NULL);
 CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_reference ON payments(provider,provider_reference) WHERE provider_reference IS NOT NULL;
 CREATE TABLE IF NOT EXISTS payment_webhook_events(provider TEXT NOT NULL,event_id TEXT NOT NULL,event_type TEXT NOT NULL,received_at TEXT NOT NULL,processed_at TEXT,outcome TEXT,PRIMARY KEY(provider,event_id));
 CREATE TABLE IF NOT EXISTS refunds(id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), requester_id TEXT NOT NULL REFERENCES users(id), amount_minor INTEGER NOT NULL CHECK(amount_minor > 0), reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','rejected','provider_pending','refunded')), provider_reference TEXT, reviewer_id TEXT REFERENCES users(id), review_note TEXT, reviewed_at TEXT, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS domain_events(id TEXT PRIMARY KEY, aggregate_type TEXT NOT NULL, aggregate_id TEXT NOT NULL, event_type TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), details_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS events_aggregate ON domain_events(aggregate_type,aggregate_id,created_at);
 CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, target_type TEXT, target_id TEXT, read_at TEXT, created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id,read_at,created_at DESC);
 CREATE TABLE IF NOT EXISTS verification_requests(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), business_type TEXT NOT NULL, evidence_note TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')), reviewer_id TEXT REFERENCES users(id), review_note TEXT, reviewed_at TEXT, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS support_reports(id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL REFERENCES users(id), target_type TEXT NOT NULL, target_id TEXT NOT NULL, reason TEXT NOT NULL, details TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','resolved')), reviewer_id TEXT REFERENCES users(id), resolution_note TEXT, reviewed_at TEXT, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS staff_access(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,staff_role TEXT NOT NULL CHECK(staff_role IN ('admin','trust_staff','support_staff')),created_at TEXT NOT NULL,PRIMARY KEY(user_id,staff_role));
 CREATE TABLE IF NOT EXISTS store_connections(id TEXT PRIMARY KEY,seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,platform TEXT NOT NULL CHECK(platform IN ('shopify')),shop_domain TEXT NOT NULL UNIQUE,encrypted_access_token TEXT NOT NULL,encrypted_refresh_token TEXT,access_token_expires_at TEXT,refresh_token_expires_at TEXT,scopes TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked','error')),last_synced_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS store_connections_seller ON store_connections(seller_id,status);
 CREATE TABLE IF NOT EXISTS store_oauth_states(state_hash TEXT PRIMARY KEY,seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,shop_domain TEXT NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit_logs(id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL, reason TEXT, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS media_sessions(id TEXT PRIMARY KEY, room_name TEXT NOT NULL UNIQUE, creator_id TEXT NOT NULL REFERENCES users(id), mode TEXT NOT NULL CHECK(mode IN ('voice','video','live')), title TEXT NOT NULL, visibility TEXT NOT NULL CHECK(visibility IN ('private','public')), status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','ended')), created_at TEXT NOT NULL, ended_at TEXT);
 CREATE INDEX IF NOT EXISTS media_sessions_feed ON media_sessions(mode,visibility,status,created_at DESC);
 CREATE TABLE IF NOT EXISTS media_session_members(session_id TEXT NOT NULL REFERENCES media_sessions(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('host','participant','viewer','invited')), joined_at TEXT, PRIMARY KEY(session_id,user_id));
 CREATE TABLE IF NOT EXISTS media_assets(id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS people_presence(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, last_seen_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS people_follows(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL, PRIMARY KEY(user_id,target_user_id), CHECK(user_id != target_user_id));
 CREATE TABLE IF NOT EXISTS stories(id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, text TEXT NOT NULL DEFAULT '', asset_id TEXT REFERENCES media_assets(id), visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','followers')), created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS stories_active ON stories(expires_at,created_at DESC);
 CREATE TABLE IF NOT EXISTS story_views(story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE, viewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, viewed_at TEXT NOT NULL, PRIMARY KEY(story_id,viewer_id));
 CREATE TABLE IF NOT EXISTS reels(id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, caption TEXT NOT NULL DEFAULT '', asset_id TEXT NOT NULL REFERENCES media_assets(id), status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','removed')), created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS reels_active ON reels(status,created_at DESC);
 CREATE TABLE IF NOT EXISTS reel_views(reel_id TEXT NOT NULL REFERENCES reels(id) ON DELETE CASCADE, viewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, viewed_at TEXT NOT NULL, PRIMARY KEY(reel_id,viewer_id));
 CREATE TABLE IF NOT EXISTS reel_likes(reel_id TEXT NOT NULL REFERENCES reels(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL, PRIMARY KEY(reel_id,user_id));
`);
  const addColumn = (table, column, definition) => {
    if (!db.prepare(`PRAGMA table_info(${table})`).all().some((item) => item.name === column))
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  };
  for (const [table, column, definition] of [
    ["products", "source_external_id", "TEXT"],
    ["products", "image_url", "TEXT"],
    ["verification_requests", "reviewer_id", "TEXT REFERENCES users(id)"],
    ["verification_requests", "review_note", "TEXT"],
    ["verification_requests", "reviewed_at", "TEXT"],
    ["support_reports", "reviewer_id", "TEXT REFERENCES users(id)"],
    ["support_reports", "resolution_note", "TEXT"],
    ["support_reports", "reviewed_at", "TEXT"],
    ["audit_logs", "reason", "TEXT"],
    ["store_connections", "encrypted_refresh_token", "TEXT"],
    ["store_connections", "access_token_expires_at", "TEXT"],
    ["store_connections", "refresh_token_expires_at", "TEXT"],
    ["refunds", "provider_reference", "TEXT"],
    ["refunds", "reviewer_id", "TEXT REFERENCES users(id)"],
    ["refunds", "review_note", "TEXT"],
    ["refunds", "reviewed_at", "TEXT"],
  ]) addColumn(table, column, definition);
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS products_source_external ON products(seller_id,source_type,source_external_id) WHERE source_external_id IS NOT NULL");
}

const now = () => new Date().toISOString();
const hash = (value) => createHash("sha256").update(value).digest("hex");
const statements = new Map();
function postgresQuery(sql, params) {
  const ignore = /^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+/i.test(sql);
  let index = 0;
  let statement = sql
    .replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+/i, "INSERT INTO ")
    .replace(/\?/g, () => `$${++index}`)
    .replace(/\s+COLLATE\s+NOCASE/gi, "");
  if (ignore) statement = `${statement.trimEnd()} ON CONFLICT DO NOTHING`;
  return [statement, params];
}
async function q(sql, ...params) {
  if (postgresMode) {
    const client = transactionClient.getStore() || pool;
    const [statement, values] = postgresQuery(sql, params);
    return (await client.query(statement, values)).rows[0];
  }
  let statement = statements.get(sql);
  if (!statement) {
    statement = db.prepare(sql);
    statements.set(sql, statement);
  }
  return statement.get(...params);
}
async function all(sql, ...params) {
  if (postgresMode) {
    const client = transactionClient.getStore() || pool;
    const [statement, values] = postgresQuery(sql, params);
    return (await client.query(statement, values)).rows;
  }
  let statement = statements.get(sql);
  if (!statement) {
    statement = db.prepare(sql);
    statements.set(sql, statement);
  }
  return statement.all(...params);
}
async function run(sql, ...params) {
  if (postgresMode) {
    const client = transactionClient.getStore() || pool;
    const [statement, values] = postgresQuery(sql, params);
    const result = await client.query(statement, values);
    return { changes: result.rowCount };
  }
  let statement = statements.get(sql);
  if (!statement) {
    statement = db.prepare(sql);
    statements.set(sql, statement);
  }
  return statement.run(...params);
}
async function transaction(work) {
  if (postgresMode) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await transactionClient.run(client, work);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = await work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
function fault(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}
function assert(condition, status, code, message) {
  if (!condition) fault(status, code, message);
}
function mediaStorageConfig() {
  const projectUrl = (process.env.STORAGE_URL || process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.STORAGE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  if (!projectUrl || !key) return null;
  return {
    root: projectUrl.endsWith("/storage/v1") ? projectUrl : `${projectUrl}/storage/v1`,
    key,
    bucket: process.env.STORAGE_BUCKET || "ecovibes-media",
  };
}
function mediaObjectUrl(config, assetId) {
  return `${config.root}/object/${encodeURIComponent(config.bucket)}/${encodeURIComponent(assetId)}`;
}
async function storeMediaAsset(assetId, bytes, mime) {
  const config = mediaStorageConfig();
  if (!config) {
    assert(!isProduction, 503, "media_storage_unavailable", "Configure Supabase Storage before accepting uploads.");
    const dir = resolve(root, "server/data/social-media");
    mkdirSync(dir, { recursive: true });
    await writeFile(resolve(dir, assetId), bytes, { flag: "wx", mode: 0o600 });
    return;
  }
  const response = await fetch(mediaObjectUrl(config, assetId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.key}`,
      apikey: config.key,
      "Content-Type": mime,
      "x-upsert": "false",
    },
    body: bytes,
  });
  assert(response.ok, 502, "media_storage_failed", "The media provider could not save this upload.");
}
async function removeMediaAsset(assetId) {
  const config = mediaStorageConfig();
  if (!config) {
    await unlink(resolve(root, "server/data/social-media", assetId)).catch(() => undefined);
    return;
  }
  await fetch(mediaObjectUrl(config, assetId), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${config.key}`, apikey: config.key },
  }).catch(() => undefined);
}
async function loadMediaAsset(assetId) {
  const config = mediaStorageConfig();
  if (!config) return await readFile(resolve(root, "server/data/social-media", assetId));
  const response = await fetch(mediaObjectUrl(config, assetId), {
    headers: { Authorization: `Bearer ${config.key}`, apikey: config.key },
  });
  assert(response.ok, 404, "asset_not_found", "Media is no longer available.");
  return Buffer.from(await response.arrayBuffer());
}
const id = () => randomUUID();
const liveKitConfigured = Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
const liveKitHost = process.env.LIVEKIT_URL?.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:");
const liveKitClientUrl = process.env.LIVEKIT_URL?.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
const liveKit = liveKitConfigured ? new LiveKitAPI({ host: liveKitHost, apiKey: process.env.LIVEKIT_API_KEY, secret: process.env.LIVEKIT_API_SECRET }) : null;
const liveKitWebhook = liveKitConfigured ? new WebhookReceiver(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET) : null;
function requireLiveKit() {
  assert(liveKitConfigured, 503, "media_provider_unavailable", "Live audio and video are not configured yet. Add the LiveKit server credentials.");
}
const passwordHash = (password, salt) =>
  scryptSync(password, salt, 64).toString("hex");
async function safeUser(userId) {
  const user = await q(
    "SELECT id,eco_id,display_name,status,created_at FROM users WHERE id=?",
    userId,
  );
  if (!user) return null;
  const roles = (await all(
    "SELECT role FROM roles WHERE user_id=? ORDER BY role",
    userId,
  )).map((item) => item.role);
  roles.push(...(await all(
    "SELECT staff_role AS role FROM staff_access WHERE user_id=? ORDER BY staff_role",
    userId,
  )).map((item) => item.role));
  const bootstrapAdmins = (process.env.ECOVIBES_ADMIN_ECO_IDS || "")
    .split(",")
    .map((value) => value.trim().replace(/^@/, "").toLowerCase());
  if (bootstrapAdmins.includes(user.eco_id.toLowerCase())) roles.push("admin");
  return {
    ...user,
    roles: [...new Set(roles)],
  };
}
async function hasRole(userId, role) {
  return !!(await q("SELECT 1 ok FROM roles WHERE user_id=? AND role=?", userId, role));
}
async function requireRole(ctx, role) {
  assert(
    ctx.user && (await hasRole(ctx.user.id, role)),
    403,
    "role_required",
    `An active ${role} role is required.`,
  );
}
function requireStaff(ctx, role) {
  assert(ctx.user, 401, "sign_in_required", "Sign in to continue.");
  const roles = ctx.user.roles || [];
  assert(
    roles.includes("admin") || roles.includes(role),
    403,
    "staff_required",
    "This review action requires authorized staff access.",
  );
}
function tokenEncryptionKey() {
  const encoded = process.env.TOKEN_ENCRYPTION_KEY || "";
  const key = Buffer.from(encoded, "base64");
  assert(key.length === 32, 503, "connector_unconfigured", "Set a 32-byte base64 TOKEN_ENCRYPTION_KEY in the API secret settings.");
  return key;
}
function encryptSecret(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}
function decryptSecret(value) {
  const payload = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", tokenEncryptionKey(), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8");
}
async function notify(userId, type, title, body, targetType, targetId) {
  await run(
    "INSERT INTO notifications(id,user_id,type,title,body,target_type,target_id,created_at) VALUES(?,?,?,?,?,?,?,?)",
    id(),
    userId,
    type,
    title,
    body,
    targetType || null,
    targetId || null,
    now(),
  );
}
async function event(actorId, aggregateType, aggregateId, eventType, details = {}) {
  await run(
    "INSERT INTO domain_events(id,aggregate_type,aggregate_id,event_type,actor_id,details_json,created_at) VALUES(?,?,?,?,?,?,?)",
    id(),
    aggregateType,
    aggregateId,
    eventType,
    actorId,
    JSON.stringify(details),
    now(),
  );
  await run(
    "INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,created_at) VALUES(?,?,?,?,?,?)",
    id(),
    actorId,
    eventType,
    aggregateType,
    aggregateId,
    now(),
  );
}
function setCookie(res, name, value, options = {}) {
  const attrs = [
    `${name}=${value}`,
    `Path=${options.path || "/"}`,
    `SameSite=Lax`,
  ];
  if (options.httpOnly) attrs.push("HttpOnly");
  if (options.secure) attrs.push("Secure");
  if (options.maxAge !== undefined) attrs.push(`Max-Age=${options.maxAge}`);
  res.setHeader("Set-Cookie", attrs.join("; "));
}
function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const ix = part.indexOf("=");
        return [part.slice(0, ix), decodeURIComponent(part.slice(ix + 1))];
      }),
  );
}
const sessions = new Map();
function cleanupSessions() {
  const t = Date.now();
  for (const [key, entry] of sessions)
    if (entry.until < t) sessions.delete(key);
}
setInterval(cleanupSessions, 60_000).unref();
async function session(ctx, res, req) {
  const raw = randomBytes(32).toString("base64url");
  const csrf = randomBytes(24).toString("base64url");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await run(
    "INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES(?,?,?,?,?)",
    hash(raw),
    ctx.user.id,
    csrf,
    expires,
    now(),
  );
  ctx.csrfToken = csrf;
  setCookie(res, "ev_session", raw, {
    httpOnly: true,
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60,
  });
}
function originCheck(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  const host = req.headers.host;
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return fault(403, "bad_origin", "Invalid request origin.");
  }
  const allowedOrigins = (process.env.APP_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
  assert(
    originHost === host || allowedOrigins.includes(origin),
    403,
    "bad_origin",
    "Cross-origin write rejected.",
  );
}
const limitBuckets = new Map();
function rateLimit(key, maximum, windowMs) {
  const stamp = Date.now();
  const bucket = limitBuckets.get(key);
  if (!bucket || stamp > bucket.resetAt) {
    limitBuckets.set(key, { count: 1, resetAt: stamp + windowMs });
    return;
  }
  bucket.count++;
  assert(
    bucket.count <= maximum,
    429,
    "rate_limited",
    "Too many attempts. Wait before trying again.",
  );
}
async function bodyJson(req, maxBytes = 256_000) {
  const chunks = [];
  let totalBytes = 0;
  for await (const part of req) {
    const chunk = Buffer.from(part);
    totalBytes += chunk.length;
    if (totalBytes > maxBytes)
      fault(413, "too_large", "Request body is too large.");
    chunks.push(chunk);
  }
  req.rawBody = Buffer.concat(chunks);
  if (!req.rawBody.length) return {};
  try {
    return JSON.parse(req.rawBody.toString("utf8"));
  } catch {
    return fault(400, "invalid_json", "Request body must be valid JSON.");
  }
}
function inputString(
  value,
  name,
  { min = 1, max = 200, optional = false } = {},
) {
  assert(
    typeof value === "string",
    400,
    "invalid_field",
    `${name} must be text.`,
  );
  const trimmed = value.trim();
  if (optional && trimmed === "") return "";
  assert(
    trimmed.length >= min && trimmed.length <= max,
    400,
    "invalid_field",
    `${name} must be between ${min} and ${max} characters.`,
  );
  return trimmed;
}
function validMinor(value, name, { min = 1, allowZero = false } = {}) {
  assert(
    Number.isSafeInteger(value) && value >= (allowZero ? 0 : min),
    400,
    "invalid_amount",
    `${name} is invalid.`,
  );
  return value;
}
function rowProduct(row, sellerEcoId) {
  return {
    ...row,
    variants: JSON.parse(row.variants_json),
    priceMinor: row.price_minor,
    costMinor: row.cost_minor,
    stock: row.stock,
    sellerEcoId: sellerEcoId || row.seller_eco_id,
  };
}
async function getJob(jobId) {
  const job = await q(
    `SELECT j.*,u.eco_id customer_eco_id,u.display_name customer_name,pu.eco_id assigned_provider_eco_id FROM jobs j JOIN users u ON u.id=j.customer_id LEFT JOIN users pu ON pu.id=j.assigned_provider_id WHERE j.id=?`,
    jobId,
  );
  if (!job) return null;
  job.offers = await all(
    "SELECT o.*,u.eco_id provider_eco_id,u.display_name provider_name FROM job_offers o JOIN users u ON u.id=o.provider_id WHERE o.job_id=? ORDER BY o.created_at",
    jobId,
  );
  job.messages = await all(
    "SELECT m.id,m.sender_id,u.eco_id sender_eco_id,u.display_name sender_name,m.body,m.created_at FROM job_messages m JOIN users u ON u.id=m.sender_id WHERE m.job_id=? ORDER BY m.created_at",
    jobId,
  );
  job.events = await all(
    "SELECT e.event_type,e.created_at,e.details_json,u.eco_id actor_eco_id FROM domain_events e JOIN users u ON u.id=e.actor_id WHERE e.aggregate_type='job' AND e.aggregate_id=? ORDER BY e.created_at DESC LIMIT 20",
    jobId,
  );
  return job;
}
function visibleJob(job, ctx) {
  const owner = job.customer_id === ctx.user?.id,
    assigned = job.assigned_provider_id === ctx.user?.id;
  const participant = owner || assigned;
  const ownOffers = job.offers.filter(
    (offer) => offer.provider_id === ctx.user?.id,
  );
  if (!owner && !assigned) job.offers = ownOffers;
  else if (assigned && !owner)
    job.offers = job.offers.filter((offer) => offer.status === "selected");
  job.messages = participant ? job.messages : [];
  for (const offer of job.offers) delete offer.provider_id;
  for (const message of job.messages) delete message.sender_id;
  job.events = job.events.map(({ event_type, created_at, actor_eco_id }) => ({
    event_type,
    created_at,
    actor_eco_id,
  }));
  delete job.customer_id;
  delete job.assigned_provider_id;
  return job;
}
function publicProduct(row, ctx) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    productType: row.product_type,
    currency: row.currency,
    priceMinor: row.price_minor,
    stock: row.stock,
    variants: JSON.parse(row.variants_json),
    fulfillment_type: row.fulfillment_type,
    shippingInfo: row.shipping_info,
    location: row.location,
    source_type: row.source_type,
    image_url: row.image_url,
    created_at: row.created_at,
    sellerEcoId: row.seller_eco_id,
    sellerName: row.seller_name,
    sellerIsCurrentUser: ctx.user?.id === row.seller_id,
  };
}
function visibleOrder(order, ctx) {
  const isBuyer = order.buyer_id === ctx.user?.id;
  if (!isBuyer) {
    order.groups = order.groups.filter(
      (group) => group.seller_id === ctx.user?.id,
    );
    const items = order.groups.flatMap((group) => group.items);
    order.total_minor = items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price_minor,
      0,
    );
    delete order.buyer_id;
    delete order.payment_status;
  }
  for (const group of order.groups) {
    group.sellerIsCurrentUser = group.seller_id === ctx.user?.id;
    delete group.seller_id;
    delete group.order_id;
    for (const item of group.items) {
      delete item.seller_id;
      delete item.group_id;
      delete item.order_id;
    }
  }
  return order;
}
function canReadJob(ctx, job) {
  return (
    job.status === "open" ||
    (ctx.user &&
      (ctx.user.id === job.customer_id ||
        ctx.user.id === job.assigned_provider_id))
  );
}
async function getOrder(orderId) {
  const order = await q("SELECT * FROM orders WHERE id=?", orderId);
  if (!order) return null;
  order.groups = await all(
    `SELECT g.*,u.eco_id seller_eco_id,u.display_name seller_name FROM fulfillment_groups g JOIN users u ON u.id=g.seller_id WHERE g.order_id=? ORDER BY g.created_at`,
    orderId,
  );
  order.groups = await Promise.all(order.groups.map(async (group) => ({
    ...group,
    items: await all("SELECT * FROM order_items WHERE group_id=?", group.id),
  })));
  return order;
}
async function expireUnpaidOrders() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const candidates = await all(
    "SELECT id FROM orders WHERE status IN ('pending','confirmed') AND payment_status IN ('unpaid','pending') AND updated_at<=? ORDER BY updated_at LIMIT 100",
    cutoff,
  );
  for (const candidate of candidates) {
    await transaction(async () => {
      const order = await q(
        `SELECT * FROM orders WHERE id=?${postgresMode ? " FOR UPDATE" : ""}`,
        candidate.id,
      );
      if (
        !order ||
        !["pending", "confirmed"].includes(order.status) ||
        !["unpaid", "pending"].includes(order.payment_status) ||
        order.updated_at > cutoff
      ) return;
      const details = await getOrder(order.id);
      for (const group of details.groups) {
        for (const item of group.items) {
          await run(
            "UPDATE products SET stock=stock+?,updated_at=? WHERE id=?",
            item.quantity,
            now(),
            item.product_id,
          );
        }
        await run(
          "UPDATE fulfillment_groups SET status='cancelled',updated_at=? WHERE id=? AND status='pending'",
          now(),
          group.id,
        );
      }
      await run(
        "UPDATE orders SET status='cancelled',updated_at=? WHERE id=? AND status IN ('pending','confirmed') AND payment_status IN ('unpaid','pending')",
        now(),
        order.id,
      );
      await run(
        "UPDATE payments SET state='failed' WHERE order_id=? AND state IN ('created','pending')",
        order.id,
      );
      for (const group of details.groups) {
        await notify(
          group.seller_id,
          "order",
          "Unpaid order expired",
          `Order ${order.id.slice(0, 8)} was not paid within 30 minutes and its reserved stock was released.`,
          "order",
          order.id,
        );
      }
      await notify(
        order.buyer_id,
        "order",
        "Unpaid order released",
        `Order ${order.id.slice(0, 8)} expired after 30 minutes. Reserved stock is available again.`,
        "order",
        order.id,
      );
      await event(order.buyer_id, "order", order.id, "UNPAID_ORDER_EXPIRED");
    });
  }
}
function canReadOrder(ctx, order) {
  return (
    ctx.user &&
    (ctx.user.id === order.buyer_id ||
      order.groups.some((group) => group.seller_id === ctx.user.id))
  );
}
async function route(ctx, req, res, method, path, body, query) {
  if (method === "POST" && path === "/webhooks/paystack") {
    const secret = process.env.PAYSTACK_SECRET_KEY || "";
    assert(secret.startsWith("sk_test_"), 503, "test_provider_unavailable", "Paystack test mode is not configured.");
    const signature = req.headers["x-paystack-signature"];
    const expected = createHmac("sha512", secret).update(req.rawBody || Buffer.alloc(0)).digest("hex");
    assert(typeof signature === "string" && signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)), 401, "invalid_signature", "Webhook signature is invalid.");
    let hook;
    try { hook = JSON.parse((req.rawBody || Buffer.alloc(0)).toString("utf8")); } catch { fault(400, "invalid_webhook", "Webhook payload is invalid."); }
    const eventId = String(hook.data?.id || (hook.event?.startsWith("refund.") ? `${hook.event}:${hook.data?.refund_reference || hook.data?.transaction_reference || ""}` : hook.data?.reference) || "");
    assert(eventId, 400, "invalid_webhook", "Webhook event reference is missing.");
    await transaction(async () => {
      const inserted = await run("INSERT OR IGNORE INTO payment_webhook_events(provider,event_id,event_type,received_at) VALUES('paystack',?,?,?)", eventId, String(hook.event || "unknown"), now());
      if (!inserted.changes) return;
      if (hook.event === "charge.success") {
        const reference = String(hook.data.reference || "");
        const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` } });
        const verified = await verifyResponse.json();
        const payment = await q("SELECT * FROM payments WHERE provider='paystack' AND provider_reference=?", reference);
        if (!verifyResponse.ok || !verified.status) fault(502, "payment_verification_unavailable", "Paystack verification is temporarily unavailable.");
        if (!payment || verified.data?.reference !== reference || verified.data?.status !== "success" || Number(verified.data.amount) !== payment.amount_minor || verified.data.currency !== payment.currency) {
          await run("UPDATE payment_webhook_events SET processed_at=?,outcome='verification_failed' WHERE provider='paystack' AND event_id=?", now(), eventId);
          return;
        }
        const order = await q(
          `SELECT * FROM orders WHERE id=?${postgresMode ? " FOR UPDATE" : ""}`,
          payment.order_id,
        );
        if (order?.status === "cancelled") {
          await run("UPDATE payments SET state='paid' WHERE id=?", payment.id);
          await run("UPDATE orders SET status='disputed',payment_status='paid',updated_at=? WHERE id=?", now(), order.id);
          const refundId = id();
          await run(
            "INSERT INTO refunds(id,order_id,requester_id,amount_minor,reason,status,created_at) VALUES(?,?,?,?,?,'requested',?)",
            refundId,
            order.id,
            order.buyer_id,
            payment.amount_minor,
            "Payment settled after this unpaid order was cancelled; staff review and provider refund are required.",
            now(),
          );
          await notify(
            order.buyer_id,
            "refund",
            "Late payment sent for review",
            `Payment for cancelled order ${order.id.slice(0, 8)} arrived after stock was released. Staff review is required before a refund is sent.`,
            "order",
            order.id,
          );
          await event(order.buyer_id, "order", order.id, "LATE_PAYMENT_REFUND_REQUESTED", { refundId });
          await run("UPDATE payment_webhook_events SET processed_at=?,outcome='late_payment_after_cancel' WHERE provider='paystack' AND event_id=?", now(), eventId);
          return;
        }
        if (order && order.payment_status !== "paid") {
          await run("UPDATE payments SET state='paid' WHERE id=?", payment.id);
          await run("UPDATE orders SET payment_status='paid',updated_at=? WHERE id=?", now(), order.id);
          await notify(order.buyer_id, "payment", "Payment confirmed", `Payment for order ${order.id.slice(0, 8)} is confirmed.`, "order", order.id);
          const groups = await all("SELECT seller_id FROM fulfillment_groups WHERE order_id=?", order.id);
          for (const group of groups) await notify(group.seller_id, "order", "Paid order ready", `Order ${order.id.slice(0, 8)} is paid and ready to fulfill.`, "order", order.id);
        }
      }
      if (hook.event?.startsWith("refund.")) {
        const paymentReference = String(hook.data?.transaction_reference || "");
        const payment = await q("SELECT * FROM payments WHERE provider='paystack' AND provider_reference=?", paymentReference);
        const refund = payment && await q("SELECT * FROM refunds WHERE order_id=? AND status='provider_pending' ORDER BY created_at DESC LIMIT 1", payment.order_id);
        if (refund) {
          if (hook.event === "refund.processed") {
            await run("UPDATE refunds SET status='refunded',provider_reference=?,reviewed_at=? WHERE id=?", String(hook.data.refund_reference || ""), now(), refund.id);
            await run("UPDATE orders SET payment_status='refunded',updated_at=? WHERE id=?", now(), refund.order_id);
            await run("UPDATE payments SET state='refunded' WHERE order_id=? AND provider='paystack'", refund.order_id);
            await notify(refund.requester_id, "refund", "Refund processed", `Refund for order ${refund.order_id.slice(0, 8)} was processed.`, "order", refund.order_id);
          } else if (hook.event === "refund.failed" || hook.event === "refund.needs-attention") {
            await run("UPDATE refunds SET status='rejected',review_note=? WHERE id=?", `Paystack refund ${hook.data.status || hook.event}. Contact support if you need help.`, refund.id);
            await notify(refund.requester_id, "refund", "Refund needs attention", `The provider could not complete the refund for order ${refund.order_id.slice(0, 8)}.`, "order", refund.order_id);
          }
        }
      }
      await run("UPDATE payment_webhook_events SET processed_at=?,outcome=? WHERE provider='paystack' AND event_id=?", now(), hook.event === "charge.success" ? "processed" : "ignored", eventId);
    });
    return { received: true };
  }
  if (method === "GET" && path === "/connectors/shopify/callback") {
    const params = Object.fromEntries(query.entries());
    const hmac = params.hmac;
    const shop = String(params.shop || "").toLowerCase();
    assert(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop), 400, "invalid_shop", "Shop domain is invalid.");
    const canonical = Object.entries(params).filter(([key]) => !["hmac", "signature"].includes(key)).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("&");
    const expected = createHmac("sha256", process.env.SHOPIFY_CLIENT_SECRET || "").update(canonical).digest("hex");
    assert(hmac && expected.length === hmac.length && timingSafeEqual(Buffer.from(expected), Buffer.from(hmac)), 401, "invalid_hmac", "Shopify callback could not be verified.");
    assert(Math.abs(Date.now() / 1000 - Number(params.timestamp)) < 300, 401, "expired_callback", "Shopify callback expired.");
    const state = String(params.state || "");
    const browserState = parseCookies(req).ev_shopify_state || "";
    assert(browserState.length === state.length && timingSafeEqual(Buffer.from(browserState), Buffer.from(state)), 401, "state_cookie_mismatch", "Shopify connection must finish in the browser that started it.");
    const stateRow = await q("SELECT * FROM store_oauth_states WHERE state_hash=? AND shop_domain=? AND expires_at>?", hash(state), shop, now());
    assert(stateRow, 401, "invalid_state", "Shopify authorization state expired or was already used.");
    const existingConnection = await q("SELECT seller_id FROM store_connections WHERE shop_domain=?", shop);
    assert(!existingConnection || existingConnection.seller_id === stateRow.seller_id, 409, "shop_already_connected", "This Shopify store is already connected to another EcoVibes seller.");
    await run("DELETE FROM store_oauth_states WHERE state_hash=?", hash(state));
    setCookie(res, "ev_shopify_state", "", { secure: isProduction, maxAge: 0, path: "/api/v1/connectors/shopify" });
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.SHOPIFY_CLIENT_ID || "", client_secret: process.env.SHOPIFY_CLIENT_SECRET || "", code: String(params.code || ""), expiring: "1" }) });
    const token = await tokenResponse.json();
    assert(tokenResponse.ok && token.access_token && token.refresh_token, 502, "shopify_token_exchange_failed", "Shopify did not return expiring offline credentials.");
    const stamp = now();
    await run("INSERT INTO store_connections(id,seller_id,platform,shop_domain,encrypted_access_token,encrypted_refresh_token,access_token_expires_at,refresh_token_expires_at,scopes,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,'active',?,?) ON CONFLICT(shop_domain) DO UPDATE SET seller_id=excluded.seller_id,encrypted_access_token=excluded.encrypted_access_token,encrypted_refresh_token=excluded.encrypted_refresh_token,access_token_expires_at=excluded.access_token_expires_at,refresh_token_expires_at=excluded.refresh_token_expires_at,scopes=excluded.scopes,status='active',updated_at=excluded.updated_at", id(), stateRow.seller_id, "shopify", shop, encryptSecret(token.access_token), encryptSecret(token.refresh_token), new Date(Date.now() + Number(token.expires_in || 0) * 1000).toISOString(), new Date(Date.now() + Number(token.refresh_token_expires_in || 0) * 1000).toISOString(), String(token.scope || ""), stamp, stamp);
    const frontendOrigin = (process.env.APP_ORIGINS || "").split(",").map((value) => value.trim()).find(Boolean);
    assert(frontendOrigin, 503, "frontend_origin_unconfigured", "Set APP_ORIGINS before connecting a store.");
    const returnToApp = new URL("/", frontendOrigin);
    returnToApp.searchParams.set("shopify", "connected");
    res.statusCode = 303;
    res.setHeader("Location", returnToApp.toString());
    res.end();
    return { __sent: true };
  }
  if (method === "POST" && path === "/media/webhook") {
    requireLiveKit();
    let hook;
    try { hook = await liveKitWebhook.receive(req.rawBody || "", req.headers.authorization); }
    catch { fault(401, "invalid_webhook", "LiveKit webhook signature is invalid."); }
    const roomName = hook.room?.name;
    if (roomName && hook.event === "room_finished") {
      const media = await q("SELECT * FROM media_sessions WHERE room_name=? AND status='active'", roomName);
      if (media) {
        await run("UPDATE media_sessions SET status='ended',ended_at=? WHERE id=?", now(), media.id);
        await event(media.creator_id, "media_session", media.id, "MEDIA_SESSION_ENDED", { source: "livekit_webhook" });
      }
    }
    return { received: true };
  }
  if (method === "GET" && path === "/health") {
    await q("SELECT 1 AS ok");
    return {
      status: "ok",
      service: "ecovibes-api",
      database: postgresMode ? "postgres" : "sqlite",
      time: now(),
    };
  }
  if (method === "GET" && path === "/connectors/shopify") {
    await requireRole(ctx, "seller");
    return await all("SELECT id,shop_domain,scopes,status,last_synced_at,created_at FROM store_connections WHERE seller_id=? AND platform='shopify' ORDER BY created_at DESC", ctx.user.id);
  }
  if (method === "POST" && path === "/connectors/shopify/start") {
    await requireRole(ctx, "seller");
    assert(process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET && process.env.SHOPIFY_REDIRECT_URI, 503, "shopify_not_configured", "Shopify app settings are not configured on the API host.");
    const shop = String(body.shop || "").trim().toLowerCase();
    assert(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop), 400, "invalid_shop", "Enter your store address, for example example.myshopify.com.");
    const state = randomBytes(32).toString("base64url"), stamp = now();
    setCookie(res, "ev_shopify_state", state, { secure: isProduction, maxAge: 600, path: "/api/v1/connectors/shopify" });
    await run("DELETE FROM store_oauth_states WHERE expires_at<?", stamp);
    await run("INSERT INTO store_oauth_states(state_hash,seller_id,shop_domain,expires_at,created_at) VALUES(?,?,?,?,?)", hash(state), ctx.user.id, shop, new Date(Date.now() + 10 * 60_000).toISOString(), stamp);
    const authorize = new URL(`https://${shop}/admin/oauth/authorize`);
    authorize.search = new URLSearchParams({ client_id: process.env.SHOPIFY_CLIENT_ID, scope: "read_products,read_inventory", redirect_uri: process.env.SHOPIFY_REDIRECT_URI, state, expiring: "1" }).toString();
    return { authorizationUrl: authorize.toString() };
  }
  if (method === "POST" && path === "/connectors/shopify/sync") {
    await requireRole(ctx, "seller");
    const connection = await q("SELECT * FROM store_connections WHERE id=? AND seller_id=? AND platform='shopify' AND status='active'", String(body.connectionId || ""), ctx.user.id);
    assert(connection, 404, "store_not_found", "Connected store not found.");
    let accessToken = decryptSecret(connection.encrypted_access_token), refreshToken = decryptSecret(connection.encrypted_refresh_token);
    if (Date.parse(connection.access_token_expires_at || "") < Date.now() + 60_000) {
      assert(Date.parse(connection.refresh_token_expires_at || "") > Date.now(), 401, "shopify_reconnect_required", "Shopify authorization expired. Reconnect the store.");
      const refreshed = await fetch(`https://${connection.shop_domain}/admin/oauth/access_token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.SHOPIFY_CLIENT_ID || "", client_secret: process.env.SHOPIFY_CLIENT_SECRET || "", grant_type: "refresh_token", refresh_token: refreshToken }) });
      const credentials = await refreshed.json();
      assert(refreshed.ok && credentials.access_token && credentials.refresh_token, 502, "shopify_refresh_failed", "Shopify authorization could not be refreshed. Reconnect the store.");
      accessToken = credentials.access_token; refreshToken = credentials.refresh_token;
      await run("UPDATE store_connections SET encrypted_access_token=?,encrypted_refresh_token=?,access_token_expires_at=?,refresh_token_expires_at=?,updated_at=? WHERE id=?", encryptSecret(accessToken), encryptSecret(refreshToken), new Date(Date.now() + Number(credentials.expires_in || 0) * 1000).toISOString(), new Date(Date.now() + Number(credentials.refresh_token_expires_in || 0) * 1000).toISOString(), now(), connection.id);
    }
    const apiVersion = process.env.SHOPIFY_API_VERSION || "2026-07";
    let cursor = null, imported = 0, pages = 0;
    do {
      const response = await fetch(`https://${connection.shop_domain}/admin/api/${apiVersion}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken }, body: JSON.stringify({ query: "query Products($after:String){shop{currencyCode} products(first:50,after:$after){edges{cursor node{id title descriptionHtml productType featuredImage{url} variants(first:100){edges{node{id title price inventoryQuantity selectedOptions{name value}}}}} } pageInfo{hasNextPage endCursor}}}", variables: { after: cursor } }) });
      const result = await response.json();
      assert(response.ok && !result.errors, 502, "shopify_sync_failed", "Shopify product import failed.");
      assert(result.data.shop.currencyCode === "GHS", 422, "shop_currency_unsupported", "Set the Shopify store currency to GHS before importing prices into EcoVibes.");
      const connectionData = result.data.products;
      for (const edge of connectionData.edges) {
        const item = edge.node, variant = item.variants.edges[0]?.node;
        const price = Number(variant?.price || 0), stock = Number(variant?.inventoryQuantity || 0);
        if (!item.title || !Number.isFinite(price) || price <= 0) continue;
        const productId = id(), stamp = now(), sourceId = item.id;
        await run("INSERT INTO products(id,seller_id,name,description,category,price_minor,cost_minor,stock,variants_json,fulfillment_type,supplier_name,shipping_info,location,image_url,source_type,source_url,source_external_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?,NULL,? ,?,'own_inventory',NULL,NULL,NULL,?,'shopify',?,?, 'paused',?,?) ON CONFLICT(seller_id,source_type,source_external_id) WHERE source_external_id IS NOT NULL DO UPDATE SET name=excluded.name,description=excluded.description,category=excluded.category,price_minor=excluded.price_minor,stock=excluded.stock,variants_json=excluded.variants_json,image_url=excluded.image_url,source_url=excluded.source_url,updated_at=excluded.updated_at", productId, ctx.user.id, item.title.slice(0, 100), String(item.descriptionHtml || "").replace(/<[^>]*>/g, " ").slice(0, 3000), String(item.productType || "Imported").slice(0, 80), Math.round(price * 100), Math.max(0, stock), JSON.stringify(item.variants.edges.map(({node})=>({id:node.id,title:node.title,price:node.price,stock:node.inventoryQuantity,options:node.selectedOptions}))), item.featuredImage?.url || null, `https://${connection.shop_domain}/admin/products/${sourceId.split("/").pop()}`, sourceId, stamp, stamp);
        imported++;
      }
      cursor = connectionData.pageInfo.endCursor; pages++;
    } while (connectionData.pageInfo.hasNextPage && pages < 4);
    await run("UPDATE store_connections SET last_synced_at=?,updated_at=? WHERE id=?", now(), now(), connection.id);
    return { imported, status: "review_required", message: "Imported products are paused until you review and publish them." };
  }
  if (method === "POST" && /^\/marketplace\/orders\/[a-f0-9-]+\/pay$/.test(path)) {
    assert((process.env.PAYSTACK_SECRET_KEY || "").startsWith("sk_test_"), 503, "test_provider_unavailable", "Paystack test mode is not configured on the API host.");
    const orderId = path.split("/")[3], order = await getOrder(orderId);
    assert(order && order.buyer_id === ctx.user?.id, 404, "not_found", "Order not found.");
    assert(["pending", "confirmed"].includes(order.status) && order.payment_status === "unpaid", 409, "invalid_payment_state", "This order is not available for another payment attempt.");
    const email = inputString(body.email, "Email", { min: 5, max: 254 });
    assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 400, "invalid_email", "Enter a valid receipt email.");
    const reference = `ev_${randomBytes(18).toString("hex")}`, paymentId = id();
    await transaction(async () => {
      const reserved = await run("UPDATE orders SET payment_status='pending',updated_at=? WHERE id=? AND buyer_id=? AND status IN ('pending','confirmed') AND payment_status='unpaid'", now(), order.id, ctx.user.id);
      assert(reserved.changes === 1, 409, "invalid_payment_state", "This order already has an active payment attempt.");
      await run("INSERT INTO payments(id,order_id,provider,provider_reference,amount_minor,currency,state,created_at) VALUES(?,?,'paystack',?,?,?,'pending',?)", paymentId, order.id, reference, order.total_minor, "GHS", now());
    });
    let response, result;
    try {
      response = await fetch("https://api.paystack.co/transaction/initialize", { method: "POST", headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, amount: order.total_minor, currency: "GHS", reference, metadata: { orderId: order.id, paymentId }, ...(process.env.PAYSTACK_CALLBACK_URL ? { callback_url: process.env.PAYSTACK_CALLBACK_URL } : {}) }) });
      result = await response.json();
    } catch {
      await run("UPDATE payments SET state='failed' WHERE id=?", paymentId);
      await run("UPDATE orders SET payment_status='unpaid',updated_at=? WHERE id=?", now(), order.id);
      fault(502, "payment_initialization_failed", "Paystack could not be reached. You can try checkout again.");
    }
    if (!response.ok || !result.status || !result.data?.authorization_url) {
      await run("UPDATE payments SET state='failed' WHERE id=?", paymentId);
      await run("UPDATE orders SET payment_status='unpaid',updated_at=? WHERE id=? AND payment_status='pending'", now(), order.id);
      fault(502, "payment_initialization_failed", "Paystack could not start this test payment.");
    }
    return { authorizationUrl: result.data.authorization_url, reference };
  }
  if (method === "POST" && path === "/auth/register") {
    rateLimit(`reg:${req.socket.remoteAddress}`, 8, 60 * 60_000);
    const ecoId = inputString(body.ecoId, "EcoVibes ID", { min: 3, max: 24 })
      .toLowerCase()
      .replace(/^@/, "");
    assert(
      /^[a-z0-9][a-z0-9._]{2,23}$/.test(ecoId),
      400,
      "invalid_eco_id",
      "Use 3–24 letters, numbers, dots or underscores.",
    );
    const displayName = inputString(body.displayName, "Display name", {
      min: 2,
      max: 80,
    });
    assert(
      typeof body.password === "string" &&
        body.password.length >= 12 &&
        body.password.length <= 256,
      400,
      "weak_password",
      "Use a password with at least 12 characters.",
    );
    assert(
      !await q("SELECT 1 ok FROM users WHERE eco_id=?", ecoId),
      409,
      "eco_id_taken",
      "That EcoVibes ID is already in use.",
    );
    const userId = id(),
      salt = randomBytes(16).toString("hex");
    await run(
      "INSERT INTO users(id,eco_id,display_name,password_salt,password_hash,created_at) VALUES(?,?,?,?,?,?)",
      userId,
      ecoId,
      displayName,
      salt,
      passwordHash(body.password, salt),
      now(),
    );
    await run(
      "INSERT INTO roles(user_id,role,created_at) VALUES(?,?,?)",
      userId,
      "customer",
      now(),
    );
    ctx.user = await safeUser(userId);
    await session(ctx, res, req);
    return { user: ctx.user, csrfToken: ctx.csrfToken };
  }
  if (method === "POST" && path === "/auth/login") {
    rateLimit(`login:${req.socket.remoteAddress}`, 12, 15 * 60_000);
    const ecoId = inputString(body.ecoId, "EcoVibes ID", { min: 3, max: 30 })
      .replace(/^@/, "")
      .toLowerCase();
    assert(
      typeof body.password === "string" && body.password.length <= 256,
      400,
      "invalid_password",
      "Password is invalid.",
    );
    const user = await q("SELECT * FROM users WHERE eco_id=? COLLATE NOCASE", ecoId);
    const candidate = user
      ? passwordHash(body.password, user.password_salt)
      : passwordHash(body.password, "00000000000000000000000000000000");
    assert(
      user &&
        timingSafeEqual(
          Buffer.from(candidate, "hex"),
          Buffer.from(user.password_hash, "hex"),
        ) &&
        user.status === "active",
      401,
      "invalid_login",
      "EcoVibes ID or password is incorrect.",
    );
    ctx.user = await safeUser(user.id);
    await session(ctx, res, req);
    return { user: ctx.user, csrfToken: ctx.csrfToken };
  }
  if (method === "GET" && path === "/auth/me")
    return { user: ctx.user, csrfToken: ctx.csrfToken || null };
  if (method === "GET" && path === "/auth/supabase/me") {
    rateLimit(`supabase-auth:${req.socket.remoteAddress}`, 60, 60_000);
    const result = await authenticateSupabaseRequest(req);
    if (result.error) {
      fault(
        result.error.status || 401,
        result.error.code || "supabase_auth_failed",
        result.error.message || "Supabase authentication failed.",
      );
    }
    return {
      provider: "supabase",
      user: {
        id: result.user.id,
        email: result.user.email || null,
        emailConfirmedAt: result.user.email_confirmed_at || null,
      },
    };
  }
  if (method === "POST" && path === "/auth/supabase/session") {
    rateLimit(`supabase-session:${req.socket.remoteAddress}`, 12, 15 * 60_000);
    const result = await authenticateSupabaseRequest(req);
    if (result.error) {
      fault(
        result.error.status || 401,
        result.error.code || "supabase_auth_failed",
        result.error.message || "Supabase authentication failed.",
      );
    }

    let userId;
    let created = false;
    let linked = false;
    await transaction(async () => {
      let identity = await q(
        "SELECT user_id FROM supabase_identities WHERE supabase_user_id=?",
        result.user.id,
      );
      if (identity) {
        assert(
          !ctx.user || ctx.user.id === identity.user_id,
          409,
          "identity_already_linked",
          "This Supabase identity is linked to another EcoVibes ID. Sign out of the current EcoVibes ID first.",
        );
        userId = identity.user_id;
        return;
      }

      if (ctx.user) {
        userId = ctx.user.id;
        await run(
          "INSERT INTO supabase_identities(supabase_user_id,user_id,created_at) VALUES(?,?,?)",
          result.user.id,
          userId,
          now(),
        );
        linked = true;
        return;
      }

      const user = result.user;
      const email = typeof user.email === "string" ? user.email : "";
      const metadataName = typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : "";
      const displayName = (metadataName.trim().replace(/\s+/g, " ").slice(0, 80) || email.split("@")[0]?.slice(0, 80) || "EcoVibes member");
      const suffix = hash(user.id).slice(0, 12);
      let ecoId = `member.${suffix}`;
      let collision = 1;
      while (await q("SELECT 1 ok FROM users WHERE eco_id=?", ecoId)) {
        ecoId = `member.${suffix}.${collision++}`;
      }
      userId = id();
      const salt = randomBytes(16).toString("hex");
      await run(
        "INSERT INTO users(id,eco_id,display_name,password_salt,password_hash,created_at) VALUES(?,?,?,?,?,?)",
        userId,
        ecoId,
        displayName,
        salt,
        passwordHash(randomBytes(48).toString("hex"), salt),
        now(),
      );
      await run(
        "INSERT INTO roles(user_id,role,created_at) VALUES(?,?,?)",
        userId,
        "customer",
        now(),
      );
      await run(
        "INSERT INTO supabase_identities(supabase_user_id,user_id,created_at) VALUES(?,?,?)",
        user.id,
        userId,
        now(),
      );
      created = true;
    });

    ctx.user = await safeUser(userId);
    await session(ctx, res, req);
    return {
      user: ctx.user,
      csrfToken: ctx.csrfToken,
      created,
      linked,
    };
  }
  if (method === "GET" && path === "/media/status")
    return { configured: liveKitConfigured, serverUrl: liveKitConfigured ? liveKitClientUrl : null };
  assert(
    ctx.user,
    401,
    "sign_in_required",
    "Sign in with your EcoVibes ID to continue.",
  );
  if (method === "POST" && path === "/auth/logout") {
    await run("DELETE FROM sessions WHERE user_id=?", ctx.user.id);
    setCookie(res, "ev_session", "", {
      httpOnly: true,
      secure: isProduction,
      maxAge: 0,
    });
    return { ok: true };
  }
  if (method === "POST" && path === "/identity/roles") {
    const role = body.role;
    assert(
      ["seller", "provider"].includes(role),
      400,
      "invalid_role",
      "Choose seller or provider.",
    );
    if (!await hasRole(ctx.user.id, role))
      await run(
        "INSERT INTO roles(user_id,role,created_at) VALUES(?,?,?)",
        ctx.user.id,
        role,
        now(),
      );
    if (role === "seller")
      await run(
        "INSERT OR IGNORE INTO seller_profiles(user_id,created_at) VALUES(?,?)",
        ctx.user.id,
        now(),
      );
    if (role === "provider")
      await run(
        "INSERT OR IGNORE INTO provider_profiles(user_id,created_at) VALUES(?,?)",
        ctx.user.id,
        now(),
      );
    await event(ctx.user.id, "identity", ctx.user.id, "ROLE_ADDED", { role });
    ctx.user = await safeUser(ctx.user.id);
    return { user: ctx.user };
  }
  if (method === "PATCH" && path === "/identity/profiles") {
    const profile = body.profile;
    assert(
      profile === "seller" || profile === "provider",
      400,
      "invalid_profile",
      "Choose a valid profile.",
    );
    const table =
      profile === "seller" ? "seller_profiles" : "provider_profiles";
    const exists = await q(`SELECT 1 ok FROM ${table} WHERE user_id=?`, ctx.user.id);
    assert(exists, 403, "role_required", `Enable your ${profile} role first.`);
    if (profile === "seller")
      await run(
        "UPDATE seller_profiles SET business_name=?,location=? WHERE user_id=?",
        inputString(
          body.businessName || ctx.user.display_name,
          "Business name",
          { max: 90 },
        ),
        inputString(body.location || "Ghana", "Location", { max: 120 }),
        ctx.user.id,
      );
    else
      await run(
        "UPDATE provider_profiles SET provider_type=?,business_name=?,service_area=? WHERE user_id=?",
        ["individual", "business", "company", "team"].includes(
          body.providerType,
        )
          ? body.providerType
          : "individual",
        inputString(
          body.businessName || ctx.user.display_name,
          "Provider name",
          { max: 90 },
        ),
        inputString(body.serviceArea || "Accra", "Service area", { max: 120 }),
        ctx.user.id,
      );
    return { ok: true };
  }
  if (method === "POST" && path === "/trust/verifications") {
    assert(
      await hasRole(ctx.user.id, "seller") || await hasRole(ctx.user.id, "provider"),
      403,
      "role_required",
      "Add a seller or provider role before requesting verification.",
    );
    const businessType = inputString(
      body.businessType || "individual",
      "Business type",
      { max: 60 },
    );
    const evidence = inputString(body.evidenceNote, "Verification note", {
      min: 10,
      max: 500,
    });
    const requestId = id();
    await run(
      "INSERT INTO verification_requests(id,user_id,business_type,evidence_note,created_at) VALUES(?,?,?,?,?)",
      requestId,
      ctx.user.id,
      businessType,
      evidence,
      now(),
    );
    await notify(
      ctx.user.id,
      "verification",
      "Verification submitted",
      "Your request is pending review.",
      "verification",
      requestId,
    );
    await event(ctx.user.id, "verification", requestId, "VERIFICATION_REQUESTED");
    return { id: requestId, status: "pending" };
  }
  if (method === "GET" && path === "/trust/verifications")
    return await all(
      "SELECT id,business_type,status,created_at FROM verification_requests WHERE user_id=? ORDER BY created_at DESC",
      ctx.user.id,
    );
  if (method === "POST" && path === "/support/reports") {
    const targetType = inputString(body.targetType, "Target type", { max: 30 });
    const targetId = inputString(body.targetId, "Target ID", { max: 100 });
    const reason = inputString(body.reason, "Reason", { max: 100 });
    const details = inputString(body.details, "Details", {
      min: 10,
      max: 1000,
    });
    const reportId = id();
    await run(
      "INSERT INTO support_reports(id,reporter_id,target_type,target_id,reason,details,created_at) VALUES(?,?,?,?,?,?,?)",
      reportId,
      ctx.user.id,
      targetType,
      targetId,
      reason,
      details,
      now(),
    );
    await event(ctx.user.id, "support_report", reportId, "REPORT_CREATED", {
      targetType,
      targetId,
      reason,
    });
    return { id: reportId, status: "open" };
  }
  const assetMatch = path.match(/^\/social\/assets\/([a-f0-9-]+)$/);
  if (method === "GET" && assetMatch) {
    const imagePath = `/social/assets/${assetMatch[1]}`;
    const viewerId = ctx.user?.id || "";
    const asset = await q("SELECT a.* FROM media_assets a WHERE a.id=? AND (EXISTS (SELECT 1 FROM stories s WHERE s.asset_id=a.id AND s.expires_at>? AND (s.visibility='public' OR s.author_id=? OR EXISTS (SELECT 1 FROM people_follows f WHERE f.user_id=? AND f.target_user_id=s.author_id))) OR EXISTS (SELECT 1 FROM reels r WHERE r.asset_id=a.id AND r.status='active') OR EXISTS (SELECT 1 FROM products p WHERE p.image_url=? AND p.status='active'))", assetMatch[1], now(), viewerId, viewerId, imagePath);
    assert(asset, 404, "asset_not_found", "Media is no longer available.");
    const file = await loadMediaAsset(asset.id);
    res.statusCode = 200; res.setHeader("Content-Type", asset.mime_type); res.setHeader("Content-Length", file.length); res.setHeader("Cache-Control", "private, no-store"); res.end(file);
    return { __sent: true };
  }
  if (method === "DELETE" && assetMatch) {
    const asset = await q("SELECT * FROM media_assets WHERE id=? AND owner_id=?", assetMatch[1], ctx.user.id);
    assert(asset, 404, "asset_not_found", "Media asset not found.");
    const references = await q("SELECT (EXISTS(SELECT 1 FROM stories WHERE asset_id=?) OR EXISTS(SELECT 1 FROM reels WHERE asset_id=?) OR EXISTS(SELECT 1 FROM products WHERE image_url=? AND status!='removed')) AS used", asset.id, asset.id, `/social/assets/${asset.id}`);
    assert(!references?.used, 409, "media_in_use", "Remove the media from its listing or post before deleting it.");
    await run("DELETE FROM media_assets WHERE id=? AND owner_id=?", asset.id, ctx.user.id);
    await removeMediaAsset(asset.id);
    return { deleted: true };
  }
  if (method === "POST" && path === "/social/assets") {
    const mime = body.mimeType;
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]);
    assert(allowed.has(mime), 400, "unsupported_media_type", "Upload a JPG, PNG, WebP, MP4, or WebM file.");
    assert(typeof body.data === "string" && body.data.length <= 19_000_000, 413, "media_too_large", "Media uploads must be 14 MB or smaller.");
    const bytes = Buffer.from(body.data, "base64");
    assert(bytes.length > 0 && bytes.length <= 14 * 1024 * 1024, 413, "media_too_large", "Media uploads must be 14 MB or smaller.");
    const signatureOk = mime === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff : mime === "image/png" ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : mime === "image/webp" ? bytes.toString("ascii",0,4)==="RIFF" && bytes.toString("ascii",8,12)==="WEBP" : mime === "video/mp4" ? bytes.toString("ascii",4,8)==="ftyp" : bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
    assert(signatureOk, 400, "invalid_media_file", "The uploaded file content does not match its media type.");
    const assetId = id();
    await storeMediaAsset(assetId, bytes, mime);
    try { await run("INSERT INTO media_assets(id,owner_id,mime_type,byte_size,created_at) VALUES(?,?,?,?,?)", assetId, ctx.user.id, mime, bytes.length, now()); }
    catch (error) { await removeMediaAsset(assetId); throw error; }
    return { id: assetId, url: `/api/v1/social/assets/${assetId}`, mimeType: mime, byteSize: bytes.length };
  }
  if (method === "POST" && path === "/people/presence") {
    await run("INSERT INTO people_presence(user_id,last_seen_at) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET last_seen_at=excluded.last_seen_at", ctx.user.id, now());
    return { ok: true };
  }
  if (method === "GET" && path === "/people/discover") {
    const rows = await all("SELECT u.id,u.eco_id,u.display_name,p.last_seen_at,(SELECT COUNT(*) FROM people_follows f1 JOIN people_follows f2 ON f1.target_user_id=f2.target_user_id WHERE f1.user_id=? AND f2.user_id=u.id) mutual_count,EXISTS(SELECT 1 FROM people_follows f WHERE f.user_id=? AND f.target_user_id=u.id) followed,(SELECT MAX(s.created_at) FROM stories s WHERE s.author_id=u.id AND s.expires_at>?) story_at,(SELECT MAX(r.created_at) FROM reels r WHERE r.author_id=u.id AND r.status='active') reel_at FROM users u LEFT JOIN people_presence p ON p.user_id=u.id WHERE u.id!=? AND u.status='active' LIMIT 300", ctx.user.id, ctx.user.id, now(), ctx.user.id);
    const stamp=Date.now();
    const people=rows.filter(person=>!person.followed).map(person=>{const age=person.last_seen_at?stamp-Date.parse(person.last_seen_at):Infinity;let score=0;const reasons=[];if(age<5*60_000){score+=40;reasons.push("Active now");}else if(age<60*60_000){score+=22;reasons.push("Recently active");}else if(age<24*60*60_000){score+=8;reasons.push("Active today");}const mutual=Number(person.mutual_count||0);if(mutual){score+=Math.min(24,mutual*6);reasons.push(`${mutual} shared connection${mutual===1?'':'s'}`);}const storyAge=person.story_at?stamp-Date.parse(person.story_at):Infinity;if(storyAge<24*60*60_000){score+=16;reasons.push("Posted a Story");}const reelAge=person.reel_at?stamp-Date.parse(person.reel_at):Infinity;if(reelAge<7*24*60*60_000){score+=Math.max(2,Math.round(14*(1-reelAge/(7*24*60*60_000))));reasons.push("Shared a Reel");}score+=parseInt(hash(`${ctx.user.id}:${person.id}`).slice(0,2),16)/255;const { last_seen_at: _lastSeen, ...publicPerson }=person;return {...publicPerson,mutual_count:mutual,active:age<5*60_000,score:Math.round(score),reasons};}).sort((a,b)=>b.score-a.score).slice(0,20);
    return { people, algorithm: "recency + shared follows + active Stories/Reels; online state expires after five minutes" };
  }
  let followMatch=path.match(/^\/people\/([a-f0-9-]+)\/follow$/);
  if (method === "POST" && followMatch) {
    const target=await q("SELECT id FROM users WHERE id=? AND status='active'",followMatch[1]);assert(target&&target.id!==ctx.user.id,404,"person_not_found","Person not found.");const existing=await q("SELECT 1 ok FROM people_follows WHERE user_id=? AND target_user_id=?",ctx.user.id,target.id);if(existing)await run("DELETE FROM people_follows WHERE user_id=? AND target_user_id=?",ctx.user.id,target.id);else await run("INSERT INTO people_follows(user_id,target_user_id,created_at) VALUES(?,?,?)",ctx.user.id,target.id,now());return {followed:!existing};
  }
  if (method === "GET" && path === "/stories") {
    const stories=await all("SELECT s.id,s.author_id,s.text,s.asset_id,s.visibility,s.created_at,s.expires_at,u.eco_id,u.display_name,EXISTS(SELECT 1 FROM people_follows f WHERE f.user_id=? AND f.target_user_id=s.author_id) is_following,(SELECT COUNT(*) FROM story_views v WHERE v.story_id=s.id) view_count,EXISTS(SELECT 1 FROM story_views v WHERE v.story_id=s.id AND v.viewer_id=?) viewed FROM stories s JOIN users u ON u.id=s.author_id WHERE s.expires_at>? AND (s.visibility='public' OR s.author_id=? OR EXISTS(SELECT 1 FROM people_follows f WHERE f.user_id=? AND f.target_user_id=s.author_id)) ORDER BY CASE WHEN s.author_id=? THEN 0 ELSE 1 END,s.created_at DESC LIMIT 100",ctx.user.id,ctx.user.id,now(),ctx.user.id,ctx.user.id,ctx.user.id);
    return {stories};
  }
  if (method === "POST" && path === "/stories") {
    const text=inputString(body.text||"","Story status",{min:0,max:500,optional:true});const assetId=body.assetId?inputString(body.assetId,"Media asset ID",{max:64}):null;assert(text||assetId,400,"empty_story","Write a status or add a photo.");if(assetId)assert(await q("SELECT 1 ok FROM media_assets WHERE id=? AND owner_id=?",assetId,ctx.user.id),404,"media_not_found","Upload your media before posting.");const visibility=body.visibility==="followers"?"followers":"public";const storyId=id(),created=now(),expires=new Date(Date.now()+24*60*60_000).toISOString();await run("INSERT INTO stories(id,author_id,text,asset_id,visibility,created_at,expires_at) VALUES(?,?,?,?,?,?,?)",storyId,ctx.user.id,text,assetId,visibility,created,expires);await event(ctx.user.id,"story",storyId,"STORY_POSTED",{hasMedia:Boolean(assetId),visibility});return {id:storyId,expiresAt:expires};
  }
  let storyMatch=path.match(/^\/stories\/([a-f0-9-]+)\/view$/);
  if (method === "POST" && storyMatch) {const story=await q("SELECT id FROM stories WHERE id=? AND expires_at>?",storyMatch[1],now());assert(story,404,"story_expired","This Story has expired.");await run("INSERT INTO story_views(story_id,viewer_id,viewed_at) VALUES(?,?,?) ON CONFLICT(story_id,viewer_id) DO UPDATE SET viewed_at=excluded.viewed_at",story.id,ctx.user.id,now());return {ok:true};}
  if (method === "GET" && path === "/reels") {
    const rows=await all("SELECT r.id,r.author_id,r.caption,r.asset_id,r.created_at,u.eco_id,u.display_name,EXISTS(SELECT 1 FROM people_follows f WHERE f.user_id=? AND f.target_user_id=r.author_id) is_following,(SELECT COUNT(*) FROM reel_views v WHERE v.reel_id=r.id) view_count,(SELECT COUNT(*) FROM reel_likes l WHERE l.reel_id=r.id) like_count,EXISTS(SELECT 1 FROM reel_views v WHERE v.reel_id=r.id AND v.viewer_id=?) viewed,EXISTS(SELECT 1 FROM reel_likes l WHERE l.reel_id=r.id AND l.user_id=?) liked FROM reels r JOIN users u ON u.id=r.author_id WHERE r.status='active' ORDER BY r.created_at DESC LIMIT 100",ctx.user.id,ctx.user.id,ctx.user.id);
    const stamp=Date.now();const reels=rows.map(reel=>{const age=Math.max(0,stamp-Date.parse(reel.created_at));const freshness=Math.max(0,28-28*age/(14*24*60*60_000));const popularity=Math.min(24,Math.log2(Number(reel.like_count)+1)*5+Math.log2(Number(reel.view_count)+1)*2);const affinity=reel.is_following?18:0;const unseen=reel.viewed? -35:12;return {...reel,score:Math.round(freshness+popularity+affinity+unseen)};}).sort((a,b)=>b.score-a.score);
    return {reels,algorithm:"freshness + watch/like signals + followed creators; recently watched Reels are down-ranked"};
  }
  if (method === "POST" && path === "/reels") {
    const assetId=inputString(body.assetId,"Video asset ID",{max:64});const asset=await q("SELECT id,mime_type FROM media_assets WHERE id=? AND owner_id=?",assetId,ctx.user.id);assert(asset&&asset.mime_type.startsWith("video/"),400,"video_required","Upload a video before posting a Reel.");const caption=inputString(body.caption||"","Caption",{max:500,optional:true});const reelId=id();await run("INSERT INTO reels(id,author_id,caption,asset_id,created_at) VALUES(?,?,?,?,?)",reelId,ctx.user.id,caption,assetId,now());await event(ctx.user.id,"reel",reelId,"REEL_POSTED",{assetId});return {id:reelId};
  }
  let reelMatch=path.match(/^\/reels\/([a-f0-9-]+)\/(view|like)$/);
  if (method === "POST" && reelMatch) {const reel=await q("SELECT id FROM reels WHERE id=? AND status='active'",reelMatch[1]);assert(reel,404,"reel_not_found","Reel not found.");if(reelMatch[2]==="view"){await run("INSERT INTO reel_views(reel_id,viewer_id,viewed_at) VALUES(?,?,?) ON CONFLICT(reel_id,viewer_id) DO UPDATE SET viewed_at=excluded.viewed_at",reel.id,ctx.user.id,now());return {ok:true};}const liked=await q("SELECT 1 ok FROM reel_likes WHERE reel_id=? AND user_id=?",reel.id,ctx.user.id);if(liked)await run("DELETE FROM reel_likes WHERE reel_id=? AND user_id=?",reel.id,ctx.user.id);else await run("INSERT INTO reel_likes(reel_id,user_id,created_at) VALUES(?,?,?)",reel.id,ctx.user.id,now());return {liked:!liked};}
  if (path.startsWith("/media/") && path !== "/media/webhook" && path !== "/media/status")
    assert(ctx.user, 401, "authentication_required", "Sign in to use live audio and video.");
  if (method === "GET" && path === "/media/sessions") {
    const mine = await all("SELECT ms.id,ms.mode,ms.title,ms.visibility,ms.status,ms.created_at,u.eco_id creator_eco_id,u.display_name creator_name, m.role FROM media_sessions ms JOIN users u ON u.id=ms.creator_id LEFT JOIN media_session_members m ON m.session_id=ms.id AND m.user_id=? WHERE ms.status='active' AND (ms.visibility='public' OR ms.creator_id=? OR m.user_id IS NOT NULL) ORDER BY CASE WHEN ms.creator_id=? THEN 0 ELSE 1 END,ms.created_at DESC LIMIT 100", ctx.user.id, ctx.user.id, ctx.user.id);
    return { sessions: mine, configured: liveKitConfigured };
  }
  let mediaMatch = path.match(/^\/media\/sessions\/([a-f0-9-]+)\/(join|end|ingress)$/);
  if (method === "POST" && path === "/media/sessions") {
    requireLiveKit(); rateLimit(`media-create:${ctx.user.id}`, 10, 60_000);
    const mode = body.mode;
    assert(["voice", "video", "live"].includes(mode), 400, "invalid_mode", "Choose voice, video, or live.");
    const visibility = body.visibility === "public" && mode === "live" ? "public" : "private";
    const title = inputString(body.title || (mode === "live" ? "Live on EcoVibes" : "EcoVibes call"), "Title", { max: 100 });
    const sessionId = id(); const roomName = `ev-${sessionId}`;
    const mediaRoom = await liveKit.room.createRoom({ name: roomName, emptyTimeout: 300, maxParticipants: mode === "live" ? 500 : 16, metadata: JSON.stringify({ sessionId, mode }) });
    try {
      await transaction(async () => {
        await run("INSERT INTO media_sessions(id,room_name,creator_id,mode,title,visibility,status,created_at) VALUES(?,?,?,?,?,?,?,?)", sessionId, mediaRoom.name, ctx.user.id, mode, title, visibility, "active", now());
        await run("INSERT INTO media_session_members(session_id,user_id,role,joined_at) VALUES(?,?,?,?)", sessionId, ctx.user.id, mode === "live" ? "host" : "host", now());
        const invitees = Array.isArray(body.invitees) ? body.invitees.slice(0, 15) : [];
        for (const ecoId of invitees) {
          const invitee = await q("SELECT id FROM users WHERE eco_id=?", inputString(ecoId, "Invitee EcoVibes ID", { min: 3, max: 24 }).replace(/^@/, "").toLowerCase());
          if (!invitee || invitee.id === ctx.user.id) continue;
          await run("INSERT OR IGNORE INTO media_session_members(session_id,user_id,role) VALUES(?,?,?)", sessionId, invitee.id, "invited");
          await notify(invitee.id, "media_invite", mode === "live" ? "EcoVibes live invitation" : "EcoVibes call invitation", `${ctx.user.display_name} invited you to ${title}.`, "media_session", sessionId);
        }
        await event(ctx.user.id, "media_session", sessionId, "MEDIA_SESSION_CREATED", { mode, visibility });
      });
    } catch (error) { await liveKit.room.deleteRoom(roomName).catch(() => undefined); throw error; }
    return { id: sessionId, mode, title, visibility, status: "active" };
  }
  if (method === "POST" && mediaMatch && mediaMatch[2] === "join") {
    requireLiveKit(); rateLimit(`media-join:${ctx.user.id}`, 30, 60_000);
    const media = await q("SELECT * FROM media_sessions WHERE id=? AND status='active'", mediaMatch[1]);
    assert(media, 404, "media_session_not_found", "This room is no longer available.");
    let member = await q("SELECT role FROM media_session_members WHERE session_id=? AND user_id=?", media.id, ctx.user.id);
    if (!member && media.visibility === "public" && media.mode === "live") {
      await run("INSERT OR IGNORE INTO media_session_members(session_id,user_id,role,joined_at) VALUES(?,?,?,?)", media.id, ctx.user.id, "viewer", now());
      member = { role: "viewer" };
    }
    assert(member, 403, "media_invite_required", "This is a private room. Ask the host to invite your EcoVibes ID.");
    if (member.role === "invited") {
      await run("UPDATE media_session_members SET role='participant',joined_at=? WHERE session_id=? AND user_id=?", now(), media.id, ctx.user.id);
      member.role = "participant";
    }
    const canPublish = member.role === "host" || member.role === "participant";
    const access = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity: ctx.user.id, name: ctx.user.display_name, ttl: "1h", metadata: JSON.stringify({ ecoId: ctx.user.eco_id, mode: media.mode, role: member.role }) });
    access.addGrant({ roomJoin: true, room: media.room_name, canPublish, canSubscribe: true, canPublishData: true });
    return { token: await access.toJwt(), serverUrl: liveKitClientUrl, session: { id: media.id, mode: media.mode, title: media.title, role: member.role, canPublish } };
  }
  if (method === "POST" && mediaMatch && mediaMatch[2] === "end") {
    const media = await q("SELECT * FROM media_sessions WHERE id=? AND status='active'", mediaMatch[1]);
    assert(media, 404, "media_session_not_found", "This room is no longer active.");
    assert(media.creator_id === ctx.user.id, 403, "media_host_required", "Only the room host can end this room.");
    await liveKit?.room.deleteRoom(media.room_name).catch(() => undefined);
    await run("UPDATE media_sessions SET status='ended',ended_at=? WHERE id=?", now(), media.id);
    await event(ctx.user.id, "media_session", media.id, "MEDIA_SESSION_ENDED");
    return { id: media.id, status: "ended" };
  }
  if (method === "POST" && mediaMatch && mediaMatch[2] === "ingress") {
    requireLiveKit();
    const media = await q("SELECT * FROM media_sessions WHERE id=? AND status='active' AND creator_id=? AND mode='live'", mediaMatch[1], ctx.user.id);
    assert(media, 404, "media_session_not_found", "Live room not found.");
    const ingress = new IngressClient(liveKitHost, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
    const info = await ingress.createIngress(IngressInput.RTMP_INPUT, { name: `${media.title} · ${ctx.user.eco_id}`, roomName: media.room_name, participantIdentity: `stream-${media.id}`, participantName: `${ctx.user.display_name} stream`, });
    return { url: info.url, streamKey: info.streamKey };
  }
  if (method === "GET" && path === "/notifications")
    return await all(
      "SELECT id,type,title,body,target_type,target_id,read_at,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
      ctx.user.id,
    );
  let match = path.match(/^\/notifications\/([a-f0-9-]+)\/read$/);
  if (method === "POST" && match) {
    const result = await run(
      "UPDATE notifications SET read_at=? WHERE id=? AND user_id=?",
      now(),
      match[1],
      ctx.user.id,
    );
    assert(result.changes === 1, 404, "not_found", "Notification not found.");
    return { ok: true };
  }
  if (method === "GET" && path === "/staff/review/verifications") {
    requireStaff(ctx, "trust_staff");
    return await all(
      "SELECT v.id,v.business_type,v.evidence_note,v.status,v.created_at,u.eco_id,u.display_name FROM verification_requests v JOIN users u ON u.id=v.user_id WHERE v.status='pending' ORDER BY v.created_at ASC LIMIT 100",
    );
  }
  if (method === "GET" && path === "/staff/review/reports") {
    requireStaff(ctx, "support_staff");
    return await all(
      "SELECT r.id,r.target_type,r.target_id,r.reason,r.details,r.status,r.created_at,u.eco_id reporter_eco_id,u.display_name reporter_name FROM support_reports r JOIN users u ON u.id=r.reporter_id WHERE r.status!='resolved' ORDER BY r.created_at ASC LIMIT 100",
    );
  }
  if (method === "GET" && path === "/staff/review/refunds") {
    requireStaff(ctx, "support_staff");
    return await all("SELECT r.id,r.order_id,r.amount_minor,r.reason,r.status,r.created_at,u.eco_id requester_eco_id,o.payment_status FROM refunds r JOIN users u ON u.id=r.requester_id JOIN orders o ON o.id=r.order_id WHERE r.status IN ('requested','approved','provider_pending') ORDER BY r.created_at ASC LIMIT 100");
  }
  match = path.match(/^\/staff\/review\/verifications\/([a-f0-9-]+)$/);
  if (method === "PATCH" && match) {
    requireStaff(ctx, "trust_staff");
    assert(["approved", "rejected"].includes(body.status), 400, "invalid_review", "Choose approved or rejected.");
    const note = inputString(body.note, "Review note", { min: 10, max: 600 });
    const request = await q("SELECT * FROM verification_requests WHERE id=? AND status='pending'", match[1]);
    assert(request, 404, "not_found", "Pending verification request not found.");
    const updated = await run(
      "UPDATE verification_requests SET status=?,reviewer_id=?,review_note=?,reviewed_at=? WHERE id=? AND status='pending'",
      body.status, ctx.user.id, note, now(), request.id,
    );
    assert(updated.changes === 1, 409, "already_reviewed", "This request was already reviewed.");
    const applicantRoles = await all("SELECT role FROM roles WHERE user_id=?", request.user_id);
    if (applicantRoles.some((item) => item.role === "seller"))
      await run("UPDATE seller_profiles SET verification_state=? WHERE user_id=?", body.status, request.user_id);
    if (applicantRoles.some((item) => item.role === "provider"))
      await run("UPDATE provider_profiles SET verification_state=? WHERE user_id=?", body.status, request.user_id);
    await run("INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,reason,created_at) VALUES(?,?,?,?,?,?,?)", id(), ctx.user.id, `VERIFICATION_${body.status.toUpperCase()}`, "verification", request.id, note, now());
    await notify(request.user_id, "verification", `Verification ${body.status}`, note, "verification", request.id);
    return { id: request.id, status: body.status };
  }
  match = path.match(/^\/staff\/review\/reports\/([a-f0-9-]+)$/);
  if (method === "PATCH" && match) {
    requireStaff(ctx, "support_staff");
    assert(["reviewing", "resolved"].includes(body.status), 400, "invalid_review", "Choose reviewing or resolved.");
    const note = inputString(body.note, "Resolution note", { min: 10, max: 800 });
    const updated = await run(
      "UPDATE support_reports SET status=?,reviewer_id=?,resolution_note=?,reviewed_at=? WHERE id=? AND status IN ('open','reviewing')",
      body.status, ctx.user.id, note, now(), match[1],
    );
    assert(updated.changes === 1, 404, "not_found", "Open support report not found.");
    await run("INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,reason,created_at) VALUES(?,?,?,?,?,?,?)", id(), ctx.user.id, `REPORT_${body.status.toUpperCase()}`, "support_report", match[1], note, now());
    return { id: match[1], status: body.status };
  }
  match = path.match(/^\/staff\/review\/refunds\/([a-f0-9-]+)$/);
  if (method === "PATCH" && match) {
    requireStaff(ctx, "support_staff");
    assert(["approved", "rejected"].includes(body.status), 400, "invalid_review", "Choose approved or rejected.");
    const note = inputString(body.note, "Review note", { min: 10, max: 800 });
    const refund = await q("SELECT * FROM refunds WHERE id=? AND status='requested'", match[1]);
    assert(refund, 404, "not_found", "Requested refund not found.");
    const payment = await q("SELECT * FROM payments WHERE order_id=? AND provider='paystack' AND state='paid' ORDER BY created_at DESC LIMIT 1", refund.order_id);
    assert(body.status === "rejected" || (payment && (process.env.PAYSTACK_SECRET_KEY || "").startsWith("sk_test_")), 409, "payment_not_refundable", "No paid Paystack test transaction is available to refund.");
    const claimed = await run("UPDATE refunds SET status=?,reviewer_id=?,review_note=?,reviewed_at=? WHERE id=? AND status='requested'", body.status === "approved" ? "approved" : "rejected", ctx.user.id, note, now(), refund.id);
    assert(claimed.changes === 1, 409, "already_reviewed", "This refund was already reviewed.");
    if (body.status === "rejected") {
      await notify(refund.requester_id, "refund", "Refund request reviewed", note, "order", refund.order_id);
    } else {
      const response = await fetch("https://api.paystack.co/refund", { method: "POST", headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ transaction: payment.provider_reference, amount: refund.amount_minor, currency: "GHS", customer_note: refund.reason, merchant_note: note }) });
      const result = await response.json();
      if (!response.ok || !result.status) {
        await run("UPDATE refunds SET status='requested',reviewer_id=NULL,review_note=NULL,reviewed_at=NULL WHERE id=? AND status='approved'", refund.id);
        fault(502, "refund_initialization_failed", "Paystack could not start this test refund.");
      }
      await run("UPDATE refunds SET status='provider_pending',provider_reference=? WHERE id=?", String(result.data?.refund_reference || result.data?.id || ""), refund.id);
    }
    await run("INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,reason,created_at) VALUES(?,?,?,?,?,?,?)", id(), ctx.user.id, `REFUND_${body.status.toUpperCase()}`, "refund", refund.id, note, now());
    return { id: refund.id, status: body.status === "approved" ? "provider_pending" : "rejected" };
  }
  if (method === "GET" && path === "/marketplace/products") {
    await expireUnpaidOrders();
    const qtext = String(query.get("q") || "")
      .trim()
      .slice(0, 100);
    const category = String(query.get("category") || "").slice(0, 80);
    const mine = query.get("mine") === "1";
    if (mine) await requireRole(ctx, "seller");
    const rows = mine
      ? await all(
          "SELECT p.*,u.eco_id seller_eco_id FROM products p JOIN users u ON u.id=p.seller_id WHERE p.seller_id=? AND p.status!='removed' AND (?='' OR p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ?) ORDER BY p.created_at DESC LIMIT 200",
          ctx.user.id,
          qtext,
          `%${qtext}%`,
          `%${qtext}%`,
          `%${qtext}%`,
        )
      : await all(
          `SELECT p.*,u.eco_id seller_eco_id,u.display_name seller_name FROM products p JOIN users u ON u.id=p.seller_id WHERE p.status='active' AND p.fulfillment_type!='external_checkout' AND (?='' OR p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ?) AND (?='' OR p.category=?) ORDER BY p.created_at DESC LIMIT 100`,
          qtext,
          `%${qtext}%`,
          `%${qtext}%`,
          `%${qtext}%`,
          category,
          category,
        );
    return mine
      ? rows.map(rowProduct)
      : rows.map((row) => publicProduct(row, ctx));
  }
  if (method === "POST" && path === "/marketplace/products") {
    await requireRole(ctx, "seller");
    const name = inputString(body.name, "Product name", { max: 100 });
    const description = inputString(body.description || "", "Description", {
      max: 3000,
      optional: true,
    });
    const category = inputString(body.category, "Category", { max: 80 });
    const price = validMinor(body.priceMinor, "Price");
    const cost =
      body.costMinor === undefined || body.costMinor === null
        ? null
        : validMinor(body.costMinor, "Cost", { allowZero: true });
    const stock = validMinor(body.stock ?? 0, "Stock", { allowZero: true });
    const fulfillment = body.fulfillmentType || "own_inventory";
    assert(
      [
        "own_inventory",
        "supplier_fulfilled",
        "dropship",
        "external_checkout",
      ].includes(fulfillment),
      400,
      "invalid_fulfillment",
      "Choose a supported fulfillment type.",
    );
    assert(
      fulfillment !== "external_checkout",
      400,
      "external_product",
      "External checkout products must use a referral link and are not orderable here.",
    );
    const type = body.productType || "physical";
    assert(
      ["physical", "digital", "service"].includes(type),
      400,
      "invalid_product_type",
      "Choose a supported product type.",
    );
    let imageUrl = null;
    if (body.imageUrl) {
      const imageMatch = String(body.imageUrl).match(/^\/social\/assets\/([a-f0-9-]+)$/);
      assert(imageMatch, 400, "invalid_product_image", "Choose an EcoVibes image upload.");
      const ownedAsset = await q("SELECT id FROM media_assets WHERE id=? AND owner_id=?", imageMatch[1], ctx.user.id);
      assert(ownedAsset, 403, "product_image_owner_required", "Only your own uploaded image can be used for this listing.");
      imageUrl = `/social/assets/${ownedAsset.id}`;
    }
    const productId = id(),
      stamp = now();
    await run(
      "INSERT INTO products(id,seller_id,name,description,category,product_type,currency,price_minor,cost_minor,stock,variants_json,fulfillment_type,supplier_name,shipping_info,location,image_url,source_type,source_url,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      productId,
      ctx.user.id,
      name,
      description,
      category,
      type,
      "GHS",
      price,
      cost,
      stock,
      JSON.stringify(
        Array.isArray(body.variants) ? body.variants.slice(0, 50) : [],
      ),
      fulfillment,
      String(body.supplierName || "").slice(0, 120),
      String(body.shippingInfo || "").slice(0, 200),
      String(body.location || "").slice(0, 120),
      imageUrl,
      "direct",
      null,
      stamp,
      stamp,
    );
    await event(ctx.user.id, "product", productId, "PRODUCT_CREATED", {
      name,
      category,
      fulfillment,
    });
    return rowProduct(await q("SELECT * FROM products WHERE id=?", productId), ctx.user.eco_id);
  }
  match = path.match(/^\/marketplace\/products\/([a-f0-9-]+)$/);
  if (method === "PATCH" && match) {
    const product = await q("SELECT * FROM products WHERE id=?", match[1]);
    assert(
      product && product.seller_id === ctx.user.id,
      404,
      "not_found",
      "Product not found.",
    );
    if (body.stock !== undefined)
      validMinor(body.stock, "Stock", { allowZero: true });
    if (body.priceMinor !== undefined) validMinor(body.priceMinor, "Price");
    if (body.stock !== undefined)
      await run(
        "UPDATE products SET stock=?,updated_at=? WHERE id=?",
        body.stock,
        now(),
        product.id,
      );
    if (body.priceMinor !== undefined)
      await run(
        "UPDATE products SET price_minor=?,updated_at=? WHERE id=?",
        body.priceMinor,
        now(),
        product.id,
      );
    if (body.status !== undefined) {
      assert(
        ["active", "paused", "removed"].includes(body.status),
        400,
        "invalid_status",
        "Invalid product status.",
      );
      await run(
        "UPDATE products SET status=?,updated_at=? WHERE id=?",
        body.status,
        now(),
        product.id,
      );
    }
    await event(ctx.user.id, "product", product.id, "PRODUCT_UPDATED", {
      stock: body.stock,
      priceMinor: body.priceMinor,
      status: body.status,
    });
    return rowProduct(await q("SELECT * FROM products WHERE id=?", product.id), ctx.user.eco_id);
  }
  if (method === "POST" && path === "/marketplace/products/import") {
    await requireRole(ctx, "seller");
    assert(
      Array.isArray(body.items) &&
        body.items.length > 0 &&
        body.items.length <= 200,
      400,
      "invalid_import",
      "Import between one and 200 products.",
    );
    return await transaction(async () => {
      const stamp = now(),
        created = [];
      for (const item of body.items) {
        const name = inputString(item.name, "Product name", { max: 100 });
        const category = inputString(item.category || "Other", "Category", {
          max: 80,
        });
        const price = validMinor(item.priceMinor, "Price");
        const stock = validMinor(item.stock ?? 0, "Stock", { allowZero: true });
        const productId = id();
        await run(
          "INSERT INTO products(id,seller_id,name,description,category,price_minor,cost_minor,stock,variants_json,fulfillment_type,supplier_name,shipping_info,location,source_type,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          productId,
          ctx.user.id,
          name,
          inputString(item.description || "", "Description", {
            max: 3000,
            optional: true,
          }),
          category,
          price,
          item.costMinor === undefined
            ? null
            : validMinor(item.costMinor, "Cost", { allowZero: true }),
          stock,
          JSON.stringify(
            Array.isArray(item.variants) ? item.variants.slice(0, 50) : [],
          ),
          ["own_inventory", "supplier_fulfilled", "dropship"].includes(
            item.fulfillmentType,
          )
            ? item.fulfillmentType
            : "own_inventory",
          String(item.supplierName || "").slice(0, 120),
          String(item.shippingInfo || "").slice(0, 200),
          String(item.location || "").slice(0, 120),
          "csv",
          stamp,
          stamp,
        );
        created.push(productId);
      }
      await event(ctx.user.id, "product_import", id(), "CSV_PRODUCTS_IMPORTED", {
        count: created.length,
        productIds: created,
      });
      return { imported: created.length };
    });
  }
  if (method === "GET" && path === "/marketplace/orders") {
    await expireUnpaidOrders();
    return await Promise.all((await all(
      `SELECT DISTINCT o.* FROM orders o LEFT JOIN fulfillment_groups g ON g.order_id=o.id WHERE o.buyer_id=? OR g.seller_id=? ORDER BY o.created_at DESC LIMIT 100`,
      ctx.user.id,
      ctx.user.id,
    )).map(async (order) => visibleOrder(await getOrder(order.id), ctx)));
  }
  if (method === "POST" && path === "/marketplace/orders") {
    await expireUnpaidOrders();
    assert(
      Array.isArray(body.items) &&
        body.items.length > 0 &&
        body.items.length <= 30,
      400,
      "invalid_items",
      "Add between one and 30 items.",
    );
    const quantities = new Map();
    for (const item of body.items) {
      assert(
        typeof item.productId === "string",
        400,
        "invalid_items",
        "Product ID is required.",
      );
      const qty = validMinor(item.quantity, "Quantity");
      quantities.set(
        item.productId,
        (quantities.get(item.productId) || 0) + qty,
      );
    }
    return await transaction(async () => {
      let total = 0;
      const lines = [];
      for (const [productId, qty] of quantities) {
        const product = await q(
          `SELECT * FROM products WHERE id=? AND status='active'${postgresMode ? " FOR UPDATE" : ""}`,
          productId,
        );
        assert(
          product,
          404,
          "product_unavailable",
          "A product is no longer available.",
        );
        assert(
          product.seller_id !== ctx.user.id,
          400,
          "own_product",
          "You cannot purchase your own listing.",
        );
        assert(
          product.fulfillment_type !== "external_checkout",
          400,
          "external_checkout",
          "This item uses external checkout.",
        );
        assert(
          product.stock >= qty,
          409,
          "stock_changed",
          `${product.name} does not have enough stock.`,
        );
        const lineTotal = product.price_minor * qty;
        assert(
          Number.isSafeInteger(lineTotal),
          400,
          "invalid_total",
          "Order total is too large.",
        );
        total += lineTotal;
        lines.push({ product, qty });
      }
      assert(
        total > 0 && Number.isSafeInteger(total),
        400,
        "invalid_total",
        "Order total is invalid.",
      );
      const orderId = id(),
        stamp = now();
      await run(
        "INSERT INTO orders(id,buyer_id,total_minor,created_at,updated_at) VALUES(?,?,?,?,?)",
        orderId,
        ctx.user.id,
        total,
        stamp,
        stamp,
      );
      const groups = new Map();
      for (const line of lines) {
        const sellerId = line.product.seller_id;
        if (!groups.has(sellerId)) {
          const groupId = id();
          groups.set(sellerId, groupId);
          await run(
            "INSERT INTO fulfillment_groups(id,order_id,seller_id,created_at,updated_at) VALUES(?,?,?,?,?)",
            groupId,
            orderId,
            sellerId,
            stamp,
            stamp,
          );
        }
        const groupId = groups.get(sellerId);
        await run(
          "INSERT INTO order_items(id,order_id,group_id,product_id,product_name,quantity,unit_price_minor,seller_id) VALUES(?,?,?,?,?,?,?,?)",
          id(),
          orderId,
          groupId,
          line.product.id,
          line.product.name,
          line.qty,
          line.product.price_minor,
          sellerId,
        );
        const change = await run(
          "UPDATE products SET stock=stock-?,updated_at=? WHERE id=? AND stock>=?",
          line.qty,
          stamp,
          line.product.id,
          line.qty,
        );
        assert(
          change.changes === 1,
          409,
          "stock_changed",
          "Stock changed while your order was being placed.",
        );
        await notify(
          sellerId,
          "order",
          "New EcoVibes order",
          `Order ${orderId.slice(0, 8)} includes ${line.qty} × ${line.product.name}.`,
          "order",
          orderId,
        );
      }
      await event(ctx.user.id, "order", orderId, "ORDER_CREATED", {
        totalMinor: total,
        groupCount: groups.size,
      });
      return visibleOrder(await getOrder(orderId), ctx);
    });
  }
  match = path.match(/^\/marketplace\/orders\/([a-f0-9-]+)\/cancel$/);
  if (method === "POST" && match) {
    return await transaction(async () => {
      const current = await q(
        `SELECT * FROM orders WHERE id=?${postgresMode ? " FOR UPDATE" : ""}`,
        match[1],
      );
      assert(
        current && current.buyer_id === ctx.user.id,
        404,
        "not_found",
        "Order not found.",
      );
      assert(
        ["pending", "confirmed"].includes(current.status),
        409,
        "cannot_cancel",
        "Orders can only be cancelled before shipping.",
      );
      assert(
        !["paid", "partially_refunded", "refunded"].includes(current.payment_status),
        409,
        "refund_required",
        "A paid order must go through the provider refund flow.",
      );
      assert(
        current.payment_status === "unpaid",
        409,
        "payment_pending",
        "A payment is still processing. Wait for its result; unpaid reservations expire after 30 minutes.",
      );
      const order = await getOrder(current.id);
      for (const group of order.groups)
        for (const item of group.items)
          await run(
            "UPDATE products SET stock=stock+?,updated_at=? WHERE id=?",
            item.quantity,
            now(),
            item.product_id,
          );
      await run(
        "UPDATE fulfillment_groups SET status='cancelled',updated_at=? WHERE order_id=? AND status='pending'",
        now(),
        order.id,
      );
      await run(
        "UPDATE orders SET status='cancelled',updated_at=? WHERE id=? AND status IN ('pending','confirmed') AND payment_status='unpaid'",
        now(),
        order.id,
      );
      for (const group of order.groups)
        await notify(
          group.seller_id,
          "order",
          "Order cancelled",
          `Order ${order.id.slice(0, 8)} was cancelled and stock was restored.`,
          "order",
          order.id,
        );
      await event(ctx.user.id, "order", order.id, "ORDER_CANCELLED");
      return visibleOrder(await getOrder(order.id), ctx);
    });
  }
  match = path.match(
    /^\/marketplace\/fulfillment\/([a-f0-9-]+)\/(confirm|ship|deliver)$/,
  );
  if (method === "POST" && match) {
    const group = await q("SELECT * FROM fulfillment_groups WHERE id=?", match[1]);
    assert(group, 404, "not_found", "Fulfillment group not found.");
    const order = await q("SELECT * FROM orders WHERE id=?", group.order_id);
    assert(order?.payment_status === "paid", 409, "payment_required", "The order must be paid before fulfillment can continue.");
    if (match[2] === "confirm") {
      assert(
        group.seller_id === ctx.user.id,
        403,
        "forbidden",
        "Only this seller can confirm fulfillment.",
      );
      assert(
        group.status === "pending",
        409,
        "invalid_transition",
        "This group cannot be confirmed now.",
      );
      const change = await run(
        "UPDATE fulfillment_groups SET status='processing',updated_at=? WHERE id=? AND status='pending'",
        now(),
        group.id,
      );
      assert(change.changes === 1, 409, "invalid_transition", "This group has already changed state.");
      await notify(
        order.buyer_id,
        "order",
        "Seller confirmed your order",
        "The seller is preparing your items.",
        "order",
        order.id,
      );
      await event(
        ctx.user.id,
        "fulfillment_group",
        group.id,
        "FULFILLMENT_CONFIRMED",
      );
    } else if (match[2] === "ship") {
      assert(
        group.seller_id === ctx.user.id,
        403,
        "forbidden",
        "Only this seller can ship this group.",
      );
      assert(
        group.status === "processing",
        409,
        "invalid_transition",
        "Confirm the order before shipping.",
      );
      const tracking = inputString(body.trackingCode, "Tracking code", {
        max: 100,
      });
      const change = await run(
        "UPDATE fulfillment_groups SET status='shipped',tracking_code=?,updated_at=? WHERE id=? AND status='processing'",
        tracking,
        now(),
        group.id,
      );
      assert(change.changes === 1, 409, "invalid_transition", "This group has already changed state.");
      await notify(
        order.buyer_id,
        "order",
        "Order group shipped",
        `Tracking: ${tracking}`,
        "order",
        order.id,
      );
      await event(ctx.user.id, "fulfillment_group", group.id, "GROUP_SHIPPED", {
        trackingCode: tracking,
      });
    } else {
      assert(
        order.buyer_id === ctx.user.id,
        403,
        "forbidden",
        "Only the buyer can confirm delivery.",
      );
      assert(
        group.status === "shipped",
        409,
        "invalid_transition",
        "This group has not shipped.",
      );
      const change = await run(
        "UPDATE fulfillment_groups SET status='delivered',updated_at=? WHERE id=? AND status='shipped'",
        now(),
        group.id,
      );
      assert(change.changes === 1, 409, "invalid_transition", "This group has already changed state.");
      await event(ctx.user.id, "fulfillment_group", group.id, "GROUP_DELIVERED");
    }
    const groups = await all(
      "SELECT status FROM fulfillment_groups WHERE order_id=?",
      order.id,
    );
    const newStatus = groups.every((g) => g.status === "delivered")
      ? "delivered"
      : groups.every((g) => ["shipped", "delivered"].includes(g.status))
        ? "shipped"
        : groups.some((g) => ["shipped", "delivered"].includes(g.status))
          ? "partially_shipped"
          : groups.some((g) => g.status === "processing")
            ? "confirmed"
            : "pending";
    await run(
      "UPDATE orders SET status=?,updated_at=? WHERE id=?",
      newStatus,
      now(),
      order.id,
    );
    return visibleOrder(await getOrder(order.id), ctx);
  }
  match = path.match(/^\/marketplace\/orders\/([a-f0-9-]+)\/refund$/);
  if (method === "POST" && match) {
    const order = await getOrder(match[1]);
    assert(
      order && order.buyer_id === ctx.user.id,
      404,
      "not_found",
      "Order not found.",
    );
    assert(
      order.payment_status === "paid" ||
        order.payment_status === "partially_refunded",
      409,
      "no_captured_payment",
      "No captured payment exists. Cancel the unpaid order instead; live refunds require a connected payment provider.",
    );
    assert(
      ["delivered", "disputed"].includes(order.status),
      409,
      "invalid_transition",
      "Refunds can only be requested after delivery or an order issue.",
    );
    const reason = inputString(body.reason, "Refund reason", {
      min: 5,
      max: 500,
    });
    const refundId = id();
    await run(
      "INSERT INTO refunds(id,order_id,requester_id,amount_minor,reason,status,created_at) VALUES(?,?,?,?,?,'requested',?)",
      refundId,
      order.id,
      ctx.user.id,
      order.total_minor,
      reason,
      now(),
    );
    await run(
      "UPDATE orders SET status='refund_requested',updated_at=? WHERE id=?",
      now(),
      order.id,
    );
    await event(ctx.user.id, "refund", refundId, "REFUND_REQUESTED", {
      orderId: order.id,
    });
    return {
      id: refundId,
      status: "requested",
      message: "Request recorded; provider refund processing is not connected.",
    };
  }
  if (method === "GET" && path === "/jobs") {
    const rows = await all(
      `SELECT j.*,u.eco_id customer_eco_id,u.display_name customer_name FROM jobs j JOIN users u ON u.id=j.customer_id WHERE j.status='open' OR j.customer_id=? OR j.assigned_provider_id=? ORDER BY j.created_at DESC LIMIT 100`,
      ctx.user.id,
      ctx.user.id,
    );
    return await Promise.all(rows.map(async (row) => visibleJob(await getJob(row.id), ctx)));
  }
  if (method === "POST" && path === "/jobs") {
    const title = inputString(body.title, "Job title", { max: 100 });
    const description = inputString(body.description, "Job details", {
      max: 2000,
    });
    const category = inputString(body.category, "Category", { max: 80 });
    const area = inputString(body.area, "Service area", { max: 120 });
    const budget = validMinor(body.budgetMinor, "Budget", { allowZero: true });
    const timing = body.timing === "scheduled" ? "scheduled" : "asap";
    const scheduled =
      timing === "scheduled"
        ? inputString(body.scheduledAt, "Scheduled time", { max: 50 })
        : null;
    const jobId = id(),
      stamp = now();
    await run(
      "INSERT INTO jobs(id,customer_id,category,title,description,area,budget_minor,timing,scheduled_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      jobId,
      ctx.user.id,
      category,
      title,
      description,
      area,
      budget,
      timing,
      scheduled,
      stamp,
      stamp,
    );
    await event(ctx.user.id, "job", jobId, "JOB_POSTED", { title, area });
    return visibleJob(await getJob(jobId), ctx);
  }
  match = path.match(/^\/jobs\/([a-f0-9-]+)$/);
  if (method === "GET" && match) {
    const job = await getJob(match[1]);
    assert(job && canReadJob(ctx, job), 404, "not_found", "Job not found.");
    return visibleJob(job, ctx);
  }
  match = path.match(/^\/jobs\/([a-f0-9-]+)\/offers$/);
  if (method === "POST" && match) {
    await requireRole(ctx, "provider");
    const job = await getJob(match[1]);
    assert(job, 404, "not_found", "Job not found.");
    assert(
      job.status === "open",
      409,
      "job_closed",
      "Offers are closed for this job.",
    );
    assert(
      job.customer_id !== ctx.user.id,
      403,
      "own_job",
      "You cannot offer on your own job.",
    );
    const amount = validMinor(body.amountMinor, "Offer amount");
    const note = inputString(body.note, "Offer details", { max: 500 });
    const eta = inputString(body.eta, "Estimated timing", { max: 100 });
    assert(
      !await q(
        "SELECT 1 ok FROM job_offers WHERE job_id=? AND provider_id=?",
        job.id,
        ctx.user.id,
      ),
      409,
      "duplicate_offer",
      "You have already offered on this job.",
    );
    const offerId = id();
    await run(
      "INSERT INTO job_offers(id,job_id,provider_id,amount_minor,note,eta,created_at) VALUES(?,?,?,?,?,?,?)",
      offerId,
      job.id,
      ctx.user.id,
      amount,
      note,
      eta,
      now(),
    );
    await event(ctx.user.id, "job", job.id, "JOB_OFFERED", { offerId });
    await notify(
      job.customer_id,
      "job",
      "New offer on your job",
      `@${ctx.user.eco_id} sent an offer.`,
      "job",
      job.id,
    );
    return visibleJob(await getJob(job.id), ctx);
  }
  match = path.match(/^\/jobs\/([a-f0-9-]+)\/offers\/([a-f0-9-]+)\/select$/);
  if (method === "POST" && match) {
    const job = await getJob(match[1]);
    assert(
      job && job.customer_id === ctx.user.id,
      404,
      "not_found",
      "Job not found.",
    );
    assert(job.status === "open", 409, "job_closed", "Job is no longer open.");
    const offer = job.offers.find(
      (item) => item.id === match[2] && item.status === "pending",
    );
    assert(offer, 404, "offer_unavailable", "Offer is not available.");
    return await transaction(async () => {
      const claim = await run(
        "UPDATE jobs SET status='assigned',assigned_provider_id=?,updated_at=? WHERE id=? AND customer_id=? AND status='open' AND EXISTS (SELECT 1 FROM job_offers WHERE id=? AND job_id=? AND status='pending')",
        offer.provider_id,
        now(),
        job.id,
        ctx.user.id,
        offer.id,
        job.id,
      );
      assert(claim.changes === 1, 409, "offer_unavailable", "This job or offer has already changed.");
      await run(
        "UPDATE job_offers SET status=CASE WHEN id=? THEN 'selected' ELSE 'declined' END WHERE job_id=?",
        offer.id,
        job.id,
      );
      await event(ctx.user.id, "job", job.id, "JOB_ASSIGNED", {
        offerId: offer.id,
        providerId: offer.provider_id,
      });
      await notify(
        offer.provider_id,
        "job",
        "Your offer was selected",
        `You were selected for ${job.title}.`,
        "job",
        job.id,
      );
      return visibleJob(await getJob(job.id), ctx);
    });
  }
  match = path.match(
    /^\/jobs\/([a-f0-9-]+)\/(start|finish|complete|dispute|cancel)$/,
  );
  if (method === "POST" && match) {
    const job = await getJob(match[1]);
    assert(job, 404, "not_found", "Job not found.");
    const action = match[2];
    let next;
    const provider = ctx.user.id === job.assigned_provider_id;
    const customer = ctx.user.id === job.customer_id;
    if (action === "start") {
      assert(
        provider,
        403,
        "forbidden",
        "Only the assigned provider can start this job.",
      );
      assert(
        job.status === "assigned",
        409,
        "invalid_transition",
        "Only an assigned job can start.",
      );
      next = "in_progress";
    } else if (action === "finish") {
      assert(
        provider,
        403,
        "forbidden",
        "Only the assigned provider can mark work finished.",
      );
      assert(
        job.status === "in_progress",
        409,
        "invalid_transition",
        "Start the job before marking it finished.",
      );
      next = "awaiting_customer";
    } else if (action === "complete") {
      assert(
        customer,
        403,
        "forbidden",
        "Only the customer can confirm completion.",
      );
      assert(
        job.status === "awaiting_customer",
        409,
        "invalid_transition",
        "The provider must mark the job finished first.",
      );
      next = "completed";
    } else if (action === "dispute") {
      assert(
        customer || provider,
        403,
        "forbidden",
        "Only participants can report a job issue.",
      );
      assert(
        ["in_progress", "awaiting_customer", "completed"].includes(job.status),
        409,
        "invalid_transition",
        "This job cannot be disputed now.",
      );
      next = "disputed";
      const reason = inputString(body.reason, "Issue details", {
        min: 5,
        max: 700,
      });
      await run(
        "INSERT INTO support_reports(id,reporter_id,target_type,target_id,reason,details,created_at) VALUES(?,?,?,?,?,?,?)",
        id(),
        ctx.user.id,
        "job",
        job.id,
        "job_dispute",
        reason,
        now(),
      );
    } else {
      assert(
        customer,
        403,
        "forbidden",
        "Only the customer can cancel this job.",
      );
      assert(
        ["open", "assigned"].includes(job.status),
        409,
        "invalid_transition",
        "Work already started; report an issue instead.",
      );
      next = "cancelled";
    }
    await run(
      "UPDATE jobs SET status=?,updated_at=? WHERE id=?",
      next,
      now(),
      job.id,
    );
    await event(
      ctx.user.id,
      "job",
      job.id,
      `JOB_${next.toUpperCase()}`,
      action === "dispute" ? { reason: body.reason } : {},
    );
    const other = customer ? job.assigned_provider_id : job.customer_id;
    if (other)
      await notify(
        other,
        "job",
        `Job ${next.replaceAll("_", " ")}`,
        `${job.title} was updated.`,
        "job",
        job.id,
      );
    return visibleJob(await getJob(job.id), ctx);
  }
  match = path.match(/^\/jobs\/([a-f0-9-]+)\/messages$/);
  if (method === "POST" && match) {
    const job = await getJob(match[1]);
    assert(
      job &&
        (job.customer_id === ctx.user.id ||
          job.assigned_provider_id === ctx.user.id),
      404,
      "not_found",
      "Job conversation not found.",
    );
    assert(
      !["cancelled"].includes(job.status),
      409,
      "conversation_closed",
      "This conversation is closed.",
    );
    const text = inputString(body.body, "Message", { max: 1000 });
    const messageId = id();
    await run(
      "INSERT INTO job_messages(id,job_id,sender_id,body,created_at) VALUES(?,?,?,?,?)",
      messageId,
      job.id,
      ctx.user.id,
      text,
      now(),
    );
    await event(ctx.user.id, "job_message", messageId, "MESSAGE_SENT", {
      jobId: job.id,
    });
    const other =
      job.customer_id === ctx.user.id
        ? job.assigned_provider_id
        : job.customer_id;
    if (other)
      await notify(
        other,
        "message",
        "New Quick&Handi message",
        `@${ctx.user.eco_id} sent a message.`,
        "job",
        job.id,
      );
    return visibleJob(await getJob(job.id), ctx);
  }
  if (method === "GET" && path === "/search") {
    const text = String(query.get("q") || "")
      .trim()
      .slice(0, 100);
    assert(
      text.length >= 2,
      400,
      "query_too_short",
      "Enter at least two characters.",
    );
    const like = `%${text}%`;
    const productResults = await all(
      "SELECT p.id,p.name title,p.description detail,p.category,p.price_minor,u.eco_id actor_eco_id FROM products p JOIN users u ON u.id=p.seller_id WHERE p.status='active' AND p.fulfillment_type!='external_checkout' AND (p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ?) ORDER BY p.created_at DESC LIMIT 8",
      like,
      like,
      like,
    ).map((item) => ({ ...item, price: `GH₵${(item.price_minor / 100).toFixed(2)}`, kind: "product", destination: "Marketplace" }));
    const jobResults = await all(
      "SELECT j.id,j.title,j.description detail,j.category,j.area,u.eco_id actor_eco_id FROM jobs j JOIN users u ON u.id=j.customer_id WHERE j.status='open' AND (j.title LIKE ? OR j.description LIKE ? OR j.category LIKE ? OR j.area LIKE ?) ORDER BY j.created_at DESC LIMIT 8",
      like,
      like,
      like,
      like,
    ).map((item) => ({ ...item, kind: "job", destination: "Quick&Handi" }));
    return {
      query: text,
      items: [...productResults, ...jobResults].slice(0, 12),
      source: "server-catalog",
    };
  }
  return undefined;
}
const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'",
  );
  let status = 200;
  try {
    const url = new URL(req.url, "http://localhost");
    const method = req.method || "GET";
    const requestOrigin = req.headers.origin;
    const allowedOrigins = (process.env.APP_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
    if (requestOrigin && (requestOrigin === `https://${req.headers.host}` || requestOrigin === `http://${req.headers.host}` || allowedOrigins.includes(requestOrigin))) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }
    if (method === "OPTIONS") {
      assert(requestOrigin && allowedOrigins.includes(requestOrigin), 403, "bad_origin", "This app origin is not allowed.");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-CSRF-Token,Authorization,apikey");
      res.setHeader("Access-Control-Max-Age", "600");
      res.statusCode = 204;
      return res.end();
    }
    let body = {};
    if (!["GET", "HEAD"].includes(method)) body = await bodyJson(req, url.pathname === "/api/v1/social/assets" ? 20_000_000 : 256_000);
    if ((method === "POST" || method === "PATCH" || method === "DELETE") && url.pathname !== "/api/v1/media/webhook")
      originCheck(req);
    let ctx = { user: null, csrfToken: null };
    const cookies = parseCookies(req);
    const raw = cookies.ev_session;
    if (raw) {
      const tokenHash = hash(raw);
      const record = await q(
        "SELECT * FROM sessions WHERE token_hash=? AND expires_at>?",
        tokenHash,
        now(),
      );
      if (record) {
        ctx.user = await safeUser(record.user_id);
        ctx.csrfToken = record.csrf_token;
      }
    }
    const authOpen =
      (method === "GET" && url.pathname === "/api/v1/auth/me") ||
      (method === "GET" && url.pathname === "/api/v1/auth/supabase/me") ||
      (method === "POST" && url.pathname === "/api/v1/auth/supabase/session") ||
      (method === "POST" &&
        ["/api/v1/auth/register", "/api/v1/auth/login"].includes(
          url.pathname,
        )) ||
      (method === "GET" && url.pathname === "/api/v1/health") ||
      (method === "GET" && url.pathname === "/api/v1/media/status") ||
      (method === "GET" && url.pathname === "/api/v1/marketplace/products") ||
      (method === "GET" && url.pathname === "/api/v1/search");
    const providerWebhook = url.pathname === "/api/v1/webhooks/paystack";
    if (ctx.user && !authOpen && !providerWebhook && ["POST", "PATCH", "DELETE"].includes(method)) {
      const token = req.headers["x-csrf-token"];
      assert(
        token &&
          String(token).length === ctx.csrfToken.length &&
          timingSafeEqual(
            Buffer.from(String(token)),
            Buffer.from(ctx.csrfToken),
          ),
        403,
        "csrf_failed",
        "Refresh your session and try again.",
      );
    }
    const result = await route(
      ctx,
      req,
      res,
      method,
      url.pathname.replace(/^\/api\/v1/, ""),
      body,
      url.searchParams,
    );
    if (res.writableEnded) return;
    if (result === undefined) fault(404, "not_found", "Route not found.");
    res.statusCode = status;
    res.end(JSON.stringify(result));
  } catch (error) {
    const code = error.code || "internal_error";
    const httpStatus = error.status || 500;
    if (httpStatus >= 500) console.error(error);
    res.statusCode = httpStatus;
    res.end(
      JSON.stringify({
        error: {
          code,
          message:
            httpStatus >= 500
              ? "The server could not complete the request."
              : error.message,
        },
      }),
    );
  }
});
const unpaidOrderExpiry = setInterval(() => {
  void expireUnpaidOrders().catch((error) => console.error("Unpaid order cleanup failed", error));
}, 60_000);
unpaidOrderExpiry.unref();
void expireUnpaidOrders().catch((error) => console.error("Initial unpaid order cleanup failed", error));
server.listen(port, isProduction ? "0.0.0.0" : "127.0.0.1", () =>
  console.log(
    `EcoVibes API listening on port ${port} · database ${postgresMode ? "postgres" : dbPath}`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearInterval(unpaidOrderExpiry);
    server.close(() => {
      Promise.resolve(postgresMode ? pool.end() : db.close()).finally(() => process.exit(0));
    });
  });
