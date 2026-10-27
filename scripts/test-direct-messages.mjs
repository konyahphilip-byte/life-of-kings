import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));
const temp=await mkdtemp(resolve(tmpdir(),'ecovibes-messages-'));
let origin,logs='',failure=null;
const checks=[];
// Whitelisted test-only environment: no .env, hosted data, provider or credential access.
const child=spawn(process.execPath,['--import','./scripts/chale-test-provider.mjs','server/index.mjs'],{
 cwd:root,env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',AI_PROVIDER_KEY:'synthetic-chale-http-fixture',PORT:'0',ECOVIBES_DB_PATH:resolve(temp,'test.sqlite'),OPENAI_ENV_FILE:'',SUPABASE_URL:'',DATABASE_URL:'',CHALE_SMOKE_CAPTURE:resolve(temp,'unused.jsonl')},stdio:['ignore','pipe','pipe','ipc']
});
child.on('message',m=>{if(m?.event==='chale-smoke-ready'&&m.port)origin=`http://127.0.0.1:${m.port}`;});
child.stdout.on('data',v=>{logs=(logs+v).slice(-8000);});child.stderr.on('data',v=>{logs=(logs+v).slice(-8000);});
let exited=false;child.on('exit',()=>{exited=true;});
async function request(path,{account,method='GET',body,csrf=true,requestOrigin=origin}={}){
 const response=await fetch(`${origin}/api/v1${path}`,{method,headers:{Origin:requestOrigin,...(account?{Cookie:account.cookie}:{}),...(account&&csrf?{'X-CSRF-Token':account.csrf}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000)});
 return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],cache:response.headers.get('cache-control')};
}
async function check(name,work){await work();checks.push({name,passed:true});}
async function ok(path,options){const r=await request(path,options);assert.equal(r.status,200,`${path}: ${JSON.stringify(r.data)}`);return r.data;}
try{
 const deadline=Date.now()+15000;while(!origin&&!exited&&Date.now()<deadline)await delay(40);
 assert(origin,'Isolated API did not start');
 const register=async name=>{const r=await request('/auth/register',{method:'POST',body:{ecoId:`test.${name}`,displayName:name,password:'Synthetic-only-password-273!'}});assert.equal(r.status,200);return{id:r.data.user.id,csrf:r.data.csrfToken,cookie:r.cookie};};
 const a=await register('alpha'),b=await register('beta'),c=await register('gamma');
 const base='/connect/messages',path=`${base}/${b.id}`;
 await check('anonymous inbox is private/no-store',async()=>{const r=await request(base);assert.equal(r.status,401);assert.equal(r.cache,'no-store');});
 await check('signed-in inbox returns no fabricated conversation',async()=>{assert.deepEqual(await ok(base,{account:a}),{ownerId:a.id,friends:[],truncated:false});});
 const act=(account,target,action,revision)=>ok(`/people/friends/${target}`,{account,method:'POST',body:{action,revision}});
 await check('pending friendship cannot read/send',async()=>{
  await act(a,b.id,'request',0);
  assert.equal((await request(path,{account:a})).status,404);
  assert.equal((await request(path,{account:a,method:'POST',body:{body:'not permitted',revision:1,clientId:randomUUID()}})).status,404);
 });
 await act(b,a.id,'accept',1);
 let sent,clientId=randomUUID();
 await check('only accepted friend appears, no private fields',async()=>{const inbox=await ok(base,{account:a});assert.equal(inbox.friends.length,1);assert.deepEqual(Object.keys(inbox.friends[0]).sort(),['display_name','eco_id','id','revision']);assert.deepEqual(await ok(base,{account:c}),{ownerId:c.id,friends:[],truncated:false});});
 await check('CSRF/origin and forged sender are rejected',async()=>{
  const body={body:'hello',revision:2,clientId};
  assert.equal((await request(path,{account:a,method:'POST',body,csrf:false})).status,403);
  assert.equal((await request(path,{account:a,method:'POST',body,requestOrigin:'https://untrusted.example'})).status,403);
  assert.equal((await request(path,{account:a,method:'POST',body:{...body,senderId:c.id}})).status,400);
 });
 await check('real send persists and recipient reloads ordered text',async()=>{
  sent=await ok(path,{account:a,method:'POST',body:{body:'Hello from alpha',revision:2,clientId}});
  assert.equal(sent.message.body,'Hello from alpha');assert.equal(sent.message.senderId,a.id);
  const read=await ok(`${base}/${a.id}`,{account:b});assert.equal(read.revision,2);assert.equal(read.messages[0].body,'Hello from alpha');assert.equal(read.hasOlder,false);
 });
 await check('identical retry is idempotent; reused key cannot replace text',async()=>{
  const retry=await ok(path,{account:a,method:'POST',body:{body:'Hello from alpha',revision:2,clientId}});assert.equal(retry.message.id,sent.message.id);
  assert.equal((await request(path,{account:a,method:'POST',body:{body:'changed',revision:2,clientId}})).status,409);
  assert.equal((await ok(path,{account:a})).messages.length,1);
 });
 await check('unrelated account and account selectors cannot read messages',async()=>{
  assert.equal((await request(path,{account:c})).status,404);
  assert.equal((await request(`${path}?userId=${a.id}`,{account:a})).status,400);
  assert.equal((await request(`${base}/${a.id}`,{account:a})).status,404);
 });
 await check('blank/oversized/control text rejected, HTML remains plain text',async()=>{
  for(const text of [' ','x'.repeat(2001),'hello\u0000'])assert.equal((await request(path,{account:a,method:'POST',body:{body:text,revision:2,clientId:randomUUID()}})).status,400);
  const r=await ok(path,{account:a,method:'POST',body:{body:'<script>alert(1)</script>',revision:2,clientId:randomUUID()}});assert.equal(r.message.body,'<script>alert(1)</script>');
 });
 await check('block immediately stops both directions including cached revision and retry',async()=>{
  await act(b,a.id,'block',2);
  for(const [account,peer] of [[a,b],[b,a]]){
   assert.equal((await request(`${base}/${peer.id}`,{account})).status,404);
   assert.equal((await request(`${base}/${peer.id}`,{account,method:'POST',body:{body:'Hello from alpha',revision:2,clientId}})).status,404);
  }
  assert.deepEqual(await ok(base,{account:a}),{ownerId:a.id,friends:[],truncated:false});
 });
 await check('unblock never restores conversation; session logout denies access',async()=>{
  await act(b,a.id,'unblock',3);assert.equal((await request(path,{account:a})).status,404);
  await ok('/auth/logout',{account:a,method:'POST',body:{}});assert.equal((await request(base,{account:a})).status,401);
 });
}catch(e){failure={name:e.name,message:e.message};}
finally{
 child.kill('SIGTERM');const deadline=Date.now()+3000;while(!exited&&Date.now()<deadline)await delay(30);if(!exited)child.kill('SIGKILL');
 await rm(temp,{recursive:true,force:true});
 const report={passed:!failure,checks,failure,scope:'Actual isolated HTTP API + SQLite; synthetic accounts only. No hosted, physical-device, media, provider or real inference acceptance.'};
 if(process.env.DM_TEST_REPORT)await writeFile(process.env.DM_TEST_REPORT,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));if(failure){console.error(logs);process.exitCode=1;}
}
