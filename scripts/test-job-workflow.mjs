import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';

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
function postingSnapshot(account) {
  return {
    jobs: db.prepare('SELECT * FROM jobs WHERE customer_id=? ORDER BY id').all(account.id),
    events: db.prepare("SELECT * FROM domain_events WHERE actor_id=? AND event_type='JOB_POSTED' ORDER BY id").all(account.id),
    audit: db.prepare("SELECT * FROM audit_logs WHERE actor_id=? AND action='JOB_POSTED' ORDER BY id").all(account.id),
  };
}
function conversationSnapshot(jobId) {
  return {
    job: db.prepare('SELECT * FROM jobs WHERE id=?').get(jobId),
    messages: db.prepare('SELECT * FROM job_messages WHERE job_id=? ORDER BY id').all(jobId),
    // Include all message events/audits so an orphan event cannot hide behind
    // a join to a message row that has already been rolled back.
    events: db.prepare("SELECT * FROM domain_events WHERE event_type='MESSAGE_SENT' ORDER BY id").all(),
    audit: db.prepare("SELECT * FROM audit_logs WHERE action='MESSAGE_SENT' ORDER BY id").all(),
    notifications: db.prepare("SELECT * FROM notifications WHERE type='message' ORDER BY id").all(),
    limits: db.prepare('SELECT * FROM rate_limit_buckets ORDER BY bucket_key').all(),
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

  // Posting must commit the job and both records of its origin together.
  // Removing that transaction leaves an open job after an HTTP 500.
  const postBody = { title: 'Synthetic atomically posted job', description: 'Only for local job-posting failure checks.',
    category: 'Cleaning', area: 'Tema', budgetMinor: 14000, timing: 'asap' };
  const postingBefore = postingSnapshot(customer), outsiderBefore = postingSnapshot(outsider);
  const post = { method: 'POST', account: customer, body: postBody };
  await expect('/jobs', { ...post, account: undefined }, 401);
  await expect('/jobs', { ...post, csrf: false }, 403);
  await expect('/jobs', { ...post, requestOrigin: 'https://untrusted.example' }, 403);
  assert.deepEqual(postingSnapshot(customer), postingBefore); checks++;

  db.exec("CREATE TRIGGER fail_posted_job_audit BEFORE INSERT ON audit_logs WHEN NEW.action='JOB_POSTED' BEGIN SELECT RAISE(ABORT,'Synthetic posting audit failure'); END");
  await expect('/jobs', post, 500);
  assert.deepEqual(postingSnapshot(customer), postingBefore, 'A failed posting audit must not leave a job or domain event'); checks++;
  db.exec('DROP TRIGGER fail_posted_job_audit');
  db.exec("CREATE TRIGGER fail_posted_job_event BEFORE INSERT ON domain_events WHEN NEW.event_type='JOB_POSTED' BEGIN SELECT RAISE(ABORT,'Synthetic posting event failure'); END");
  await expect('/jobs', post, 500);
  assert.deepEqual(postingSnapshot(customer), postingBefore, 'A failed posting event must not leave an unaudited job'); checks++;
  db.exec('DROP TRIGGER fail_posted_job_event');
  db.exec("CREATE TRIGGER fail_posted_job_insert BEFORE INSERT ON jobs BEGIN SELECT RAISE(ABORT,'Synthetic job insertion failure'); END");
  await expect('/jobs', post, 500);
  assert.deepEqual(postingSnapshot(customer), postingBefore); checks++;
  db.exec('DROP TRIGGER fail_posted_job_insert');

  const posted = await expect('/jobs', { ...post, body: { ...postBody, customerId: outsider.id,
    customer_id: outsider.id, assignedProviderId: provider.id, status: 'completed' } });
  assert.equal(posted.customer_eco_id, 'jobs.customer'); assert.equal(posted.status, 'open');
  assert.equal(posted.assigned_provider_eco_id, null);
  assert(!('customer_id' in posted)); assert(!('assigned_provider_id' in posted));
  const postingAfter = postingSnapshot(customer);
  assert.equal(postingAfter.jobs.length - postingBefore.jobs.length, 1);
  assert.equal(postingAfter.events.length - postingBefore.events.length, 1);
  assert.equal(postingAfter.audit.length - postingBefore.audit.length, 1);
  assert.equal(postingAfter.jobs[0].customer_id, customer.id);
  assert.equal(postingAfter.jobs[0].assigned_provider_id, null);
  assert.equal(postingAfter.events[0].aggregate_id, posted.id);
  assert.equal(postingAfter.audit[0].target_id, posted.id);
  assert.deepEqual(postingSnapshot(outsider), outsiderBefore); checks++;
  assert.equal((await expect(`/jobs/${posted.id}`, { account: customer })).id, posted.id);
  assert((await expect('/jobs', { account: customer })).some(item => item.id === posted.id)); checks++;

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
  // A failed send must commit none of the message, event, audit or notification.
  const conversation = fixture(), closedConversation = fixture('cancelled');
  const messagePath = `/jobs/${conversation}/messages`;
  const send = {method:'POST',account:customer,body:{body:'Synthetic private coordination message.'}};
  const beforeMessage = conversationSnapshot(conversation);
  await expect(messagePath,{...send,account:undefined},401);
  await expect(messagePath,{...send,csrf:false},403);
  await expect(messagePath,{...send,requestOrigin:'https://untrusted.example'},403);
  await expect(messagePath,{...send,account:outsider},404);
  await expect(messagePath,{...send,account:staff},404);
  await expect(`/jobs/${randomUUID()}/messages`,send,404);
  await expect(messagePath,{...send,body:{body:''}},400);
  await expect(`/jobs/${closedConversation}/messages`,send,409);
  await expect(`/jobs/${closedConversation}/messages`,{...send,account:provider},409);
  assert.deepEqual(conversationSnapshot(conversation),beforeMessage); checks++;

  for(const [name,sql] of [
    ['message_audit',"CREATE TRIGGER fail_message_audit BEFORE INSERT ON audit_logs WHEN NEW.action='MESSAGE_SENT' BEGIN SELECT RAISE(ABORT,'Synthetic message audit failure'); END"],
    ['message_event',"CREATE TRIGGER fail_message_event BEFORE INSERT ON domain_events WHEN NEW.event_type='MESSAGE_SENT' BEGIN SELECT RAISE(ABORT,'Synthetic message event failure'); END"],
    ['message_notification',"CREATE TRIGGER fail_message_notification BEFORE INSERT ON notifications WHEN NEW.type='message' BEGIN SELECT RAISE(ABORT,'Synthetic message notification failure'); END"],
    ['message_insert',"CREATE TRIGGER fail_message_insert BEFORE INSERT ON job_messages BEGIN SELECT RAISE(ABORT,'Synthetic message insert failure'); END"],
  ]) {
    db.exec(sql);
    await expect(messagePath,send,500);
    assert.deepEqual(conversationSnapshot(conversation),beforeMessage,`Failed ${name} must roll back the whole send`); checks++;
    db.exec(`DROP TRIGGER fail_${name}`);
  }
  const sent = await expect(messagePath,{...send,body:{...send.body,senderId:outsider.id,
    sender_id:outsider.id,jobId:closedConversation,recipientId:outsider.id}});
  assert.equal(sent.messages.length,1);
  assert.equal(sent.messages[0].body,send.body.body);
  assert.equal(sent.messages[0].sender_eco_id,'jobs.customer');
  assert(!('sender_id' in sent.messages[0])); checks++;
  const committedMessage = conversationSnapshot(conversation);
  assert.equal(committedMessage.messages[0].sender_id,customer.id);
  assert.equal(committedMessage.messages.length,1);
  assert.equal(committedMessage.events.length-beforeMessage.events.length,1);
  assert.equal(committedMessage.audit.length-beforeMessage.audit.length,1);
  assert.equal(committedMessage.notifications.length-beforeMessage.notifications.length,1);
  assert.equal(committedMessage.events[0].aggregate_id,committedMessage.messages[0].id);
  assert.equal(committedMessage.audit[0].target_id,committedMessage.messages[0].id);
  assert.equal(committedMessage.notifications[0].user_id,provider.id);
  assert.equal(committedMessage.notifications[0].target_id,conversation);
  assert.deepEqual(JSON.parse(committedMessage.events[0].details_json),{jobId:conversation});
  assert(!committedMessage.notifications[0].body.includes(send.body.body));
  assert.equal(db.prepare('SELECT count(*) n FROM job_messages WHERE job_id=?').get(closedConversation).n,0); checks++;

  const reply = await expect(messagePath,{method:'POST',account:provider,body:{body:'Synthetic reply from the assigned provider.'}});
  assert.equal(reply.messages.length,2);
  assert(reply.messages.some(item=>item.sender_eco_id==='jobs.provider'));
  assert(reply.messages.every(item=>!('sender_id' in item)));
  const afterReply=conversationSnapshot(conversation);
  assert.equal(afterReply.events.length,2); assert.equal(afterReply.audit.length,2);
  assert.equal(afterReply.notifications.filter(item=>item.user_id===customer.id&&item.target_id===conversation).length,1); checks++;
  for(const account of [customer,provider]) {
    const visible = await expect(`/jobs/${conversation}`,{account});
    assert.equal(visible.messages.length,2); checks++;
  }
  for(const account of [outsider,staff]) await expect(`/jobs/${conversation}`,{account},404);

  // Local concurrent arrivals exercise allowed ordering, not hosted PG locking.
  const cancelRace=fixture(),raceBefore=conversationSnapshot(cancelRace);
  const [messageAttempt,cancelAttempt]=await Promise.all([
    request(`/jobs/${cancelRace}/messages`,{method:'POST',account:provider,body:{body:'Synthetic send racing cancellation.'}}),
    request(`/jobs/${cancelRace}/cancel`,{method:'POST',account:customer,body:{}}),
  ]);
  assert.equal(cancelAttempt.status,200);
  assert([200,409].includes(messageAttempt.status));
  const raceAfter=conversationSnapshot(cancelRace),accepted=messageAttempt.status===200?1:0;
  assert.equal(raceAfter.job.status,'cancelled');
  assert.equal(raceAfter.messages.length,accepted);
  assert.equal(raceAfter.events.length-raceBefore.events.length,accepted);
  assert.equal(raceAfter.audit.length-raceBefore.audit.length,accepted);
  assert.equal(raceAfter.notifications.length-raceBefore.notifications.length,accepted); checks++;
  await expect(`/jobs/${cancelRace}/messages`,{method:'POST',account:provider,body:{body:'Too late after cancellation.'}},409);
  assert.deepEqual(conversationSnapshot(cancelRace),raceAfter); checks++;

  // Removing the account-wide send limit permits unbounded message/notice spam.
  // Use the real HTTP route; expire only synthetic buckets rather than sleeping.
  db.exec('DELETE FROM rate_limit_buckets');
  const limitedJob=fixture(),anotherJob=fixture();
  const limitedPath=`/jobs/${limitedJob}/messages`;
  const limitedSend={method:'POST',account:customer,body:{body:'Synthetic bounded job message.'}};
  const beforeInvalid=conversationSnapshot(limitedJob);
  await expect(limitedPath,{...limitedSend,account:outsider},404);
  await expect(limitedPath,{...limitedSend,account:staff},404);
  await expect(limitedPath,{...limitedSend,csrf:false},403);
  await expect(limitedPath,{...limitedSend,body:{body:''}},400);
  assert.deepEqual(conversationSnapshot(limitedJob),beforeInvalid,'Denied or invalid sends must not consume a message allowance'); checks++;
  for(let n=0;n<20;n++) await expect(limitedPath,limitedSend);
  const atLimit=conversationSnapshot(limitedJob);
  assert.equal(atLimit.messages.length,20); checks++;
  const blocked=await request(limitedPath,limitedSend);
  assert.equal(blocked.status,429,'The twenty-first send in one minute must be denied');
  assert.equal(blocked.data.error.code,'message_rate_limited'); checks++;
  assert.deepEqual(conversationSnapshot(limitedJob),atLimit,'A throttled send must create no message, event, audit or notification'); checks++;
  const otherJobBefore=conversationSnapshot(anotherJob);
  await expect(`/jobs/${anotherJob}/messages`,limitedSend,429);
  await expect(`/jobs/${anotherJob}/messages`,{...limitedSend,body:{body:'Synthetic spoofed identity.',senderId:outsider.id,userId:outsider.id}},429);
  assert.deepEqual(conversationSnapshot(anotherJob),otherJobBefore,'Changing jobs or claimed sender must not bypass the account allowance'); checks++;
  await expect(limitedPath,{...limitedSend,account:provider});
  assert.equal(db.prepare('SELECT count(*) n FROM job_messages WHERE job_id=? AND sender_id=?').get(limitedJob,provider.id).n,1); checks++;
  const customerBucket=createHash('sha256').update(`ecovibes:rate-limit:job-message:${customer.id}`).digest('hex');
  const providerBucket=createHash('sha256').update(`ecovibes:rate-limit:job-message:${provider.id}`).digest('hex');
  const providerBudget=db.prepare('SELECT * FROM rate_limit_buckets WHERE bucket_key=?').get(providerBucket);
  assert.equal(providerBudget?.hits,1); checks++;
  db.prepare('UPDATE rate_limit_buckets SET expires_at=? WHERE bucket_key=?').run('2000-01-01T00:00:00.000Z',customerBucket);
  await expect(`/jobs/${anotherJob}/messages`,limitedSend);
  assert.equal(db.prepare('SELECT hits FROM rate_limit_buckets WHERE bucket_key=?').get(customerBucket).hits,1);
  assert.deepEqual(db.prepare('SELECT * FROM rate_limit_buckets WHERE bucket_key=?').get(providerBucket),providerBudget); checks++;
  db.prepare('UPDATE rate_limit_buckets SET hits=19 WHERE bucket_key=?').run(customerBucket);
  const beforeShared=conversationSnapshot(limitedJob);
  const otherMessagesBefore=db.prepare('SELECT count(*) n FROM job_messages WHERE job_id=?').get(anotherJob).n;
  const shared=await Promise.all([request(limitedPath,limitedSend),request(`/jobs/${anotherJob}/messages`,limitedSend)]);
  assert.deepEqual(shared.map(item=>item.status).sort(),[200,429]);
  const afterShared=conversationSnapshot(limitedJob);
  const otherMessagesAfter=db.prepare('SELECT count(*) n FROM job_messages WHERE job_id=?').get(anotherJob).n;
  assert.equal(afterShared.messages.length-beforeShared.messages.length+otherMessagesAfter-otherMessagesBefore,1);
  assert.equal(afterShared.events.length-beforeShared.events.length,1);
  assert.equal(afterShared.audit.length-beforeShared.audit.length,1);
  assert.equal(afterShared.notifications.length-beforeShared.notifications.length,1);
  assert.equal(db.prepare('SELECT hits FROM rate_limit_buckets WHERE bucket_key=?').get(customerBucket).hits,20); checks++;
  await expect(limitedPath,limitedSend,429);
  assert.deepEqual(conversationSnapshot(limitedJob),afterShared); checks++;
  console.log(`PASS: ${checks} job workflow checks. Isolated SQLite, synthetic fixtures, real HTTP routes. Hosted Postgres contention/Auth/MFA not covered.`);
} finally {
  db?.close(); child.kill('SIGTERM');
  await Promise.race([new Promise(done=>child.once('exit',done)),delay(3000)]);
  if(child.exitCode===null) child.kill('SIGKILL');
  await rm(temp,{recursive:true,force:true});
}
