import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';

// Real HTTP against disposable SQLite and synthetic accounts; no application .env.
const temp = await mkdtemp(resolve(tmpdir(), 'ecovibes-identity-roles-'));
const dbPath = resolve(temp, 'isolated.sqlite');
const port = Number(process.env.IDENTITY_ROLES_TEST_PORT || 19112);
const origin = `http://127.0.0.1:${port}`;
let db, logs = '', checks = 0;
const child = spawn(process.execPath, ['server/index.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR || '/tmp', NODE_ENV: 'test',
    PORT: String(port), ECOVIBES_DB_PATH: dbPath, APP_ORIGINS: origin, DATABASE_URL: '', SUPABASE_URL: '',
    OPENAI_ENV_FILE: '', ECOVIBES_SERVE_WEB: 'false' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', part => { logs += part; });
child.stderr.on('data', part => { logs += part; });
async function request(path, { method = 'GET', account, body, csrf = true, requestOrigin = origin } = {}) {
  const response = await fetch(`${origin}/api/v1${path}`, { method, signal: AbortSignal.timeout(5000), headers: {
    Origin: requestOrigin, 'Content-Type': 'application/json',
    ...(account ? { Cookie: account.cookie } : {}), ...(account && csrf ? { 'X-CSRF-Token': account.csrf } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
async function expect(path, options, status = 200) {
  const response = await request(path, options);
  assert.equal(response.status, status, `${path}: ${JSON.stringify(response.data)}`);
  checks++;
  return response.data;
}
async function signup(ecoId) {
  const response = await request('/auth/register', { method: 'POST', body: { ecoId, displayName: ecoId, password: 'Synthetic-test-password-123' } });
  assert.equal(response.status, 200);
  return { id: response.data.user.id, cookie: response.cookie, csrf: response.data.csrfToken };
}
function snapshot(account) {
  return {
    roles: db.prepare('SELECT * FROM roles WHERE user_id=? ORDER BY role').all(account.id),
    providers: db.prepare('SELECT * FROM provider_profiles WHERE user_id=?').all(account.id),
    sellers: db.prepare('SELECT * FROM seller_profiles WHERE user_id=?').all(account.id),
    events: db.prepare("SELECT * FROM domain_events WHERE aggregate_type='identity' AND aggregate_id=? ORDER BY id").all(account.id),
    audit: db.prepare("SELECT * FROM audit_logs WHERE target_type='identity' AND target_id=? ORDER BY id").all(account.id),
    staff: db.prepare('SELECT * FROM staff_access WHERE user_id=? ORDER BY staff_role').all(account.id),
  };
}
const path = '/identity/roles';
const grant = (account, role = 'provider', extra = {}) => ({ method: 'POST', account, body: { role }, ...extra });
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) throw new Error(`API exited: ${logs}`);
    try { ready = (await request('/health')).status === 200; } catch {}
    if (ready) break;
    await delay(100);
  }
  assert(ready, `Isolated API did not start: ${logs}`);
  db = new DatabaseSync(dbPath);
  const owner = await signup('roles.owner'), other = await signup('roles.other');
  const concurrent = await signup('roles.concurrent'), repair = await signup('roles.repair');
  const initial = snapshot(owner), otherInitial = snapshot(other);

  // Reproduce the prior partial-save bug before checking the happy path.
  db.exec("CREATE TRIGGER fail_role_audit BEFORE INSERT ON audit_logs WHEN NEW.action='ROLE_ADDED' BEGIN SELECT RAISE(ABORT,'Synthetic role audit failure'); END");
  await expect(path, grant(owner), 500);
  assert.deepEqual(snapshot(owner), initial, 'Failed audit must roll back role, profile and domain event'); checks++;
  db.exec('DROP TRIGGER fail_role_audit');

  db.exec("CREATE TRIGGER fail_role_profile BEFORE INSERT ON provider_profiles BEGIN SELECT RAISE(ABORT,'Synthetic provider profile failure'); END");
  await expect(path, grant(owner), 500);
  assert.deepEqual(snapshot(owner), initial, 'Failed profile must roll back the role'); checks++;
  db.exec('DROP TRIGGER fail_role_profile');
  db.exec("CREATE TRIGGER fail_role_event BEFORE INSERT ON domain_events WHEN NEW.event_type='ROLE_ADDED' BEGIN SELECT RAISE(ABORT,'Synthetic role event failure'); END");
  await expect(path, grant(owner), 500);
  assert.deepEqual(snapshot(owner), initial, 'Failed event must roll back the profile and role'); checks++;
  db.exec('DROP TRIGGER fail_role_event');

  await expect(path, grant(undefined), 401);
  await expect(path, grant(owner, 'provider', { csrf: false }), 403);
  await expect(path, grant(owner, 'provider', { requestOrigin: 'https://untrusted.example' }), 403);
  for (const role of ['admin', 'trust_staff', 'support_staff', 'organization_admin', 'customer', '', null]) {
    await expect(path, grant(owner, role), 400);
  }
  assert.deepEqual(snapshot(owner), initial); checks++;

  const response = await expect(path, grant(owner, 'provider', { body: {
    role: 'provider', userId: other.id, organizationId: 'untrusted-organization', staffRole: 'admin', verificationState: 'approved',
  } }));
  assert.equal(response.user.id, owner.id);
  assert.deepEqual(response.user.roles, ['customer', 'provider']);
  const enabled = snapshot(owner);
  assert.equal(enabled.providers.length, 1); assert.equal(enabled.providers[0].verification_state, 'unverified');
  assert.equal(enabled.events.length - initial.events.length, 1);
  assert.equal(enabled.audit.length - initial.audit.length, 1);
  assert.equal(enabled.events.find(row => row.event_type === 'ROLE_ADDED').details_json, JSON.stringify({ role: 'provider' }));
  assert.deepEqual(enabled.staff, []); assert.deepEqual(snapshot(other), otherInitial); checks++;
  await expect(path, grant(owner));
  assert.deepEqual(snapshot(owner), enabled, 'Retry must not duplicate audits, events or profiles'); checks++;
  await expect('/staff/review/verifications', { account: owner }, 403);
  await expect('/staff/review/reports', { account: owner }, 403);
  assert.deepEqual((await expect('/providers')).providers, []);

  // Enabling a second role preserves existing reviewed profile fields and state.
  db.prepare("UPDATE provider_profiles SET business_name='Existing service',verification_state='approved',revision=7 WHERE user_id=?").run(owner.id);
  const beforeSecond = snapshot(owner);
  const sellerResponse = await expect(path, grant(owner, 'seller'));
  assert.deepEqual(sellerResponse.user.roles, ['customer', 'provider', 'seller']);
  const both = snapshot(owner);
  assert.deepEqual(both.providers, beforeSecond.providers);
  assert.equal(both.sellers.length, 1); assert.equal(both.sellers[0].verification_state, 'unverified');
  assert.equal(both.events.length - beforeSecond.events.length, 1); checks++;
  await expect(path, grant(owner, 'seller'));
  await expect(path, grant(owner));
  assert.deepEqual(snapshot(owner), both); checks++;

  // Same-role retries and different-role arrivals use the same owner lock.
  const repeats = await Promise.all([request(path, grant(concurrent)), request(path, grant(concurrent))]);
  assert.deepEqual(repeats.map(item => item.status), [200, 200]);
  const afterRepeats = snapshot(concurrent);
  assert.equal(afterRepeats.providers.length, 1);
  assert.equal(afterRepeats.events.filter(row => row.event_type === 'ROLE_ADDED').length, 1);
  assert.equal(afterRepeats.audit.filter(row => row.action === 'ROLE_ADDED').length, 1); checks++;
  const different = await Promise.all([request(path, grant(other)), request(path, grant(other, 'seller'))]);
  assert.deepEqual(different.map(item => item.status), [200, 200]);
  const differentState = snapshot(other);
  assert.deepEqual(differentState.roles.map(row => row.role), ['customer', 'provider', 'seller']);
  assert.equal(differentState.events.filter(row => row.event_type === 'ROLE_ADDED').length, 2); checks++;

  // Repair a prior orphan role without claiming the role was newly granted.
  db.prepare("INSERT INTO roles(user_id,role,created_at) VALUES(?,'seller',?)").run(repair.id, new Date().toISOString());
  const orphan = snapshot(repair);
  db.exec("CREATE TRIGGER fail_role_repair BEFORE INSERT ON audit_logs WHEN NEW.action='ROLE_PROFILE_REPAIRED' BEGIN SELECT RAISE(ABORT,'Synthetic profile repair audit failure'); END");
  await expect(path, grant(repair, 'seller'), 500);
  assert.deepEqual(snapshot(repair), orphan); checks++;
  db.exec('DROP TRIGGER fail_role_repair');
  await expect(path, grant(repair, 'seller'));
  const repaired = snapshot(repair);
  assert.deepEqual(repaired.roles, orphan.roles);
  assert.equal(repaired.sellers[0].verification_state, 'unverified');
  assert.equal(repaired.events.filter(row => row.event_type === 'ROLE_PROFILE_REPAIRED').length, 1);
  assert.equal(repaired.audit.filter(row => row.action === 'ROLE_PROFILE_REPAIRED').length, 1);
  assert.equal(repaired.audit.filter(row => row.action === 'ROLE_ADDED').length, 0); checks++;
  await expect(path, grant(repair, 'seller'));
  assert.deepEqual(snapshot(repair), repaired); checks++;

  db.prepare("UPDATE users SET status='suspended' WHERE id=?").run(concurrent.id);
  const suspended = snapshot(concurrent);
  await expect(path, grant(concurrent, 'seller'), 403);
  assert.deepEqual(snapshot(concurrent), suspended); checks++;
  console.log(`PASS: ${checks} identity role checks. Isolated SQLite and synthetic accounts; hosted Auth/Postgres/MFA not covered.`);
} finally {
  db?.close(); child.kill('SIGTERM');
  await Promise.race([new Promise(done => child.once('exit', done)), delay(3000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
  await rm(temp, { recursive: true, force: true });
}
