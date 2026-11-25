import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));
const temp=await mkdtemp(resolve(tmpdir(),'ecovibes-profiles-'));
let origin,logs='',failure=null;
const profileAssets=[];
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
 await check('private notification summary belongs only to recipient and read writes are scoped',async()=>{
  assert.equal((await request('/notifications/summary')).status,401);
  const bNotices=await ok('/notifications/summary',{account:b});assert.equal(bNotices.ownerId,b.id);
  const n=bNotices.items.find(x=>x.type==='direct_message');assert(n);assert(!JSON.stringify(n).includes('Hello from alpha'));
  assert.equal((await ok('/notifications/summary',{account:c})).unread,0);
  assert.equal((await request(`/notifications/${n.id}/read`,{account:a,method:'POST',body:{}})).status,404);
  await ok(`/notifications/${n.id}/read`,{account:b,method:'POST',body:{}});
  const reread=await ok('/notifications/summary',{account:b});assert(reread.items.find(x=>x.id===n.id).read_at);
  assert.equal((await request('/notifications/summary?userId=forged',{account:b})).status,400);
 });
 await check('two delivery ticks require recipient POST acknowledgement with CSRF and current consent',async()=>{
  assert.equal((await ok(path,{account:a})).messages[0].deliveredAt,null);
  const receipt=`${base}/${a.id}/receipts`,body={revision:2,messageIds:[sent.message.id]};
  assert.equal((await request(receipt,{account:b,method:'POST',body,csrf:false})).status,403);
  assert.equal((await request(receipt,{account:c,method:'POST',body})).status,404);
  await ok(receipt,{account:b,method:'POST',body});
  const stamp=(await ok(path,{account:a})).messages[0].deliveredAt;assert(stamp);
  await ok(receipt,{account:b,method:'POST',body});assert.equal((await ok(path,{account:a})).messages[0].deliveredAt,stamp);
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

 await check('profile counts come from accepted friendship and persisted follow records',async()=>{
  const profile=await ok('/people/profiles/me',{account:a});assert.equal(profile.ownerId,a.id);assert.equal(profile.counts.friends,1);assert.equal(profile.counts.followers,0);
  await ok('/people/'+a.id+'/follow',{account:b,method:'POST',body:{}});
  assert.equal((await ok('/people/profiles/me',{account:a})).counts.followers,1);
 });
 await check('owned image upload and profile save survive reload without false success',async()=>{
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXs8AAAAASUVORK5CYII=';
  for(const account of [a,a,b]){
   const asset=await ok('/social/assets',{account,method:'POST',body:{mimeType:'image/png',data:png,expectedOwnerId:account.id}});profileAssets.push(asset.id);
  }
  const body={expectedOwnerId:a.id,avatarAssetId:profileAssets[0],bannerAssetId:profileAssets[1],revision:0};
  assert.equal((await request('/people/profiles/me',{account:a,method:'POST',body,csrf:false})).status,403);
  assert.equal((await request('/people/profiles/me',{account:b,method:'POST',body})).status,403);
  assert.equal((await request('/people/profiles/me',{account:a,method:'POST',body:{...body,avatarAssetId:profileAssets[2]}})).status,404);
  const saved=await ok('/people/profiles/me',{account:a,method:'POST',body});assert.equal(saved.revision,1);
  assert.equal((await ok('/people/profiles/me',{account:a,method:'POST',body})).revision,1);
  const restored=await ok('/people/profiles/me',{account:a});assert.equal(restored.avatarAssetId,profileAssets[0]);assert.equal(restored.bannerAssetId,profileAssets[1]);
  assert.equal((await request('/social/assets/'+profileAssets[0],{account:a,method:'DELETE'})).status,409);
  const image=await fetch(origin+'/api/v1/people/profiles/'+a.id+'/media/avatar',{headers:{Cookie:b.cookie},signal:AbortSignal.timeout(5000)});
  assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');assert.equal(image.headers.get('cache-control'),'private, no-store');
  assert.equal(Buffer.from(await image.arrayBuffer()).toString('base64'),png);
  assert.equal((await request('/people/profiles/me?ownerId='+b.id,{account:a})).status,400);
 });
 await check('block immediately stops both directions including cached revision and retry',async()=>{
  await act(b,a.id,'block',2);
  for(const [account,peer] of [[a,b],[b,a]]){
   assert.equal((await request(`${base}/${peer.id}`,{account})).status,404);
   assert.equal((await request(`${base}/${peer.id}`,{account,method:'POST',body:{body:'Hello from alpha',revision:2,clientId}})).status,404);
  }
  assert.equal((await request('/people/profiles/'+a.id+'/media/avatar',{account:b})).status,404);
 assert.deepEqual(await ok(base,{account:a}),{ownerId:a.id,friends:[],truncated:false});
 });
 await check('unblock never restores conversation; session logout denies access',async()=>{
  await act(b,a.id,'unblock',3);assert.equal((await request(path,{account:a})).status,404);
  await ok('/auth/logout',{account:a,method:'POST',body:{}});assert.equal((await request(base,{account:a})).status,401);
 });
}catch(e){failure={name:e.name,message:e.message};}
finally{
 child.kill('SIGTERM');const deadline=Date.now()+3000;while(!exited&&Date.now()<deadline)await delay(30);if(!exited)child.kill('SIGKILL');
 for(const assetId of profileAssets){assert(/^[0-9a-f-]{36}$/.test(assetId));await rm(resolve(root,'server/data/social-media',assetId),{force:true});}
 await rm(temp,{recursive:true,force:true});
 const report={passed:!failure,checks,failure,scope:'Actual isolated HTTP API + SQLite; synthetic accounts only. Includes local synthetic PNG upload/load only; no hosted storage, physical-device, provider or real inference acceptance.'};
 if(process.env.PROFILE_TEST_REPORT)await writeFile(process.env.PROFILE_TEST_REPORT,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));if(failure){console.error(logs);process.exitCode=1;}
}
