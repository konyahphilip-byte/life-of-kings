import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';

// Real HTTP + disposable SQLite. Only the external provider verification
// boundary is synthetic; this cannot verify production JWT or revocation.
const temp=await mkdtemp(resolve(tmpdir(),'ecovibes-account-recovery-'));
const database=resolve(temp,'isolated.sqlite'), hook=resolve(temp,'provider-fixture.mjs');
let origin;
const verifier=new URL('../server/supabase-auth.mjs',import.meta.url).href;
const source=`export async function authenticateSupabaseRequest(req){return req.headers.authorization==='Bearer synthetic-provider-owner'?{user:{id:'synthetic-provider-owner'},assuranceLevel:'aal1',error:null}:{user:null,error:{status:401,code:'invalid_token',message:'Synthetic authentication required'}}}`;
await writeFile(hook,`import {registerHooks} from 'node:module'; import {Server} from 'node:http'; const listen=Server.prototype.listen; Server.prototype.listen=function(...args){this.once('listening',()=>process.send?.({event:'recovery-fixture-ready',port:this.address().port}));return listen.apply(this,args)}; registerHooks({resolve(s,c,n){if(new URL(s,c.parentURL||import.meta.url).href===${JSON.stringify(verifier)})return {url:${JSON.stringify('data:text/javascript,'+encodeURIComponent(source))},shortCircuit:true};return n(s,c)}});`);
const child=spawn(process.execPath,['--import',hook,'server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',PORT:'0',ECOVIBES_DB_PATH:database,APP_ORIGINS:'',DATABASE_URL:'',SUPABASE_URL:'',OPENAI_ENV_FILE:'',ECOVIBES_SERVE_WEB:'false'},stdio:['ignore','pipe','pipe','ipc']});
child.on('message',m=>{if(m?.event==='recovery-fixture-ready'&&m.port)origin=`http://127.0.0.1:${m.port}`;});
let logs='',db,checks=0; child.stdout.on('data',v=>logs+=v);child.stderr.on('data',v=>logs+=v);
async function request(path,{method='GET',account,token,body,requestOrigin=origin}={}){
 const r=await fetch(`${origin}/api/v1${path}`,{method,signal:AbortSignal.timeout(5000),headers:{Origin:requestOrigin,'Content-Type':'application/json',...(account?{Cookie:account.cookie,'X-CSRF-Token':account.csrf}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return{status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
async function signup(ecoId){const r=await request('/auth/register',{method:'POST',body:{ecoId,displayName:ecoId,password:'Synthetic-password-123'}});assert.equal(r.status,200);return{id:r.data.user.id,cookie:r.cookie,csrf:r.data.csrfToken};}
async function check(path,options,status=200){const r=await request(path,options);assert.equal(r.status,status,JSON.stringify(r.data));checks++;return r;}
try{
 const deadline=Date.now()+15000;while(!origin&&child.exitCode===null&&Date.now()<deadline)await delay(40);assert(origin,'This fixture child did not signal ownership of its listener');
 db=new DatabaseSync(database);
 const owner=await signup('recovery.owner'),other=await signup('recovery.other');
 db.prepare('INSERT INTO supabase_identities(supabase_user_id,user_id,created_at) VALUES(?,?,?)').run('synthetic-provider-owner',owner.id,new Date().toISOString());
 await check('/auth/login',{method:'POST',body:{ecoId:'recovery.owner',password:'Synthetic-password-123'}},401);
 const path='/auth/supabase/logout';
 await check(path,{method:'POST',account:owner,body:{}},401);
 await check(path,{method:'POST',token:'synthetic-invalid',body:{}},401);
 await check(path,{method:'POST',token:'synthetic-provider-owner',body:{userId:other.id}},400);
 await check(path,{method:'POST',token:'synthetic-provider-owner',body:{},requestOrigin:'https://untrusted.invalid'},403);
 assert.equal((await check('/auth/me',{account:owner})).data.user.id,owner.id);checks++;
 const cleanup=await check(path,{method:'POST',account:other,token:'synthetic-provider-owner',body:{}});
 assert.deepEqual(cleanup.data,{ok:true});assert.equal(cleanup.cookie,undefined);checks++;
 assert.equal((await check('/auth/me',{account:owner})).data.user,null);checks++;
 assert.equal((await check('/auth/me',{account:other})).data.user.id,other.id);checks++;
 await check(path,{method:'POST',token:'synthetic-provider-owner',body:{}});
 assert.equal(db.prepare('SELECT COUNT(*) n FROM sessions WHERE user_id=?').get(owner.id).n,0);checks++;
 console.log(`PASS: ${checks} recovery session HTTP checks. Synthetic provider boundary, not hosted Auth or two real inboxes.`);
}finally{db?.close();child.kill('SIGTERM');await Promise.race([new Promise(done=>child.once('exit',done)),delay(3000)]);if(child.exitCode===null)child.kill('SIGKILL');await rm(temp,{recursive:true,force:true});}
