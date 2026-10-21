import assert from 'node:assert/strict';

// Read-only, anonymous checks. No .env, credentials, inference or test records.
const target = new URL(process.argv[2] || 'https://ecovibes-api.onrender.com');
assert(target.protocol === 'https:' && !target.username && !target.password && target.pathname === '/' && !target.search && !target.hash,
  'Supply an HTTPS origin without credentials, a path or query.');
let checks = 0;
async function get(path, expected = 200) {
  const response = await fetch(new URL(path, target), {
    redirect: 'manual', signal: AbortSignal.timeout(60_000),
    headers: { Accept: path === '/' ? 'text/html' : 'application/json' },
  });
  assert.equal(response.status, expected, `${path}: unexpected HTTP status`);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff', `${path}: missing nosniff`);
  assert(response.headers.get('strict-transport-security')?.includes('max-age='), `${path}: missing HTTPS policy`);
  checks++;
  return response;
}
try {
  const health = await (await get('/api/v1/health')).json();
  assert.equal(health.status, 'ok');
  assert.equal(health.database, 'postgres', 'Hosted API must use durable Postgres');
  const page = await get('/');
  assert(page.headers.get('content-type')?.includes('text/html'));
  assert(page.headers.get('content-security-policy'), 'Web CSP required');
  assert((await page.text()).includes('id="root"'), 'Missing app shell');
  const me = await (await get('/api/v1/auth/me')).json();
  assert.equal(me.user, null, 'Anonymous request must not inherit an account');
  const directory = await (await get('/api/v1/providers')).json();
  assert(Array.isArray(directory.providers));
  assert(directory.providers.every(p => p.verificationState === 'approved'));
  for (const path of ['/api/v1/providers/me', '/api/v1/staff/review/verifications']) {
    const denied = await (await get(path, 401)).json();
    assert(denied.error?.code, `${path}: expected a structured denial`);
  }
  await get('/assets/ecovibes-release-check-missing.js', 404);
  // Non-public API paths pass through authentication before route lookup.
  const missing = await (await get('/api/v1/ecovibes-release-check-missing', 401)).json();
  assert.equal(missing.error?.code, 'sign_in_required', 'Unknown protected paths must remain structured authentication denials');
  console.log(`PASS: ${checks} anonymous hosted checks. Sign-in, staff MFA, ownership, storage, payment callbacks/refunds and real AI still require separate verification.`);
} catch (error) {
  console.error(`FAIL after ${checks} hosted checks: ${error instanceof Error ? error.message : 'Request failed'}`);
  process.exitCode = 1;
}
