import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';

const temp=await mkdtemp(resolve(tmpdir(),'chale-work-')),dbPath=resolve(temp,'isolated.sqlite'),capture=resolve(temp,'provider.jsonl');
let origin='',ready=false,exited=false,logs='',checks=0,db;
const child=spawn(process.execPath,['--import','./scripts/chale-test-provider.mjs','server/index.mjs'],{
  cwd:new URL('..',import.meta.url),env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',PORT:'0',
    ECOVIBES_DB_PATH:dbPath,DATABASE_URL:'',SUPABASE_URL:'',OPENAI_ENV_FILE:'',CHALE_PROVIDER:'disabled',AI_PROVIDER_KEY:'synthetic-chale-http-fixture',CHALE_SMOKE_CAPTURE:capture},
  stdio:['ignore','pipe','pipe','ipc'],
});
child.on('exit',()=>{exited=true;});child.on('error',error=>{logs+=error.name;});
child.on('message',message=>{if(message?.event==='chale-smoke-ready'&&Number.isInteger(message.port)&&message.port>0){origin=`http://127.0.0.1:${message.port}`;ready=true;}});
child.stdout.on('data',chunk=>{logs=(logs+chunk).slice(-8000);});child.stderr.on('data',chunk=>{logs=(logs+chunk).slice(-8000);});
async function request(path,account,body,status=200) {
  const response=await fetch(origin+'/api/v1'+path,{method:body?'POST':'GET',signal:AbortSignal.timeout(5000),
    headers:{Origin:origin,'Content-Type':'application/json',...(account?{Cookie:account.cookie,'X-CSRF-Token':account.csrf}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();assert.equal(response.status,status,`${path}: ${JSON.stringify(data)}`);checks++;
  return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function signup(name) {const r=await request('/auth/register',null,{ecoId:name,displayName:name,password:'Synthetic-work-status-test-123'});return {id:r.data.user.id,cookie:r.cookie,csrf:r.data.csrfToken};}
try {
  const deadline=Date.now()+15000;
  while(!ready&&!exited&&Date.now()<deadline)await delay(50);
  assert(ready&&!exited,`Owned API did not report its listener: ${logs}`);
  await request('/ai/work-status',null,undefined,401);
  const owner=await signup('work.owner'),provider=await signup('work.provider'),other=await signup('work.other');
  const disabled=(await request('/ai/status')).data;assert.equal(disabled.configured,false);checks++;
  const empty=(await request('/ai/work-status',owner)).data;assert.deepEqual(empty.groups,[]);checks++;
  db=new DatabaseSync(dbPath);const stamp=new Date().toISOString();
  const seed=(customer,assigned,category,status)=>db.prepare('INSERT INTO jobs(id,customer_id,assigned_provider_id,category,title,description,area,budget_minor,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .run(randomUUID(),customer,assigned,category,'PRIVATE_WORK_TITLE','PRIVATE_WORK_NOTES','PRIVATE_WORK_AREA',4000,status,stamp,stamp);
  seed(owner.id,provider.id,'Plumbing','assigned');seed(owner.id,null,'Waste & Recycling','open');
  seed(other.id,provider.id,'Waste & Recycling','in_progress');seed(other.id,null,'Plumbing','completed');
  db.prepare("INSERT INTO staff_access(user_id,staff_role,created_at) VALUES(?,'admin',?)").run(other.id,stamp);
  const owned=(await request('/ai/work-status',owner)).data;
  assert.equal(owned.accountId,owner.id);assert.equal(owned.source,'job_status_counts');assert(Number.isFinite(Date.parse(owned.asOf)));checks+=3;
  assert.deepEqual(owned.groups,[{workflow:'quickhandi',status:'assigned',count:1},{workflow:'waste',status:'open',count:1}]);checks++;
  const assigned=(await request('/ai/work-status',provider)).data;
  assert.deepEqual(assigned.groups,[{workflow:'quickhandi',status:'assigned',count:1},{workflow:'waste',status:'in_progress',count:1}]);checks++;
  const admin=(await request('/ai/work-status',other)).data;
  assert.deepEqual(admin.groups,[{workflow:'quickhandi',status:'completed',count:1},{workflow:'waste',status:'in_progress',count:1}]);checks++;
  const serialized=JSON.stringify(owned);
  for(const forbidden of ['PRIVATE_WORK_',provider.id,other.id,'budget','phone','token','payment','coordinates']){assert(!serialized.includes(forbidden));checks++;}
  await request('/ai/work-status?userId='+other.id,owner,undefined,400);
  await request('/ai/work-status?organizationId='+randomUUID(),owner,undefined,400);
  await request('/ai/work-status?status=completed',owner,undefined,400);
  // Seed only the disposable test limiter to check its boundary, without a burst.
  const {createHash}=await import('node:crypto');
  const key=createHash('sha256').update(`ecovibes:rate-limit:chale-work:${owner.id}`).digest('hex');
  db.prepare('INSERT OR REPLACE INTO rate_limit_buckets(bucket_key,window_started_at,expires_at,hits) VALUES(?,?,?,?)').run(key,stamp,new Date(Date.now()+60000).toISOString(),29);
  await request('/ai/work-status',owner);await request('/ai/work-status',owner,undefined,429);
  await request('/ai/work-status',provider);
  db.prepare("UPDATE users SET status='suspended' WHERE id=?").run(provider.id);
  await request('/ai/work-status',provider,undefined,403);
  await request('/ai/chat',owner,{messages:[{role:'user',content:'How do I request a collection?'}]},503);
  let providerCapture='';try{providerCapture=await readFile(capture,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  assert.equal(providerCapture,'','Work status must not invoke or disclose anything to a model');checks++;
} finally {
  db?.close();if(!exited){const exit=new Promise(resolveExit=>child.once('exit',resolveExit));child.kill('SIGTERM');await Promise.race([exit,delay(2000)]);if(!exited){child.kill('SIGKILL');await exit;}}
  await rm(temp,{recursive:true,force:true});
}
console.log(`PASS: ${checks} Chale work-status HTTP checks. Synthetic accounts, isolated SQLite, inference disabled; no live model or production claim.`);
