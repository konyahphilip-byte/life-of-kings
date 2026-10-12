import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID, createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const scripts = dirname(fileURLToPath(import.meta.url)), app = resolve(scripts, '..');
const temp = await mkdtemp(resolve(tmpdir(), 'ecovibes-paystack-'));
const databasePath = resolve(temp, 'isolated.sqlite'), fixturePath = resolve(temp, 'provider.json'), capturePath = resolve(temp, 'calls.jsonl');
const secret = 'sk_test_synthetic_refund_workflow';
let origin, startupError, exited = false, log = '', database;
const checks = [], fixtures = {};
await writeFile(fixturePath, '{}');
await writeFile(capturePath, '');
const child = spawn(process.execPath, ['--import', resolve(scripts, 'paystack-test-provider.mjs'), 'server/index.mjs'], {
  cwd: app, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  env: { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR || '/tmp', NODE_ENV: 'test', PORT: '0', API_PORT: '0', ECOVIBES_DB_PATH: databasePath,
    PAYSTACK_SECRET_KEY: secret, PAYSTACK_TEST_FIXTURE: fixturePath, PAYSTACK_TEST_CAPTURE: capturePath, OPENAI_ENV_FILE: '' },
});
child.on('message', message => { if (message?.event === 'payment-test-ready') origin = `http://127.0.0.1:${message.port}`; });
child.on('error', error => { startupError = error; });
child.on('exit', () => { exited = true; });
for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { log = (log + chunk).slice(-8000); });
const record = name => { checks.push(name); console.log(`PASS ${name}`); };
const fixture = async (path, data, method = 'GET', status = 200) => {
  fixtures[`${method} ${path}`] = { status, body: { status: status === 200, data } };
  await writeFile(fixturePath, JSON.stringify(fixtures));
};
async function request(path, { method = 'GET', body, account, csrf = true, headers = {} } = {}) {
  assert(origin && !exited, 'Requests must use this isolated child listener.');
  const response = await fetch(`${origin}/api/v1${path}`, { method, signal: AbortSignal.timeout(25000), headers: {
    Origin: origin, 'Content-Type': 'application/json', ...(account ? { Cookie: account.cookie, ...(csrf ? { 'X-CSRF-Token': account.csrf } : {}) } : {}), ...headers,
  }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
const webhook = (body, headers = {}) => request('/webhooks/paystack', { method: 'POST', body,
  headers: { 'x-paystack-signature': createHmac('sha512', secret).update(JSON.stringify(body)).digest('hex'), ...headers } });
const get = (table, id) => database.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
const count = (table, column, value) => database.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column}=?`).get(value).n;
const capture = async () => (await readFile(capturePath, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
let nextProviderId = 100;
let buyer, staff, outsider;
async function seed(amounts, statuses = amounts.map(() => 'provider_pending')) {
  const order = randomUUID(), payment = randomUUID(), reference = `synthetic-${randomUUID()}`, transactionId = ++nextProviderId;
  const stamp = new Date().toISOString();
  database.prepare("INSERT INTO orders(id,buyer_id,total_minor,status,payment_status,created_at,updated_at) VALUES(?,?,10000,'refund_requested','paid',?,?)").run(order, buyer.id, stamp, stamp);
  database.prepare("INSERT INTO payments(id,order_id,provider,provider_reference,amount_minor,currency,state,created_at) VALUES(?,?,'paystack',?,10000,'GHS','paid',?)").run(payment, order, reference, stamp);
  const refunds = [];
  for (let i = 0; i < amounts.length; i++) {
    const id = randomUUID(), providerId = String(++nextProviderId), status = statuses[i];
    database.prepare("INSERT INTO refunds(id,order_id,requester_id,amount_minor,reason,status,provider_reference,previous_order_status,created_at) VALUES(?,?,?,?,'Synthetic refund case',?,?,'delivered',?)").run(id, order, buyer.id, amounts[i], status, status === 'requested' ? null : providerId, `${stamp}-${i}`);
    refunds.push({ id, providerId, amount: amounts[i] });
    await fixture(`/refund/${providerId}`, { id: Number(providerId), transaction: transactionId, amount: amounts[i], currency: 'GHS', domain: 'test', status: 'pending' });
  }
  await fixture(`/transaction/verify/${reference}`, { id: transactionId, reference, amount: 10000, currency: 'GHS', domain: 'test', status: 'success' });
  return { order, payment, reference, transactionId, refunds };
}
async function providerState(test, index, status, overrides = {}) {
  const refund = test.refunds[index];
  await fixture(`/refund/${refund.providerId}`, { id: Number(refund.providerId), transaction: test.transactionId, amount: refund.amount, currency: 'GHS', domain: 'test', status, ...overrides });
}
const hook = (test, event = 'refund.processed', extra = {}) => ({ event, data: { transaction_reference: test.reference, refund_reference: null, domain: 'test', ...extra } });
try {
  const deadline = Date.now() + 15000;
  while (!origin && !exited && !startupError && Date.now() < deadline) await delay(50);
  if (!origin || exited || startupError) throw new Error(`Isolated API startup failed: ${startupError || log}`);
  database = new DatabaseSync(databasePath);
  const signup = async ecoId => {
    const result = await request('/auth/register', { method: 'POST', body: { ecoId, displayName: 'Synthetic Payment Test', password: 'synthetic-password-test-only' } });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return { id: result.body.user.id, cookie: result.cookie, csrf: result.body.csrfToken };
  };
  buyer = await signup('refund.customer'); staff = await signup('refund.staff'); outsider = await signup('refund.outsider');
  database.prepare("INSERT INTO staff_access(user_id,staff_role,created_at) VALUES(?,'support_staff',?)").run(staff.id, new Date().toISOString());
  record('isolated HTTP API and account setup');

  const partial = await seed([2500, 7500]);
  await providerState(partial, 0, 'processed');
  let response = await webhook(hook(partial));
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(get('refunds', partial.refunds[0].id).status, 'refunded', 'The exact provider-confirmed refund must complete, not the newest order refund.');
  assert.equal(get('refunds', partial.refunds[1].id).status, 'provider_pending');
  assert.equal(get('orders', partial.order).payment_status, 'partially_refunded');
  assert.equal(get('payments', partial.payment).state, 'paid');
  record('exact refund matching and partial payment state');

  const notifications = count('notifications', 'user_id', buyer.id);
  const events = count('domain_events', 'aggregate_id', partial.refunds[0].id);
  assert.equal((await webhook(hook(partial))).status, 200);
  assert.equal((await webhook(hook(partial, 'refund.failed', { status: 'failed', id: 101 }))).status, 200);
  assert.equal(count('notifications', 'user_id', buyer.id), notifications);
  assert.equal(count('domain_events', 'aggregate_id', partial.refunds[0].id), events);
  record('duplicate and stale callbacks do not repeat ledger effects or notifications');
  await providerState(partial, 1, 'processed');
  assert.equal((await webhook(hook(partial))).status, 200);
  assert.equal(get('refunds', partial.refunds[1].id).status, 'refunded');
  assert.equal(get('orders', partial.order).payment_status, 'refunded');
  assert.equal(get('orders', partial.order).status, 'delivered');
  assert.equal(get('payments', partial.payment).state, 'refunded');
  record('identical callback bodies can wake a second partial refund safely');
  assert.equal((await webhook({ event: 'charge.success', data: { id: 101, reference: partial.reference } })).status, 200);
  assert.equal(get('orders', partial.order).payment_status, 'refunded');
  assert.equal(get('payments', partial.payment).state, 'refunded');
  record('charge replay cannot reopen a fully refunded order');

  const stages = await seed([10000]);
  assert.equal((await webhook(hook(stages, 'refund.pending', { id: 201 }))).status, 200);
  await providerState(stages, 0, 'needs-attention');
  assert.equal((await webhook(hook(stages, 'refund.needs-attention', { id: 201 }))).status, 200);
  assert.equal(get('refunds', stages.refunds[0].id).status, 'provider_pending');
  assert.equal(get('orders', stages.order).status, 'refund_requested');
  const stageEvents = count('domain_events', 'aggregate_id', stages.refunds[0].id);
  assert.equal((await webhook(hook(stages, 'refund.needs-attention', { id: 201 }))).status, 200);
  assert.equal(count('domain_events', 'aggregate_id', stages.refunds[0].id), stageEvents);
  record('needs-attention remains pending and records its transition once');
  await providerState(stages, 0, 'processed');
  assert.equal((await webhook(hook(stages, 'refund.processed', { id: 201 }))).status, 200);
  assert.equal(get('refunds', stages.refunds[0].id).status, 'refunded');
  record('pending and processed events sharing an ID do not collide');

  const denied = await seed([10000]);
  for (const signature of ['invalid', '0'.repeat(128)])
    assert.equal((await webhook(hook(denied), { 'x-paystack-signature': signature })).status, 401);
  assert.equal((await webhook(null)).status, 400);
  assert.equal(get('refunds', denied.refunds[0].id).status, 'provider_pending');
  record('invalid signatures and malformed signed payloads cannot mutate refunds');
  for (const [label, overrides] of Object.entries({ wrong_id: { id: 999999 }, wrong_transaction: { transaction: 999999 }, wrong_amount: { amount: 9999 }, unsafe_amount: { amount: 9007199254740992 }, wrong_currency: { currency: 'NGN' }, live_record: { domain: 'live' } })) {
    await providerState(denied, 0, 'processed', overrides);
    assert.equal((await webhook(hook(denied, 'refund.processed', { variant: label }))).status, 200);
    assert.equal(get('refunds', denied.refunds[0].id).status, 'provider_pending');
    assert.equal(get('orders', denied.order).payment_status, 'paid');
  }
  record('mismatched ID, transaction, amount, currency or live source is held for reconciliation');
  await providerState(denied, 0, 'processed');
  const verificationPath = `/transaction/verify/${denied.reference}`;
  const originalVerification = fixtures[`GET ${verificationPath}`];
  await fixture(verificationPath, { ...originalVerification.body.data, reference: 'wrong-reference' });
  assert.equal((await webhook(hook(denied, 'refund.processed', { variant: 'wrong-source-payment' }))).status, 200);
  assert.equal(get('refunds', denied.refunds[0].id).status, 'provider_pending');
  fixtures[`GET ${verificationPath}`] = originalVerification;
  await writeFile(fixturePath, JSON.stringify(fixtures));
  record('canonical transaction reference is independently verified');
  const sourcePath = `/refund/${denied.refunds[0].providerId}`, originalRefund = fixtures[`GET ${sourcePath}`];
  await fixture(sourcePath, null, 'GET', 503);
  const beforeFailure = database.prepare('SELECT COUNT(*) n FROM payment_webhook_events').get().n;
  assert.equal((await webhook(hook(denied))).status, 502);
  assert.equal(database.prepare('SELECT COUNT(*) n FROM payment_webhook_events').get().n, beforeFailure);
  assert.equal(get('refunds', denied.refunds[0].id).status, 'provider_pending');
  fixtures[`GET ${sourcePath}`] = originalRefund;
  await writeFile(fixturePath, JSON.stringify(fixtures));
  assert.equal((await webhook(hook(denied))).status, 200);
  assert.equal(get('refunds', denied.refunds[0].id).status, 'refunded');
  record('provider read failure rolls back event and permits a safe retry');

  const failed = await seed([10000]);
  await providerState(failed, 0, 'failed');
  assert.equal((await webhook(hook(failed, 'refund.failed'))).status, 200);
  assert.equal(get('refunds', failed.refunds[0].id).status, 'rejected');
  assert.equal(get('orders', failed.order).payment_status, 'paid');
  const failedQueue = await request('/staff/review/refunds', { account: staff });
  assert(failedQueue.body.some(row => row.id === failed.refunds[0].id && row.status === 'rejected'), 'Provider failures must stay in the staff queue.');
  await providerState(failed, 0, 'processed');
  assert.equal((await webhook(hook(failed, 'refund.failed'))).status, 200);
  assert.equal(get('refunds', failed.refunds[0].id).status, 'refunded');
  record('canonical provider state controls failed-to-processed reconciliation');

  const review = (test, account = staff, csrf = true) => request(`/staff/review/refunds/${test.refunds[0].id}`, { method: 'PATCH', account, csrf, body: { status: 'approved', note: 'Synthetic authorized staff review.' } });
  const approved = await seed([10000], ['requested']);
  assert.equal((await review(approved, outsider)).status, 403);
  assert.equal((await review(approved, staff, false)).status, 403);
  record('staff approval requires role and CSRF');
  await fixture('/refund', { id: Number(approved.refunds[0].providerId), refund_reference: 'processor-reference-is-not-api-id', transaction: { id: approved.transactionId, reference: approved.reference }, amount: 10000, currency: 'GHS', domain: 'test', status: 'pending' }, 'POST');
  assert.equal((await review(approved)).status, 200);
  assert.equal(get('refunds', approved.refunds[0].id).provider_reference, approved.refunds[0].providerId);
  assert.equal(get('refunds', approved.refunds[0].id).status, 'provider_pending');
  assert.equal((await review(approved)).status, 409);
  assert(database.prepare("SELECT 1 FROM audit_logs WHERE target_id=? AND action='REFUND_APPROVED'").get(approved.refunds[0].id));
  record('approval stores canonical API refund ID and cannot be repeated');
  await providerState(approved, 0, 'processed');
  const recheckPath = `/staff/review/refunds/${approved.refunds[0].id}/reconcile`;
  assert.equal((await request(recheckPath, { method: 'POST', body: {} })).status, 401);
  assert.equal((await request(recheckPath, { method: 'POST', body: {}, account: outsider })).status, 403);
  assert.equal((await request(recheckPath, { method: 'POST', body: {}, account: staff, csrf: false })).status, 403);
  const postCount = (await capture()).filter(call => call.method === 'POST').length;
  response = await request(recheckPath, { method: 'POST', body: {}, account: staff });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.outcome, 'refunds_reconciled');
  assert.equal(get('refunds', approved.refunds[0].id).status, 'refunded');
  assert.equal((await capture()).filter(call => call.method === 'POST').length, postCount);
  assert(database.prepare("SELECT 1 FROM audit_logs WHERE target_id=? AND action='REFUND_PROVIDER_RECHECKED'").get(approved.refunds[0].id));
  record('staff reconciliation is authorized, audited and only reads provider data');

  const uncertain = await seed([10000], ['requested']);
  fixtures['POST /refund'] = { throw: true };
  await writeFile(fixturePath, JSON.stringify(fixtures));
  const beforeUncertain = (await capture()).filter(call => call.method === 'POST').length;
  assert.equal((await review(uncertain)).status, 502);
  assert.equal(get('refunds', uncertain.refunds[0].id).status, 'approved');
  assert.match(get('refunds', uncertain.refunds[0].id).review_note, /do not submit another/i);
  assert.equal((await review(uncertain)).status, 409);
  assert.equal((await capture()).filter(call => call.method === 'POST').length, beforeUncertain + 1);
  assert(database.prepare("SELECT 1 FROM audit_logs WHERE target_id=? AND action='REFUND_CONFIRMATION_PENDING'").get(uncertain.refunds[0].id));
  assert.equal((await webhook(hook(uncertain))).status, 503);
  record('ambiguous submission stays claimed and cannot create duplicate refunds');

  const over = await seed([8000, 3000], ['provider_pending', 'requested']);
  response = await request(`/staff/review/refunds/${over.refunds[1].id}`, { method: 'PATCH', account: staff, body: { status: 'approved', note: 'Synthetic amount limit check.' } });
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'refund_exceeds_payment');
  assert.equal(get('refunds', over.refunds[1].id).status, 'requested');
  record('already reserved refunds prevent over-refunding at approval');
  const self = await seed([10000], ['requested']);
  database.prepare('UPDATE refunds SET requester_id=? WHERE id=?').run(staff.id, self.refunds[0].id);
  assert.equal((await review(self)).status, 403);
  record('staff cannot approve their own refund');

  const remaining = await seed([2500]);
  await providerState(remaining, 0, 'processed');
  assert.equal((await webhook(hook(remaining))).status, 200);
  assert.equal(get('orders', remaining.order).status, 'delivered');
  const requestPath = `/marketplace/orders/${remaining.order}/refund`;
  assert.equal((await request(requestPath, { method: 'POST', account: outsider, body: { reason: 'Synthetic ownership check' } })).status, 404);
  response = await request(requestPath, { method: 'POST', account: buyer, body: { reason: 'Request remaining test amount' } });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(get('refunds', response.body.id).amount_minor, 7500);
  assert.equal((await request(requestPath, { method: 'POST', account: buyer, body: { reason: 'Duplicate request test' } })).status, 409);
  record('customer requests use remaining amount and reject other accounts or duplicates');

  const repeatedId = await seed([4000, 6000]);
  database.prepare('UPDATE refunds SET provider_reference=? WHERE id=?').run(repeatedId.refunds[0].providerId, repeatedId.refunds[1].id);
  await providerState(repeatedId, 0, 'processed');
  assert.equal((await webhook(hook(repeatedId))).status, 200);
  assert.equal(get('orders', repeatedId.order).payment_status, 'paid');
  assert.equal(get('refunds', repeatedId.refunds[0].id).status, 'provider_pending');
  record('reused provider refund IDs cannot be counted twice');

  const invalidInit = await seed([10000], ['requested']);
  await fixture('/refund', { id: Number(invalidInit.refunds[0].providerId), transaction: { reference: invalidInit.reference }, amount: 10000, currency: 'GHS', domain: 'live' }, 'POST');
  assert.equal((await review(invalidInit)).status, 502);
  assert.equal(get('refunds', invalidInit.refunds[0].id).status, 'approved');
  assert.equal(get('refunds', invalidInit.refunds[0].id).provider_reference, null);
  record('unexpected live initialization response remains unresolved and held');

  const list = await request('/staff/review/refunds', { account: staff });
  assert.equal(list.status, 200);
  assert(list.body.some(row => row.id === uncertain.refunds[0].id && row.status === 'approved' && /uncertain/.test(row.review_note)));
  assert(list.body.every(row => row.currency === 'GHS' && !('provider_reference' in row)));
  record('staff queue includes reconciliation notes without provider references');

  const charge = await seed([]);
  database.prepare("UPDATE orders SET status='pending',payment_status='pending' WHERE id=?").run(charge.order);
  database.prepare("UPDATE payments SET state='pending' WHERE id=?").run(charge.payment);
  await fixture(`/transaction/verify/${charge.reference}`, { id: charge.transactionId, reference: charge.reference, amount: '10000', currency: 'GHS', domain: 'live', status: 'success' });
  const chargeHook = { event: 'charge.success', data: { id: charge.transactionId, reference: charge.reference } };
  assert.equal((await webhook(chargeHook)).status, 200);
  assert.equal(get('orders', charge.order).payment_status, 'pending');
  await fixture(`/transaction/verify/${charge.reference}`, { id: charge.transactionId, reference: charge.reference, amount: '10000', currency: 'GHS', domain: 'test', status: 'success' });
  assert.equal((await webhook({ ...chargeHook, data: { ...chargeHook.data, retry: 1 } })).status, 200);
  assert.equal(get('orders', charge.order).payment_status, 'paid');
  assert.equal(get('payments', charge.payment).state, 'paid');
  const paidNotices = count('notifications', 'user_id', buyer.id);
  assert.equal((await webhook({ ...chargeHook, data: { ...chargeHook.data, retry: 2 } })).status, 200);
  assert.equal(count('notifications', 'user_id', buyer.id), paidNotices);
  record('valid test charge still confirms once; live source cannot confirm a test order');

  const late = await seed([]);
  database.prepare("UPDATE orders SET status='cancelled',payment_status='unpaid' WHERE id=?").run(late.order);
  database.prepare("UPDATE payments SET state='pending' WHERE id=?").run(late.payment);
  const lateHook = { event: 'charge.success', data: { reference: late.reference } };
  assert.equal((await webhook(lateHook)).status, 200);
  assert.equal(get('orders', late.order).status, 'disputed');
  assert.equal(count('refunds', 'order_id', late.order), 1);
  assert.equal((await webhook({ ...lateHook, data: { ...lateHook.data, retry: true } })).status, 200);
  assert.equal(count('refunds', 'order_id', late.order), 1);
  record('late charge after cancellation creates one staff review request');
  console.log(`Paystack workflow: ${checks.length} checks passed (isolated SQLite; mocked provider; no live payments).`);
} finally {
  database?.close(); child.kill('SIGTERM');
  for (let i = 0; i < 50 && !exited; i++) await delay(50);
  if (!exited) child.kill('SIGKILL');
  await rm(temp, { recursive: true, force: true });
}
