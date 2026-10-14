import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

// Disposable SQLite, synthetic accounts, real HTTP; no .env or hosted providers.
const temp = await mkdtemp(resolve(tmpdir(), 'ecovibes-support-'));
const dbPath = resolve(temp, 'isolated.sqlite');
const port = Number(process.env.SUPPORT_TEST_PORT || 19110);
const origin = `http://127.0.0.1:${port}`;
let logs = '', db, checks = 0;
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
async function signup(ecoId, staffRole) {
  const response = await request('/auth/register', { method: 'POST', body: { ecoId, displayName: ecoId, password: 'Synthetic-test-password-123' } });
  assert.equal(response.status, 200);
  const account = { id: response.data.user.id, cookie: response.cookie, csrf: response.data.csrfToken };
  if (staffRole) db.prepare('INSERT INTO staff_access(user_id,staff_role,created_at) VALUES(?,?,?)').run(account.id, staffRole, new Date().toISOString());
  return account;
}
function snapshot(reportId) {
  return {
    report: db.prepare('SELECT * FROM support_reports WHERE id=?').get(reportId),
    events: db.prepare('SELECT * FROM domain_events WHERE aggregate_id=? ORDER BY id').all(reportId),
    audit: db.prepare('SELECT * FROM audit_logs WHERE target_id=? ORDER BY id').all(reportId),
    notifications: db.prepare('SELECT * FROM notifications WHERE target_id=? ORDER BY id').all(reportId),
  };
}
function fixture(reporter, targetType = 'account', targetId = reporter.id) {
  const reportId = randomUUID();
  db.prepare("INSERT INTO support_reports(id,reporter_id,target_type,target_id,reason,details,created_at) VALUES(?,?,?,?,'Synthetic concern','Synthetic private details',?)")
    .run(reportId, reporter.id, targetType, targetId, new Date().toISOString());
  return reportId;
}
function jobFixture(customer, provider) {
  const jobId = randomUUID(), stamp = new Date().toISOString();
  db.prepare("INSERT INTO jobs(id,customer_id,assigned_provider_id,category,title,description,area,budget_minor,timing,status,created_at,updated_at) VALUES(?,?,?,'Cleaning','Synthetic job','Synthetic disputed job','Tema',10000,'asap','disputed',?,?)")
    .run(jobId, customer.id, provider.id, stamp, stamp);
  return jobId;
}
function orderFixture(buyer, seller) {
  const orderId = randomUUID(), groupId = randomUUID(), productId = randomUUID(), stamp = new Date().toISOString();
  db.prepare("INSERT INTO products(id,seller_id,name,category,price_minor,stock,fulfillment_type,created_at,updated_at) VALUES(?,?,'Synthetic item','Other',10000,1,'own_inventory',?,?)").run(productId, seller.id, stamp, stamp);
  db.prepare("INSERT INTO orders(id,buyer_id,total_minor,status,payment_status,created_at,updated_at) VALUES(?,?,10000,'disputed','paid',?,?)").run(orderId, buyer.id, stamp, stamp);
  db.prepare('INSERT INTO fulfillment_groups(id,order_id,seller_id,created_at,updated_at) VALUES(?,?,?,?,?)').run(groupId, orderId, seller.id, stamp, stamp);
  db.prepare("INSERT INTO order_items(id,order_id,group_id,product_id,product_name,quantity,unit_price_minor,seller_id) VALUES(?,?,?,?,'Synthetic item',1,10000,?)").run(randomUUID(), orderId, groupId, productId, seller.id);
  return orderId;
}
const pathFor = reportId => `/staff/review/reports/${reportId}`;
const review = (account, status = 'reviewing', extra = {}) => ({ method: 'PATCH', account,
  body: { status, note: 'Private staff note: synthetic evidence reviewed.' }, ...extra });
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
  const reporter = await signup('support.reporter'), outsider = await signup('support.outsider');
  const staff = await signup('support.staff', 'support_staff'), secondStaff = await signup('support.second', 'support_staff');
  const trustStaff = await signup('support.trust', 'trust_staff');
  const reportBody = { targetType: 'account', targetId: '@support.outsider', reason: 'Synthetic concern', details: 'Synthetic private details for a local report.' };

  // Regression: a failed submission audit cannot leave an orphan case or event.
  const creationSnapshot = () => ({
    reports: db.prepare('SELECT * FROM support_reports ORDER BY id').all(),
    events: db.prepare("SELECT * FROM domain_events WHERE aggregate_type='support_report' ORDER BY id").all(),
    audit: db.prepare("SELECT * FROM audit_logs WHERE target_type='support_report' ORDER BY id").all(),
  });
  const beforeCreate = creationSnapshot();
  db.exec("CREATE TRIGGER fail_support_create BEFORE INSERT ON audit_logs WHEN NEW.action='REPORT_CREATED' BEGIN SELECT RAISE(ABORT,'Synthetic report audit failure'); END");
  await expect('/support/reports', { method: 'POST', account: reporter, body: reportBody }, 500);
  assert.deepEqual(creationSnapshot(), beforeCreate, 'Failed submission must roll back its case and event'); checks++;
  db.exec('DROP TRIGGER fail_support_create');
  const created = await expect('/support/reports', { method: 'POST', account: reporter, body: reportBody });
  const reportId = created.id, reportPath = pathFor(reportId);
  assert.equal(created.status, 'open');
  const initial = snapshot(reportId);
  assert.equal(initial.report.reporter_id, reporter.id);
  assert.equal(initial.events.length, 1); assert.equal(initial.audit.length, 1); checks++;

  await expect('/staff/review/reports', {}, 401);
  await expect('/staff/review/reports', { account: reporter }, 403);
  await expect('/staff/review/reports', { account: trustStaff }, 403);
  assert((await expect('/staff/review/reports', { account: staff })).some(item => item.id === reportId));
  await expect(reportPath, review(undefined), 401);
  await expect(reportPath, review(reporter), 403);
  await expect(reportPath, review(outsider), 403);
  await expect(reportPath, review(trustStaff), 403);
  await expect(reportPath, review(staff, 'reviewing', { csrf: false }), 403);
  await expect(reportPath, review(staff, 'reviewing', { requestOrigin: 'https://untrusted.example' }), 403);
  await expect(reportPath, review(staff, 'open'), 400);
  await expect(reportPath, review(staff, 'reviewing', { body: { status: 'reviewing', note: 'bad' } }), 400);
  await expect(pathFor(randomUUID()), review(staff), 404);
  assert.deepEqual(snapshot(reportId), initial); checks++;

  // Case status, audit and recipient notification must commit together.
  db.exec("CREATE TRIGGER fail_support_review BEFORE INSERT ON audit_logs WHEN NEW.action='REPORT_REVIEWING' BEGIN SELECT RAISE(ABORT,'Synthetic review audit failure'); END");
  await expect(reportPath, review(staff), 500);
  assert.deepEqual(snapshot(reportId), initial, 'Failed review audit must roll back case status'); checks++;
  db.exec('DROP TRIGGER fail_support_review');
  db.exec("CREATE TRIGGER fail_support_notice BEFORE INSERT ON notifications WHEN NEW.target_type='support_report' BEGIN SELECT RAISE(ABORT,'Synthetic review notice failure'); END");
  await expect(reportPath, review(staff), 500);
  assert.deepEqual(snapshot(reportId), initial, 'Failed notification must roll back status and audit'); checks++;
  db.exec('DROP TRIGGER fail_support_notice');
  assert.equal((await expect(reportPath, review(staff))).status, 'reviewing');
  const reviewing = snapshot(reportId);
  assert.equal(reviewing.audit.length, 2); assert.equal(reviewing.notifications.length, 1);
  assert.equal(reviewing.audit.find(row => row.action === 'REPORT_REVIEWING').reason, review(staff).body.note);
  assert.equal(reviewing.notifications[0].user_id, reporter.id);
  assert(!JSON.stringify(reviewing.notifications).includes('Private staff note')); checks++;
  const reporterNotices = await expect('/notifications', { account: reporter });
  assert(reporterNotices.some(item => item.target_id === reportId));
  assert(!(await expect('/notifications', { account: outsider })).some(item => item.target_id === reportId));
  await expect(reportPath, review(secondStaff), 409);
  assert.deepEqual(snapshot(reportId), reviewing); checks++;

  db.exec("CREATE TRIGGER fail_support_resolve BEFORE INSERT ON audit_logs WHEN NEW.action='REPORT_RESOLVED' BEGIN SELECT RAISE(ABORT,'Synthetic resolution audit failure'); END");
  await expect(reportPath, review(secondStaff, 'resolved'), 500);
  assert.deepEqual(snapshot(reportId), reviewing); checks++;
  db.exec('DROP TRIGGER fail_support_resolve');
  assert.equal((await expect(reportPath, review(secondStaff, 'resolved'))).status, 'resolved');
  const resolved = snapshot(reportId);
  assert.equal(resolved.audit.length, 3); assert.equal(resolved.notifications.length, 2);
  assert.equal(resolved.report.reviewer_id, secondStaff.id); checks++;
  await expect(reportPath, review(staff, 'resolved'), 409);
  await expect(reportPath, review(staff), 409);
  assert.deepEqual(snapshot(reportId), resolved); checks++;
  assert(!(await expect('/staff/review/reports', { account: staff })).some(item => item.id === reportId));

  // Inactive/revoked staff and direct self-review must be rejected server-side.
  const openId = fixture(reporter, 'account', outsider.id);
  const ownId = fixture(staff, 'account', outsider.id);
  await expect(pathFor(ownId), review(staff, 'resolved'), 403);
  const againstStaff = fixture(reporter, 'account', staff.id);
  await expect(pathFor(againstStaff), review(staff, 'resolved'), 403);
  await expect(pathFor(againstStaff), review(secondStaff, 'resolved'));
  await expect(pathFor(fixture(reporter, 'seller', staff.id)), review(staff, 'resolved'), 403);
  for (const jobId of [jobFixture(staff, outsider), jobFixture(reporter, staff)]) {
    const jobReport = fixture(reporter, 'job', jobId);
    const before = db.prepare('SELECT * FROM jobs WHERE id=?').get(jobId);
    await expect(pathFor(jobReport), review(staff, 'resolved'), 403);
    await expect(pathFor(jobReport), review(secondStaff, 'resolved'));
    assert.deepEqual(db.prepare('SELECT * FROM jobs WHERE id=?').get(jobId), before, 'Closing a support case must not settle its job'); checks++;
  }
  for (const orderId of [orderFixture(staff, outsider), orderFixture(reporter, staff)]) {
    const orderReport = fixture(reporter, 'order', orderId);
    const before = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
    await expect(pathFor(orderReport), review(staff, 'resolved'), 403);
    await expect(pathFor(orderReport), review(secondStaff, 'resolved'));
    assert.deepEqual(db.prepare('SELECT * FROM orders WHERE id=?').get(orderId), before);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM refunds WHERE order_id=?').get(orderId).n, 0); checks++;
  }
  db.prepare('DELETE FROM staff_access WHERE user_id=?').run(staff.id);
  await expect(pathFor(openId), review(staff), 403);
  db.prepare("INSERT INTO staff_access(user_id,staff_role,created_at) VALUES(?,'support_staff',?)").run(staff.id, new Date().toISOString());
  db.prepare("UPDATE users SET status='suspended' WHERE id=?").run(staff.id);
  await expect(pathFor(openId), review(staff), 403);
  db.prepare("UPDATE users SET status='active' WHERE id=?").run(staff.id);
  // Suspension revoked this cookie; reactivation must not restore that session.
  await expect(pathFor(openId), review(staff), 401);
  assert.equal(snapshot(openId).report.status, 'open'); checks++;

  // Duplicate HTTP arrivals are serialized locally. This is not a hosted race test.
  const raceId = fixture(reporter, 'account', outsider.id);
  const attempts = await Promise.all([request(pathFor(raceId), review(secondStaff, 'resolved')), request(pathFor(raceId), review(secondStaff, 'resolved'))]);
  assert.deepEqual(attempts.map(item => item.status).sort(), [200, 409]); checks++;
  const raced = snapshot(raceId);
  assert.equal(raced.audit.length, 1); assert.equal(raced.notifications.length, 1); checks++;

  console.log(`PASS: ${checks} support workflow checks. Isolated SQLite, synthetic accounts, real HTTP. Hosted Postgres/Auth/MFA and settlement not covered.`);
} finally {
  db?.close(); child.kill('SIGTERM');
  await Promise.race([new Promise(done => child.once('exit', done)), delay(3000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
  await rm(temp, { recursive: true, force: true });
}
