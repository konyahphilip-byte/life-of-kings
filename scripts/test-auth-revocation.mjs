import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';

// Actual HTTP/SQLite, synthetic external verifier and controllable child clock.
// No real Auth, app environment, provider request, email or hosted records.
const temp=await mkdtemp(resolve(tmpdir(),'ev-auth-revocation-'));
const database=resolve(temp,'isolated.sqlite'),hook=resolve(temp,'fixture.mjs');
const verifier=new URL('../server/supabase-auth.mjs',import.meta.url).href;
const sid=randomUUID(),freshSid=randomUUID(),before=Math.floor(Date.now()/1000)-300;
const source=`export async function authenticateSupabaseRequest(req){const kind=req.headers.authorization?.replace('Bearer ','');if(!['old','refreshed','fresh'].includes(kind))return{user:null,error:{status:401,code:'invalid_token'}};return{user:{id:'synthetic-provider-owner'},assuranceLevel:'aal1',authContext:{sessionId:kind==='fresh'?'${freshSid}':'${sid}',primaryAuthAt:kind==='fresh'?Math.floor(Date.now()/1000)-1:${before},issuedAt:kind==='old'?${before}:Math.floor(Date.now()/1000)-1,expiresAt:Math.floor(Date.now()/1000)+3600},error:null}}`;
await writeFile(hook,`import {registerHooks} from 'node:module';import {Server} from 'node:http';let clock=Date.now();Date.now=()=>clock;process.on('message',m=>{if(m?.event==='advance'){clock+=m.ms;process.send?.({event:'advanced'})}if(m?.event==='disable'){process.env.ECOVIBES_SUPABASE_ADMISSION_DISABLED='true';process.send?.({event:'disabled'})}});const listen=Server.prototype.listen;Server.prototype.listen=function(...args){this.once('listening',()=>process.send?.({event:'ready',port:this.address().port}));return listen.apply(this,args)};registerHooks({resolve(s,c,n){if(new URL(s,c.parentURL||import.meta.url).href===${JSON.stringify(verifier)})return{url:${JSON.stringify('data:text/javascript,'+encodeURIComponent(source))},shortCircuit:true};return n(s,c)}});`);
let origin,db,checks=0,logs='';
const child=spawn(process.execPath,['--import',hook,'server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',PORT:'0',ECOVIBES_DB_PATH:database,DATABASE_URL:'',SUPABASE_URL:'',APP_ORIGINS:'',OPENAI_ENV_FILE:'',ECOVIBES_SERVE_WEB:'false'},stdio:['ignore','pipe','pipe','ipc']});
child.stdout.on('data',v=>logs+=v);child.stderr.on('data',v=>logs+=v);child.on('message',m=>{if(m?.event==='ready')origin=`http://127.0.0.1:${m.port}`;});
async function control(message,event){await new Promise((done,reject)=>{const timer=setTimeout(()=>reject(Error('Fixture acknowledgement missing')),5000);const listener=m=>{if(m?.event===event){clearTimeout(timer);child.off('message',listener);done();}};child.on('message',listener);child.send(message);});}
async function request(path,{token,account,body,status=200,requestOrigin=origin}={}){
 const r=await fetch(`${origin}/api/v1${path}`,{method:body?'POST':'GET',signal:AbortSignal.timeout(5000),headers:{Origin:requestOrigin,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}) ,...(account?{Cookie:account.cookie,'X-CSRF-Token':account.csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json();assert.equal(r.status,status,`${path}: ${JSON.stringify(data)}`);checks++;
 return{data,cookie:r.headers.get('set-cookie')?.split(';')[0],csrf:data.csrfToken};
}
async function signup(name){const r=await request('/auth/register',{body:{ecoId:name,displayName:name,password:'Synthetic-password-123'}});return{...r,id:r.data.user.id};}
try{
 const deadline=Date.now()+15000;while(!origin&&child.exitCode===null&&Date.now()<deadline)await delay(40);assert(origin,`Fixture did not own listener: ${logs}`);
 db=new DatabaseSync(database);const owner=await signup('revoke.owner'),other=await signup('revoke.other');
 db.prepare('INSERT INTO supabase_identities VALUES(?,?,?)').run('synthetic-provider-owner',owner.id,new Date().toISOString());
 const cleanup={operationId:randomUUID()},cleanupPath='/auth/supabase/logout',admission='/auth/supabase/session';
 await request(admission,{token:'old',body:{},account:owner});
 db.exec("CREATE TRIGGER synthetic_session_failure BEFORE INSERT ON sessions BEGIN SELECT RAISE(ABORT,'Synthetic session failure'); END");
 const failed=await request(admission,{token:'old',body:{},status:500});assert.equal(failed.cookie,undefined);checks++;
 db.exec('DROP TRIGGER synthetic_session_failure');
 await request(cleanupPath,{token:'old',body:cleanup,requestOrigin:'https://untrusted.invalid',status:403});
 await request(cleanupPath,{token:'old',body:{...cleanup,userId:other.id},status:400});
 const result=await request(cleanupPath,{token:'old',body:cleanup,account:other});assert.equal(result.cookie,undefined);checks++;
 assert.equal((await request('/auth/me',{account:owner})).data.user,null);checks++;
 assert.equal((await request('/auth/me',{account:other})).data.user.id,other.id);checks++;
 const denied=await request(admission,{token:'old',body:{},status:401});assert.equal(denied.cookie,undefined);checks++;
 await control({event:'advance',ms:120000},'advanced');
 await request(admission,{token:'refreshed',body:{},status:401});
 const fresh=await request(admission,{token:'fresh',body:{}});assert.equal(fresh.data.user.id,owner.id);checks++;
 const replay=await request(cleanupPath,{token:'old',body:cleanup,account:fresh});assert.equal(replay.cookie,undefined);checks++;
 const staleReplay=await request(cleanupPath,{token:'old',body:cleanup,account:owner});assert.equal(staleReplay.cookie,undefined,'A stale in-flight cleanup cannot overwrite a newer browser cookie');checks++;
 assert.equal((await request('/auth/me',{account:fresh})).data.user.id,owner.id);checks++;
 await request(cleanupPath,{token:'old',body:{operationId:randomUUID()},status:401});
 assert.equal((await request('/auth/me',{account:fresh})).data.user.id,owner.id);checks++;
 await request('/auth/login',{body:{ecoId:'revoke.owner',password:'Synthetic-password-123'},status:401});
 await control({event:'disable'},'disabled');await request(admission,{token:'fresh',body:{},status:503});
 assert.equal(db.prepare('SELECT count(*) n FROM auth_revocation_operations').get().n,1);checks++;
 console.log(JSON.stringify({status:'PASS',checks,externalProvider:'synthetic',hosted:false}));
}finally{db?.close();child.kill('SIGTERM');await Promise.race([new Promise(done=>child.once('exit',done)),delay(3000)]);if(child.exitCode===null)child.kill('SIGKILL');await rm(temp,{recursive:true,force:true});}
