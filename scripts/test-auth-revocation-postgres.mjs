import assert from 'node:assert/strict';
import { Client } from 'pg';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, chmod, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createAuthRevocations } from '../server/auth-revocations.mjs';

// Disposable cluster, private Unix socket, TCP disabled, synthetic application
// rows only. No application environment, provider or private Auth schema.
const config=process.env.PG_BINDIR?null:spawnSync('pg_config',['--bindir'],{encoding:'utf8'});
const bin=process.env.PG_BINDIR||config?.stdout?.trim();
assert(bin,'Set PG_BINDIR to an installed PostgreSQL bin directory.');
const temp=await mkdtemp(join(tmpdir(),'ev-auth-pg-'));await chmod(temp,0o700);
const data=join(temp,'data'),clients=[],checks=[];
const migrationUrl=new URL('../supabase/migrations/20261027121500_identity_auth_revocations.sql',import.meta.url);
const migration=await readFile(migrationUrl,'utf8');
let child,log='',clock=1000;
function command(name,args){const r=spawnSync(join(bin,name),args,{env:{PATH:process.env.PATH,LC_ALL:'C'},encoding:'utf8',timeout:20000});assert.equal(r.status,0,r.stderr||r.stdout);return r.stdout;}
async function connect(user){const c=new Client({host:temp,port:54392,user,database:'postgres',ssl:false,connectionTimeoutMillis:1500,query_timeout:5000});c.on('error',()=>{});await c.connect();clients.push(c);return c;}
const check=(value,label)=>{assert(value,label);checks.push(label);};
function bound(client){
 const query=(sql,p=[])=>{let n=0;return client.query(sql.replace(/\?/g,()=>`$${++n}`),p);};
 const service=createAuthRevocations({q:async(sql,...p)=>(await query(sql,p)).rows[0],run:async(sql,...p)=>({changes:(await query(sql,p)).rowCount}),postgresMode:true,nowSeconds:()=>clock});
 const transaction=async work=>{await client.query('BEGIN');try{const r=await work();await client.query('COMMIT');return r;}catch(e){await client.query('ROLLBACK');throw e;}};
 return{service,transaction};
}
try{
 const version=command('postgres',['--version']).trim();
 command('initdb',['-D',data,'-U','postgres','--auth-local=trust','--auth-host=reject','--no-instructions','--locale=C','--encoding=UTF8']);
 child=spawn(join(bin,'postgres'),['-D',data,'-k',temp,'-p','54392','-c','listen_addresses=','-c','unix_socket_permissions=0700'],{env:{PATH:process.env.PATH,LC_ALL:'C'},stdio:['ignore','ignore','pipe']});
 child.stderr.on('data',b=>{log=(log+b).slice(-4000);});
 let admin;for(let n=0;n<100;n++){try{admin=await connect('postgres');break;}catch{await delay(100);}}
 assert(admin,`Private PostgreSQL failed to start: ${log}`);
 await admin.query(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE ecovibes_api_runtime LOGIN;
 CREATE TABLE users(id uuid PRIMARY KEY);CREATE TABLE sessions(token_hash uuid PRIMARY KEY,user_id uuid REFERENCES users(id));CREATE TABLE ecovibes_schema_version(version text PRIMARY KEY);
 GRANT SELECT,UPDATE(id) ON users TO ecovibes_api_runtime;GRANT SELECT,INSERT,DELETE ON sessions TO ecovibes_api_runtime;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;`);
 await admin.query(migration);check(true,'Exact additive migration applies');
 const tables=['identity_auth_state','identity_provider_sessions','auth_revocation_operations'];
 for(const table of tables){
  check((await admin.query('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass',[`public.${table}`])).rows[0].relrowsecurity,`${table} RLS enabled`);
  for(const role of ['anon','authenticated','service_role'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])check(!(await admin.query('SELECT has_table_privilege($1,$2,$3) ok',[role,table,privilege])).rows[0].ok,`${role} ${table} ${privilege} denied`);
  for(const privilege of ['DELETE','TRUNCATE'])check(!(await admin.query('SELECT has_table_privilege($1,$2,$3) ok',['ecovibes_api_runtime',table,privilege])).rows[0].ok,`runtime ${table} ${privilege} denied`);
 }
 check(!(await admin.query("SELECT has_table_privilege('ecovibes_api_runtime','auth_revocation_operations','UPDATE') ok")).rows[0].ok,'Operation results immutable to runtime');
 const A=randomUUID(),B=randomUUID();await admin.query('INSERT INTO users VALUES($1),($2)',[A,B]);
 const one=await connect('ecovibes_api_runtime'),two=await connect('ecovibes_api_runtime'),s1=bound(one),s2=bound(two),sid=randomUUID();
 const proof={sessionId:sid,primaryAuthAt:900,issuedAt:900,expiresAt:4600},operation=randomUUID();
 await one.query('BEGIN');await s1.service.admit(A,proof);await one.query('INSERT INTO sessions VALUES($1,$2)',[randomUUID(),A]);
 let finished=false;const cleanup=s2.transaction(()=>s2.service.revoke(A,proof,operation)).finally(()=>{finished=true;});
 await delay(80);check(!finished,'Cleanup waits for in-flight admission lock');await one.query('COMMIT');await cleanup;
 check((await admin.query('SELECT count(*)::int n FROM sessions WHERE user_id=$1',[A])).rows[0].n===0,'Admission committed before cleanup is deleted');
 clock=1200;const fresh={...proof,sessionId:randomUUID(),primaryAuthAt:1100,issuedAt:1100};
 await s1.transaction(async()=>{await s1.service.admit(A,fresh);await one.query('INSERT INTO sessions VALUES($1,$2)',[randomUUID(),A]);});
 await s2.transaction(()=>s2.service.revoke(A,proof,operation));
 check((await admin.query('SELECT count(*)::int n FROM sessions WHERE user_id=$1',[A])).rows[0].n===1,'Response-lost cleanup retry preserves fresh session');
 await assert.rejects(()=>s2.transaction(()=>s2.service.revoke(A,proof,randomUUID())),e=>e.code==='fresh_signin_required');check(true,'Different replay cannot revoke newer access');
 await one.query('BEGIN');await s1.service.revoke(A,fresh,randomUUID());
 finished=false;const admission=s2.transaction(()=>s2.service.admit(A,fresh)).then(()=>({allowed:true}),e=>({code:e.code})).finally(()=>{finished=true;});
 await delay(80);check(!finished,'Admission waits for in-flight revocation lock');await one.query('COMMIT');
 check((await admission).code==='fresh_signin_required','Queued stale admission denied after revocation commit');
 const same=randomUUID();const retries=await Promise.all([s1.transaction(()=>s1.service.revoke(B,proof,same)),s2.transaction(()=>s2.service.revoke(B,proof,same))]);
 check(retries.filter(r=>r.replayed).length===1,'Concurrent identical operation performs exactly one revocation');
 check((await admin.query('SELECT count(*)::int n FROM auth_revocation_operations WHERE user_id=$1',[B])).rows[0].n===1,'Concurrent retry stores one immutable owner-bound result');
 clock=1400;const rollbackSid=randomUUID();
 await assert.rejects(()=>s1.transaction(async()=>{await s1.service.admit(A,{...proof,sessionId:rollbackSid,primaryAuthAt:1300,issuedAt:1300});await one.query('INSERT INTO sessions VALUES(NULL,$1)',[A]);}));
 check((await admin.query('SELECT count(*)::int n FROM identity_provider_sessions WHERE provider_session_id=$1',[rollbackSid])).rows[0].n===0,'Failed issuance rolls back admission bookkeeping');
 await admin.query('BEGIN');await admin.query('DROP TABLE auth_revocation_operations,identity_provider_sessions,identity_auth_state');await admin.query('ROLLBACK');
 check((await admin.query('SELECT count(*)::int n FROM identity_auth_state')).rows[0].n===2,'Disposable schema rollback preserves revocation barriers');
 check(await readFile(migrationUrl,'utf8')===migration,'Exact source migration unchanged during checks');
 console.log(JSON.stringify({status:'PASS',version,checks:checks.length,details:checks,migrationSha256:createHash('sha256').update(migration).digest('hex'),hosted:false}));
}finally{
 for(const client of clients)await client.end().catch(()=>{});
 if(child&&child.exitCode===null){try{command('pg_ctl',['-D',data,'-m','immediate','-w','stop']);}catch{child.kill('SIGTERM');}await new Promise(done=>{if(child.exitCode!==null)done();else child.once('exit',done);});}
 await rm(temp,{recursive:true,force:true});
}
