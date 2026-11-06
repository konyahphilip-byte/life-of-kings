import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,chmod,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import pg from 'pg';
import {createJobTracking,TRACKING_VERSION} from '../server/job-tracking.mjs';
assert(process.env.PG_BINDIR,'Set PG_BINDIR to existing disposable PostgreSQL tooling. No hosted database settings are used.');
const bin=await realpath(process.env.PG_BINDIR),tmp=await mkdtemp('/tmp/ev-tracking-pg-'),data=join(tmp,'data');await chmod(tmp,0o700);
const clients=[],checks=[];let server,log='',failure=null,version=null,time=Date.now();
const paths=['server/job-tracking.mjs','supabase/migrations/20261029210000_job_tracking.sql'];
const hashes=Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex')])));
function command(name,args){const r=spawnSync(join(bin,name),args,{encoding:'utf8',timeout:20000,env:{PATH:process.env.PATH,LC_ALL:'C'}});assert.equal(r.status,0,r.stderr||r.stdout);return r.stdout;}
async function connect(user){const c=new pg.Client({host:tmp,port:54392,user,database:'postgres',ssl:false,connectionTimeoutMillis:2000,query_timeout:5000});c.on('error',()=>{});await c.connect();clients.push(c);return c;}
function check(ok,label){assert(ok,label);checks.push(label);}
const A=randomUUID(),B=randomUUID(),C=randomUUID(),J=randomUUID(),S=randomUUID(),at=()=>new Date(time).toISOString();
function service(client){const query=(sql,values=[])=>{let i=0;return client.query(sql.replace(/\?/g,()=>`$${++i}`),values);};
 return createJobTracking({q:async(s,...p)=>(await query(s,p)).rows[0],run:async(s,...p)=>({changes:(await query(s,p)).rowCount}),transaction:async work=>{await client.query('BEGIN');try{const r=await work();await client.query('COMMIT');return r;}catch(e){await client.query('ROLLBACK');throw e;}},assert:(v,status,code,message)=>{if(!v)throw Object.assign(Error(message),{status,code});},now:at,rateLimit:async()=>{},postgresMode:true,available:true,event:async(actor,type,id,event,details)=>query('INSERT INTO audit VALUES(?,?,?)',[actor,event,JSON.stringify(details)])});
}
const route=(s,actor=B,action='',body={})=>s.route({user:{id:actor,status:'active'}},action?'POST':'GET',`/jobs/${J}/tracking${action?'/'+action:''}`,body,new URLSearchParams());
const start=()=>({expectedOwnerId:B,requestId:S,requestedAt:time,shareWithCustomer:true});
const point=()=>({expectedOwnerId:B,sessionId:S,sequence:1,latitude:5.6,longitude:-.18,accuracy:15,capturedAt:time});
try{
 command('initdb',['-D',data,'-U','postgres','--auth-local=trust','--auth-host=reject','--no-instructions','--locale=C','--encoding=UTF8']);
 server=spawn(join(bin,'postgres'),['-D',data,'-k',tmp,'-p','54392','-c','listen_addresses=','-c','unix_socket_permissions=0700'],{env:{PATH:process.env.PATH,LC_ALL:'C'},stdio:['ignore','ignore','pipe']});server.stderr.on('data',b=>{log=(log+b.toString()).slice(-3000);});
 let admin;for(let i=0;i<100;i++){try{admin=await connect('postgres');break;}catch{await delay(100);}}assert(admin,'Private test database did not start');version=(await admin.query('SHOW server_version')).rows[0].server_version;
 await admin.query(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE ecovibes_api_runtime LOGIN;
 CREATE TABLE users(id uuid PRIMARY KEY,status text);CREATE TABLE roles(user_id uuid,role text);
 CREATE TABLE jobs(id uuid PRIMARY KEY,customer_id uuid REFERENCES users(id),assigned_provider_id uuid REFERENCES users(id),category text,status text);
 CREATE TABLE provider_profiles(user_id uuid,revision integer,verification_state text);
 CREATE TABLE verification_requests(user_id uuid,target_role text,business_type text,profile_version integer,status text);
 CREATE TABLE people_friendships(low_user_id uuid,high_user_id uuid,low_blocked integer,high_blocked integer);
 CREATE TABLE audit(actor uuid,kind text,details text);CREATE TABLE ecovibes_schema_version(version text PRIMARY KEY);
 GRANT SELECT ON users,roles,jobs,provider_profiles,verification_requests,people_friendships TO ecovibes_api_runtime;
 GRANT UPDATE(id) ON users TO ecovibes_api_runtime;GRANT UPDATE(id,status) ON jobs TO ecovibes_api_runtime;GRANT INSERT ON audit TO ecovibes_api_runtime;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;`);
 await admin.query(await readFile(new URL('../'+paths[1],import.meta.url),'utf8'));
 check((await admin.query('SELECT 1 FROM ecovibes_schema_version WHERE version=$1',[TRACKING_VERSION])).rowCount===1,'Exact migration and schema marker applied only to disposable PostgreSQL');
 for(const table of ['job_tracking_current','job_tracking_operations']){
  check((await admin.query('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass',[table])).rows[0].relrowsecurity,table+' RLS enabled');
  for(const role of ['anon','authenticated','service_role']){await admin.query(`SET ROLE ${role}`);for(const sql of [`SELECT * FROM ${table}`,`DELETE FROM ${table}`,`TRUNCATE ${table}`]){await assert.rejects(()=>admin.query(sql),e=>e.code==='42501');check(true,`${role} denied ${sql.split(' ')[0]} on ${table}`);}await admin.query('RESET ROLE');}
 }
 for(const id of[A,B,C])await admin.query("INSERT INTO users VALUES($1,'active')",[id]);
 await admin.query("INSERT INTO roles VALUES($1,'provider');",[B]);await admin.query("INSERT INTO provider_profiles VALUES($1,1,'approved')",[B]);
 await admin.query("INSERT INTO verification_requests VALUES($1,'provider','Waste services provider',1,'approved')",[B]);await admin.query("INSERT INTO jobs VALUES($1,$2,$3,'Waste & Recycling','assigned')",[J,A,B]);
 const one=await connect('ecovibes_api_runtime'),two=await connect('ecovibes_api_runtime'),s1=service(one),s2=service(two);
 for(const sql of ['DELETE FROM job_tracking_current','TRUNCATE job_tracking_current','UPDATE job_tracking_operations SET request_hash=\'changed\'']){await assert.rejects(()=>one.query(sql),e=>e.code==='42501');check(true,'Minimal runtime denies '+sql.split(' ')[0]);}
 const admitted=await Promise.all([route(s1,B,'start',start()),route(s2,B,'start',start())]);check(admitted.every(x=>x.sessionId===S),'Concurrent start retries share one lease');check((await admin.query('SELECT count(*)::int n FROM job_tracking_operations')).rows[0].n===1,'One immutable start-operation record');
 await Promise.all([route(s1,B,'point',point()),route(s2,B,'point',point())]);check((await route(s1,A)).sequence===1,'Concurrent coordinate retries persist one latest position');
 await assert.rejects(()=>route(s2,C),e=>e.status===404);check(true,'Third account cannot read position');
 await assert.rejects(()=>route(s2,B,'point',{...point(),longitude:0}),e=>e.status===409);check(true,'Changed retry cannot rewrite acknowledged position');
 time+=31000;check((await route(s1,A)).state==='stale','Real PostgreSQL timestamps become stale');time+=61000;await s1.maintenance();check((await route(s2,A)).point===null,'Cleanup removes precise coordinates');
 time+=1000;await route(s1,B,'point',{...point(),sequence:2});
 await one.query('BEGIN');await one.query('SELECT id FROM jobs WHERE id=$1 FOR UPDATE',[J]);await one.query("UPDATE jobs SET status='cancelled' WHERE id=$1",[J]);
 let settled=false;time+=4000;const queued=route(s2,B,'point',{...point(),sequence:3}).then(()=>({allowed:true}),e=>({status:e.status})).finally(()=>{settled=true;});
 await delay(80);check(!settled,'In-flight publish waits for collection transition');await one.query('COMMIT');check((await queued).status===409,'Cancelled collection rejects queued publish');check((await route(s1,A)).point===null,'Ended collection never returns retained coordinates');
 await admin.query("UPDATE jobs SET status='assigned' WHERE id=$1",[J]);const next={...start(),requestId:randomUUID()};await route(s1,B,'start',next);
 await admin.query('BEGIN');await admin.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[B]);await admin.query("UPDATE provider_profiles SET verification_state='unverified' WHERE user_id=$1",[B]);
 settled=false;const revoked=route(s2,B,'point',{...point(),sessionId:next.requestId}).then(()=>({allowed:true}),e=>({status:e.status})).finally(()=>{settled=true;});
 await delay(80);check(!settled,'Publish waits for provider review revocation');await admin.query('COMMIT');check((await revoked).status===409,'Revoked provider review rejects in-flight publish');
 check((await admin.query('SELECT count(*)::int n FROM audit WHERE details<>\'{}\'')).rows[0].n===0,'Audit never contains coordinates');
 await admin.query('BEGIN');await admin.query('DROP TABLE job_tracking_operations;DROP TABLE job_tracking_current');await admin.query('ROLLBACK');check((await admin.query('SELECT 1 FROM job_tracking_current')).rowCount===1,'Disposable rollback retains tracking records; no production DROP planned');
 for(const path of paths)check(createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex')===hashes[path],'Stable exact source: '+path);
}catch(e){failure=e.stack||String(e);process.exitCode=1;}
finally{
 for(const c of clients)await c.end().catch(()=>{});
 if(server&&server.exitCode===null){try{command('pg_ctl',['-D',data,'-m','immediate','-w','stop']);}catch{server.kill('SIGTERM');}await new Promise(r=>{if(server.exitCode!==null)r();else server.once('exit',r);});}
 assert(tmp.startsWith('/tmp/ev-tracking-pg-'));await rm(tmp,{recursive:true,force:true});const report={at:new Date().toISOString(),version,success:!failure,checks,sourceHashes:hashes,failure,scope:'Disposable PostgreSQL schema/runtime/concurrency. Synthetic coordinates/accounts only; not physical/hosted acceptance.',...(failure?{log}:{})};
 if(process.env.TRACKING_PG_REPORT)await writeFile(process.env.TRACKING_PG_REPORT,JSON.stringify(report,null,2));console.log(JSON.stringify({success:!failure,version,checks:checks.length,failure}));
}
