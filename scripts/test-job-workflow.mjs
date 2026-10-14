import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

// No application .env, hosted account or production database is loaded.
const temp = await mkdtemp(resolve(tmpdir(), 'ecovibes-jobs-'));
const dbPath = resolve(temp, 'isolated.sqlite');
const port = Number(process.env.JOBS_TEST_PORT || 19109);
const origin = `http://127.0.0.1:${port}`;
let logs = '';
const child = spawn(process.execPath, ['server/index.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR || '/tmp', NODE_ENV: 'test',
    PORT: String(port), ECOVIBES_DB_PATH: dbPath, APP_ORIGINS: origin, DATABASE_URL: '', SUPABASE_URL: '', OPENAI_ENV_FILE: '',
    ECOVIBES_SERVE_WEB: 'false' },
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
// Fixtures are synthetic and seed only this disposable database.
function fixture(status = 'assigned', assigned = true) {
  const jobId = randomUUID(), stamp = new Date().toISOString();
  db.prepare("INSERT INTO jobs(id,customer_id,category,title,description,area,budget_minor,timing,status,assigned_provider_id,created_at,updated_at) VALUES(?,?,'Cleaning','Synthetic cleaning job','Only for local workflow checks','Tema',14000,'asap',?,?,?,?)")
    .run(jobId, customer.id, status, assigned ? provider.id : null, stamp, stamp);
  return jobId;
}
function snapshot(jobId) {
  return {
    job: db.prepare('SELECT * FROM jobs WHERE id=?').get(jobId),
    reports: db.prepare('SELECT * FROM support_reports WHERE target_id=? ORDER BY id').all(jobId),
    events: db.prepare('SELECT * FROM domain_events WHERE aggregate_id=? ORDER BY id').all(jobId),
    audit: db.prepare('SELECT * FROM audit_logs WHERE target_id=? ORDER BY id').all(jobId),
    notifications: db.prepare('SELECT * FROM notifications WHERE target_id=? ORDER BY id').all(jobId),
    learning: db.prepare('SELECT * FROM recommendation_activity_signals WHERE item_id=? ORDER BY user_id,topic').all(jobId),
  };
}
const act = (jobId, action, account, body = {}) => ({path: `/jobs/${jobId}/${action}`, options: {method: 'POST', account, body}});
async function transition(jobId, action, account, status = 200, body = {}) {
  const call = act(jobId, action, account, body);
  return expect(call.path, call.options, status);
}
let customer, provider, outsider, staff;
try {
  let ready = false;
  for(let i=0;i<60;i++) {
    if(child.exitCode !== null) throw new Error(`API exited: ${logs}`);
    try { ready = (await request('/health')).status === 200; } catch {}
    if(ready) break;
    await delay(100);
  }
  assert(ready, `Isolated API did not start: ${logs}`);
  db = new DatabaseSync(dbPath);
  customer = await signup('jobs.customer'); provider = await signup('jobs.provider');
  outsider = await signup('jobs.outsider'); staff = await signup('jobs.staff');
  db.prepare("INSERT INTO staff_access(user_id,staff_role,created_at) VALUES(?,'support_staff',?)").run(staff.id,new Date().toISOString());
  const jobId = fixture();
  await transition(jobId,'start',undefined,401);
  const start = act(jobId,'start',provider);
  await expect(start.path,{...start.options,csrf:false},403);
  await expect(start.path,{...start.options,requestOrigin:'https://untrusted.example'},403);
  await transition(jobId,'start',customer,403);
  await transition(jobId,'start',outsider,403);
  await transition(jobId,'start',staff,403);
  await transition(jobId,'complete',customer,409);
  await transition(jobId,'finish',provider,409);
  await transition(jobId,'dispute',customer,409,{reason:'Synthetic issue'});

  // Regression: a failed audit write must roll back the job and domain event.
  const beforeStart = snapshot(jobId);
  db.exec("CREATE TRIGGER fail_job_audit BEFORE INSERT ON audit_logs WHEN NEW.action='JOB_IN_PROGRESS' BEGIN SELECT RAISE(ABORT,'Synthetic audit failure'); END");
  await transition(jobId,'start',provider,500);
  assert.deepEqual(snapshot(jobId),beforeStart,'Failed audit must not leave a partially started job'); checks++;
  db.exec('DROP TRIGGER fail_job_audit');
  db.exec("CREATE TRIGGER fail_job_notification BEFORE INSERT ON notifications WHEN NEW.type='job' BEGIN SELECT RAISE(ABORT,'Synthetic notification failure'); END");
  await transition(jobId,'start',provider,500);
  assert.deepEqual(snapshot(jobId),beforeStart,'Failed notification must roll back job, domain event and audit'); checks++;
  db.exec('DROP TRIGGER fail_job_notification');
  assert.equal((await transition(jobId,'start',provider)).status,'in_progress');
  await transition(jobId,'start',provider,409);
  await transition(jobId,'cancel',customer,409);
  await transition(jobId,'finish',customer,403);
  await transition(jobId,'dispute',outsider,403,{reason:'Synthetic issue'});
  await transition(jobId,'dispute',staff,403,{reason:'Synthetic issue'});
  await transition(jobId,'dispute',customer,400,{reason:'bad'});
  assert.equal((await transition(jobId,'finish',provider)).status,'awaiting_customer');
  await transition(jobId,'complete',provider,403);
  await transition(jobId,'finish',provider,409);

  // Completion signals must roll back too, for both opted-in participants.
  for(const account of [customer,provider]) db.prepare('INSERT INTO recommendation_settings(user_id,personalization_enabled,updated_at) VALUES(?,1,?) ON CONFLICT(user_id) DO UPDATE SET personalization_enabled=1').run(account.id,new Date().toISOString());
  const beforeComplete = snapshot(jobId);
  db.exec("CREATE TRIGGER fail_job_completion BEFORE INSERT ON audit_logs WHEN NEW.action='JOB_COMPLETED' BEGIN SELECT RAISE(ABORT,'Synthetic completion failure'); END");
  await transition(jobId,'complete',customer,500);
  assert.deepEqual(snapshot(jobId),beforeComplete,'Failed completion must roll back recommendation signals'); checks++;
  db.exec('DROP TRIGGER fail_job_completion');
  assert.equal((await transition(jobId,'complete',customer)).status,'completed');
  const completed = snapshot(jobId);
  assert(completed.learning.length > 0); checks++;
  await transition(jobId,'complete',customer,409);
  assert.deepEqual(snapshot(jobId),completed); checks++;

  // A dispute and its support case must be committed together, or neither.
  const beforeDispute = snapshot(jobId);
  db.exec("CREATE TRIGGER fail_job_dispute BEFORE INSERT ON audit_logs WHEN NEW.action='JOB_DISPUTED' BEGIN SELECT RAISE(ABORT,'Synthetic dispute failure'); END");
  await transition(jobId,'dispute',provider,500,{reason:'Synthetic issue reported after completion.'});
  assert.deepEqual(snapshot(jobId),beforeDispute,'Failed dispute must not leave a support case or changed state'); checks++;
  db.exec('DROP TRIGGER fail_job_dispute');
  assert.equal((await transition(jobId,'dispute',provider,200,{reason:'Synthetic issue reported after completion.'})).status,'disputed');
  const disputed = snapshot(jobId);
  assert.equal(disputed.reports.length,1);
  assert.equal(disputed.reports[0].reporter_id,provider.id); checks++;
  await transition(jobId,'dispute',customer,409,{reason:'Duplicate issue should not create another case.'});
  await transition(jobId,'complete',customer,409);
  assert.deepEqual(snapshot(jobId),disputed); checks++;

  for(const status of ['open','assigned']) {
    const cancellable = fixture(status,status==='assigned');
    await transition(cancellable,'cancel',provider,403);
    assert.equal((await transition(cancellable,'cancel',customer)).status,'cancelled');
    await transition(cancellable,'cancel',customer,409);
    await transition(cancellable,'start',provider,status==='assigned'?409:403);
  }
  // Parallel HTTP arrivals are serialized by the local database; no claim of a
  // hosted Postgres multi-process test follows from these checks.
  const concurrent = fixture();
  const [one,two] = await Promise.all([request(`/jobs/${concurrent}/start`,{method:'POST',account:provider,body:{}}),request(`/jobs/${concurrent}/cancel`,{method:'POST',account:customer,body:{}})]);
  assert.deepEqual([one.status,two.status].sort(),[200,409]); checks++;
  const raced = snapshot(concurrent);
  assert.equal(raced.events.length,1); assert.equal(raced.audit.length,1); checks++;
  const disputedRace = fixture('in_progress');
  const attempts = await Promise.all([customer,provider].map(account=>request(`/jobs/${disputedRace}/dispute`,{method:'POST',account,body:{reason:'Concurrent synthetic dispute report.'}})));
  assert.deepEqual(attempts.map(item=>item.status).sort(),[200,409]); checks++;
  const raceCase = snapshot(disputedRace);
  assert.equal(raceCase.reports.length,1); assert.equal(raceCase.events.length,1); assert.equal(raceCase.audit.length,1); checks++;
  console.log(`PASS: ${checks} job workflow checks. Isolated SQLite, synthetic fixtures, real HTTP routes. Hosted Postgres contention/Auth/MFA not covered.`);
} finally {
  db?.close(); child.kill('SIGTERM');
  await Promise.race([new Promise(done=>child.once('exit',done)),delay(3000)]);
  if(child.exitCode===null) child.kill('SIGKILL');
  await rm(temp,{recursive:true,force:true});
}
