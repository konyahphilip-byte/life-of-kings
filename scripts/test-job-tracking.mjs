import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
const temp=await mkdtemp(join(tmpdir(),'ecovibes-tracking-')),dbPath=join(temp,'synthetic.sqlite');
const port=Number(process.env.TRACKING_TEST_PORT||19239),origin=`http://127.0.0.1:${port}`;
let child,db,checks=0,failure=null;
async function call(path,account,method='GET',body,extra={}){
 const r=await fetch(origin+'/api/v1'+path,{method,signal:AbortSignal.timeout(5000),headers:{Origin:origin,'Content-Type':'application/json',...(account?{Cookie:account.cookie,'X-CSRF-Token':account.csrf}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});
 return{status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0],cache:r.headers.get('cache-control')};
}
async function signup(ecoId){const r=await call('/auth/register',null,'POST',{ecoId,displayName:ecoId,password:'Synthetic-tracking-test-password-123'});assert.equal(r.status,200);return{id:r.data.user.id,cookie:r.cookie,csrf:r.data.csrfToken};}
async function expect(path,actor,method,body,status=200,extra){const r=await call(path,actor,method,body,extra);assert.equal(r.status,status,`Expected${status}, got${r.status} (${r.data.error?.code||'response'})`);checks++;return r;}
try{
 child=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',PORT:String(port),ECOVIBES_DB_PATH:dbPath,APP_ORIGINS:origin,DATABASE_URL:'',SUPABASE_URL:'',OPENAI_ENV_FILE:'',ECOVIBES_SERVE_WEB:'false'},stdio:'ignore'});
 let ready=false;for(let i=0;i<60;i++){if(child.exitCode!==null)throw Error('Isolated API exited.');try{ready=(await call('/health')).status===200;}catch{}if(ready)break;await delay(100);}assert.ok(ready,'Isolated API not ready');
 const customer=await signup('tracking_customer'),collector=await signup('tracking_collector'),outsider=await signup('tracking_outsider');
 db=new DatabaseSync(dbPath);const stamp=new Date().toISOString(),jobId=randomUUID();
 db.prepare("INSERT INTO roles(user_id,role,created_at) VALUES(?,'provider',?)").run(collector.id,stamp);
 db.prepare("INSERT INTO provider_profiles(user_id,verification_state,revision,created_at) VALUES(?,'approved',1,?)").run(collector.id,stamp);
 db.prepare("INSERT INTO verification_requests(id,user_id,business_type,evidence_note,status,target_role,profile_version,created_at) VALUES(?,?,'Waste services provider','Synthetic approved fixture only','approved','provider',1,?)").run(randomUUID(),collector.id,stamp);
 db.prepare("INSERT INTO jobs(id,customer_id,category,title,description,area,budget_minor,status,assigned_provider_id,created_at,updated_at) VALUES(?,?,'Waste & Recycling','Synthetic collection','Disposable test only','Tema',0,'assigned',?,?,?)").run(jobId,customer.id,collector.id,stamp,stamp);
 const path=`/jobs/${jobId}/tracking`;
 const read=await expect(path,collector);assert.equal(read.data.role,'collector');assert.equal(read.data.state,'not_started');assert.equal(read.cache,'no-store');checks++;
 await expect(path,null,'GET',null,401);await expect(path,outsider,'GET',null,404);
 const start={expectedOwnerId:collector.id,requestId:randomUUID(),requestedAt:Date.now(),shareWithCustomer:true};
 await expect(path+'/start',collector,'POST',start,403,{'X-CSRF-Token':'wrong'});
 await expect(path+'/start',customer,'POST',{...start,expectedOwnerId:customer.id},403);
 await expect(path+'/start',collector,'POST',{...start,expectedOwnerId:customer.id},403);
 const session=(await expect(path+'/start',collector,'POST',start)).data;
 assert.equal(session.state,'waiting');assert.equal(session.sessionId,start.requestId);checks++;
 assert.equal((await expect(path+'/start',collector,'POST',start)).data.sessionId,start.requestId);checks++;
 const point={expectedOwnerId:collector.id,sessionId:session.sessionId,sequence:1,latitude:5.6037,longitude:-0.187,accuracy:12,capturedAt:Date.now()};
 await expect(path+'/point',collector,'POST',point);
 await expect(path+'/point',collector,'POST',point); // lost-response exact retry
 const tracked=(await expect(path,customer)).data;assert.equal(tracked.state,'live');assert.equal(tracked.point.latitude,point.latitude);assert.equal(tracked.point.accuracy,12);checks++;
 await expect(path,outsider,'GET',null,404);
 await expect(path+'/point',outsider,'POST',{...point,expectedOwnerId:outsider.id},404);
 await expect(path+'/point',collector,'POST',{...point,longitude:0},409);
 const pause={expectedOwnerId:collector.id,sessionId:session.sessionId};await expect(path+'/pause',collector,'POST',pause);
 assert.equal((await expect(path,customer)).data.point,null);checks++;
 await expect(path+'/point',collector,'POST',{...point,sequence:2,capturedAt:Date.now()},409);
 await expect(path+'/start',collector,'POST',start);assert.equal((await call(path,customer)).data.state,'paused');checks++;
 const next={...start,requestId:randomUUID(),requestedAt:Date.now()};await expect(path+'/start',collector,'POST',next);
 await expect(path+'/stop',collector,'POST',pause,409); // cannot stop replacement session
 await expect(path+'/point',collector,'POST',{...point,sessionId:next.requestId,capturedAt:Date.now()});
 await expect(`/jobs/${jobId}/cancel`,customer,'POST',{});
 const ended=(await expect(path,customer)).data;assert.equal(ended.state,'cancelled');assert.equal(ended.point,null);checks++;
 await expect(path+'/point',collector,'POST',{...point,sessionId:next.requestId,sequence:2,capturedAt:Date.now()},409);
 const stored=db.prepare('SELECT latitude,longitude FROM job_tracking_current WHERE job_id=?').get(jobId);assert.equal(stored.latitude,null);assert.equal(stored.longitude,null);checks++;
}catch(error){failure=error.message;process.exitCode=1;}
finally{db?.close();if(child&&child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await Promise.race([done,delay(2000)]);if(child.exitCode===null){child.kill('SIGKILL');await done;}}await rm(temp,{recursive:true,force:true});console.log(JSON.stringify({success:!failure,checks,failure,scope:'isolated real HTTP/synthetic accounts and coordinates; no physical GPS/provider/production changes'}));}
