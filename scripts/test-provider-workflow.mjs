import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';

// No application .env, hosted account or production database is loaded.
const temp = await mkdtemp(resolve(tmpdir(), 'ecovibes-provider-'));
const dbPath = resolve(temp, 'isolated.sqlite');
const port = Number(process.env.PROVIDER_TEST_PORT || 19106);
const origin = `http://127.0.0.1:${port}`;
const checkWeb = process.env.PROVIDER_TEST_SERVE_WEB === 'true';
let logs = '';
const child = spawn(process.execPath, ['server/index.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR || '/tmp', NODE_ENV: 'test',
    PORT: String(port), ECOVIBES_DB_PATH: dbPath, APP_ORIGINS: origin, DATABASE_URL: '', SUPABASE_URL: '', OPENAI_ENV_FILE: '',
    ECOVIBES_SERVE_WEB: checkWeb ? 'true' : 'false' },
  stdio: ['ignore','pipe','pipe'],
});
child.stdout.on('data', part => { logs += part; }); child.stderr.on('data', part => { logs += part; });
let db;
let checks = 0;
async function request(path, {method = 'GET', account, body, csrf = true, requestOrigin = origin} = {}) {
  const response = await fetch(`${origin}/api/v1${path}`, { method, signal: AbortSignal.timeout(5000), headers: {
    Origin: requestOrigin, 'Content-Type': 'application/json',
    ...(account ? { Cookie: account.cookie } : {}), ...(account && csrf ? {'X-CSRF-Token': account.csrf} : {}),
  }, ...(body ? {body: JSON.stringify(body)} : {}) });
  return {status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0]};
}
async function expect(path, options, status = 200) {
  const response = await request(path, options);
  assert.equal(response.status, status, `${path}: ${JSON.stringify(response.data)}`);
  checks++;
  return response.data;
}
async function signup(ecoId) {
  const response = await request('/auth/register', {method:'POST', body:{ecoId,displayName:ecoId,password:'Synthetic-test-password-123'}});
  assert.equal(response.status, 200);
  return {id:response.data.user.id, cookie:response.cookie, csrf:response.data.csrfToken};
}
const value = {name:'Test cleaning service',providerType:'business',category:'Cleaning',service:'Home cleaning',area:'Tema',description:'Synthetic provider test. Household cleaning by appointment.',priceMinor:12000,pricing:'quote',countryCode:'GH'};
try {
  let ready = false;
  for(let i=0;i<60;i++) {
    if(child.exitCode !== null) throw new Error(`API exited: ${logs}`);
    try { ready = (await request('/health')).status === 200; } catch {}
    if(ready) break;
    await delay(100);
  }
  assert(ready, `Isolated API did not start: ${logs}`);
  if (checkWeb) {
    const page = await fetch(origin, { signal: AbortSignal.timeout(5000) });
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
    assert.match(await page.text(), /<div id="root">/);
    checks++;
    const missing = await fetch(`${origin}/assets/not-a-built-file.js`, { signal: AbortSignal.timeout(5000) });
    assert.equal(missing.status, 404); checks++;
    const privateFile = await fetch(`${origin}/.env`, { signal: AbortSignal.timeout(5000) });
    assert.equal(privateFile.status, 404); checks++;
    const apiResponse = await fetch(`${origin}/api/v1/auth/me`, { signal: AbortSignal.timeout(5000) });
    assert.match(apiResponse.headers.get('content-type'), /application\/json/);
    assert.equal(apiResponse.headers.get('cache-control'), 'no-store'); checks++;
    const webWrite = await fetch(origin, { method: 'POST', signal: AbortSignal.timeout(5000) });
    assert.equal(webWrite.status, 405); checks++;
  }
  db = new DatabaseSync(dbPath);
  const owner = await signup('provider.owner');
  const other = await signup('provider.other');
  const staff = await signup('provider.staff');
  db.prepare("INSERT INTO staff_access(user_id,staff_role,created_at) VALUES(?,'trust_staff',?)").run(staff.id,new Date().toISOString());
  await expect('/providers/me', {}, 401);
  await expect('/providers/me',{method:'PUT',body:value},401);
  await expect('/providers/me',{method:'PUT',body:value,account:owner,csrf:false},403);
  await expect('/providers/me',{method:'PUT',body:value,account:owner,requestOrigin:'https://untrusted.example'},403);
  await expect('/providers/me',{method:'PUT',body:{...value,priceMinor:-1},account:owner},400);
  await expect('/providers/me',{method:'PUT',body:{...value,category:'invented'},account:owner},400);
  await expect('/providers/me',{method:'PUT',body:{...value,countryCode:'XX'},account:owner},400);
  let saved = await expect('/providers/me',{method:'PUT',body:{...value,userId:other.id,verificationState:'approved'},account:owner});
  assert.equal(saved.profile.id,owner.id); assert.equal(saved.profile.verificationState,'unverified');
  assert.equal((await expect('/providers/me',{account:other})).profile,null);
  assert.deepEqual((await expect('/providers')).providers,[]);
  await expect('/identity/roles',{method:'POST',account:owner,body:{role:'seller'}});
  const job = await expect('/jobs',{method:'POST',account:other,body:{category:'Cleaning',title:'Clean test room',description:'Synthetic job for checking eligibility.',area:'Tema',budgetMinor:14000,timing:'asap'}});
  const offerBody={amountMinor:13000,note:'Synthetic quote for cleaning.',eta:'Tomorrow'};
  await expect(`/jobs/${job.id}/offers`,{method:'POST',account:owner,body:offerBody},403);
  let submitted = await expect('/providers/me/submit',{method:'POST',account:owner,body:{evidenceNote:'Synthetic private review evidence.'}});
  const duplicate = await expect('/providers/me/submit',{method:'POST',account:owner,body:{evidenceNote:'Synthetic private review evidence.'}});
  assert.equal(submitted.verification.id,duplicate.verification.id);
  await expect(`/staff/review/verifications/${submitted.verification.id}`,{method:'PATCH',account:owner,body:{status:'approved',note:'Attempted self approval.'}},403);
  const queue = await expect('/staff/review/verifications',{account:staff});
  assert.equal(queue[0].target_role,'provider'); assert.equal(JSON.parse(queue[0].profile_details).service,value.service);
  await expect(`/staff/review/verifications/${submitted.verification.id}`,{method:'PATCH',account:staff,body:{status:'approved',note:'Synthetic verification completed.'}});
  assert.equal(db.prepare('SELECT verification_state FROM seller_profiles WHERE user_id=?').get(owner.id).verification_state,'unverified');
  const listed = await expect('/providers');
  assert.equal(listed.providers.length,1);
  assert(!JSON.stringify(listed).includes('evidence')); assert(!JSON.stringify(listed).includes('password'));
  const offer = await expect(`/jobs/${job.id}/offers`,{method:'POST',account:owner,body:offerBody});
  const offerId = offer.offers.find(item=>item.provider_id===owner.id)?.id || offer.offers[0].id;
  saved = await expect('/providers/me',{method:'PUT',account:owner,body:{...value,area:'Accra'}});
  assert.equal(saved.profile.verificationState,'unverified');
  assert.deepEqual((await expect('/providers')).providers,[]);
  await expect(`/jobs/${job.id}/offers/${offerId}/select`,{method:'POST',account:other,body:{}},409);
  submitted = await expect('/providers/me/submit',{method:'POST',account:owner,body:{evidenceNote:'Synthetic resubmission after change.'}});
  await expect('/providers/me',{method:'PUT',account:owner,body:{...value,area:'Cape Coast'}});
  await expect(`/staff/review/verifications/${submitted.verification.id}`,{method:'PATCH',account:staff,body:{status:'approved',note:'Stale snapshot must be rejected.'}},404);
  await expect('/identity/profiles',{method:'PATCH',account:owner,body:{profile:'provider',businessName:'Bypass',serviceArea:'Tema'}},409);
  await expect('/trust/verifications',{method:'POST',account:owner,body:{businessType:'Company',evidenceNote:'Ambiguous verification must not approve both.'}},400);
  submitted = await expect('/providers/me/submit',{method:'POST',account:owner,body:{evidenceNote:'Current profile reviewed again.'}});
  await expect(`/staff/review/verifications/${submitted.verification.id}`,{method:'PATCH',account:staff,body:{status:'approved',note:'Current profile verified for test.'}});
  await expect(`/jobs/${job.id}/offers/${offerId}/select`,{method:'POST',account:other,body:{}});
  await expect(`/jobs/${job.id}/offers/${offerId}/select`,{method:'POST',account:other,body:{}},409);
  db.prepare("UPDATE users SET status='suspended' WHERE id=?").run(owner.id);
  assert.deepEqual((await expect('/providers')).providers,[]);
  assert(db.prepare("SELECT COUNT(*) n FROM audit_logs WHERE action='VERIFICATION_APPROVED'").get().n>=2);
  console.log(`PASS: ${checks} provider workflow checks. Isolated SQLite, synthetic users, real HTTP routes. Hosted Auth/Postgres/MFA not covered.`);
} finally {
  db?.close(); child.kill('SIGTERM');
  await Promise.race([new Promise(done=>child.once('exit',done)),delay(3000)]);
  if(child.exitCode===null) child.kill('SIGKILL');
  await rm(temp,{recursive:true,force:true});
}
