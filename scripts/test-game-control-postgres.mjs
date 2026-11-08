import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,chmod,readFile,rm,mkdir,writeFile,realpath} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {Client} from 'pg';
import {createGameControl} from '../server/game-control.mjs';
import {emptyWorkspace} from '../shared/game-control.mjs';
assert(process.env.PG_BINDIR,'Set the existing local PG_BINDIR. No provider database is used.');
const bin=await realpath(process.env.PG_BINDIR),temp=await mkdtemp('/tmp/eco-control-pg-');await chmod(temp,0o700);
const out=new URL('../work/ecogames-control-20261108/',import.meta.url);await mkdir(out,{recursive:true});
let server,logs='',failure,version;const clients=[],checks=[];
function command(name,args){const r=spawnSync(join(bin,name),args,{encoding:'utf8',timeout:20000,env:{PATH:process.env.PATH,LC_ALL:'C'}});assert.equal(r.status,0,r.stderr||r.stdout);}
async function connect(user){const c=new Client({host:temp,port:54393,user,database:'postgres',ssl:false,connectionTimeoutMillis:2000,query_timeout:5000});c.on('error',()=>{});await c.connect();clients.push(c);return c;}
const check=(condition,name)=>{assert(condition,name);checks.push(name);};
function service(client){const query=(s,p)=>{let i=0;return client.query(s.replace(/\?/g,()=>'$'+(++i)),p);};return createGameControl({q:async(s,...p)=>(await query(s,p)).rows[0],all:async(s,...p)=>(await query(s,p)).rows,run:async(s,...p)=>({changes:(await query(s,p)).rowCount}),now:()=>new Date().toISOString(),rateLimit:async()=>{},available:true});}
const migrationURL=new URL('../supabase/migrations/20261108150000_game_control_revisions.sql',import.meta.url),migration=await readFile(migrationURL,'utf8'),sha256=createHash('sha256').update(migration).digest('hex');
try{
 command('initdb',['-D',join(temp,'data'),'-U','postgres','--auth-local=trust','--auth-host=reject','--locale=C','--encoding=UTF8','--no-instructions']);
 server=spawn(join(bin,'postgres'),['-D',join(temp,'data'),'-k',temp,'-p','54393','-c','listen_addresses=','-c','unix_socket_permissions=0700'],{env:{PATH:process.env.PATH,LC_ALL:'C'},stdio:['ignore','ignore','pipe']});server.stderr.on('data',v=>logs=(logs+v).slice(-4000));
 let admin;for(let n=0;n<100;n++){try{admin=await connect('postgres');break;}catch{await delay(100);}}assert(admin,'Private PostgreSQL failed to start: '+logs);
 version=(await admin.query('SHOW server_version')).rows[0].server_version;
 await admin.query('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE ecovibes_api_runtime LOGIN;CREATE TABLE users(id uuid PRIMARY KEY);CREATE TABLE ecovibes_schema_version(version text PRIMARY KEY);');
 await admin.query(migration);check(true,'Exact additive migration applies to actual local PostgreSQL');
 const owner=randomUUID(),other=randomUUID();await admin.query('INSERT INTO users VALUES($1),($2)',[owner,other]);
 check((await admin.query("SELECT relrowsecurity FROM pg_class WHERE oid='game_control_revisions'::regclass")).rows[0].relrowsecurity,'RLS enabled');
 for(const role of ['anon','authenticated','service_role']){await admin.query('SET ROLE '+role);for(const statement of ['SELECT * FROM game_control_revisions','UPDATE game_control_revisions SET revision=1','DELETE FROM game_control_revisions','TRUNCATE game_control_revisions']){await assert.rejects(()=>admin.query(statement),e=>e.code==='42501');check(true,role+' direct '+statement.split(' ')[0]+' denied');}await admin.query('RESET ROLE');}
 const one=await connect('ecovibes_api_runtime'),two=await connect('ecovibes_api_runtime'),a=service(one),b=service(two),ctx=id=>({user:{id,status:'active'}});
 for(const statement of ['DELETE FROM game_control_revisions','UPDATE game_control_revisions SET revision=1','TRUNCATE game_control_revisions']){await assert.rejects(()=>one.query(statement),e=>e.code==='42501');check(true,'Runtime append-only '+statement.split(' ')[0]+' denied');}
 const operation={expectedOwnerId:owner,revision:0,operationId:randomUUID(),workspace:emptyWorkspace()};
 const retries=await Promise.all([a.route(ctx(owner),'PUT',operation,new URLSearchParams()),b.route(ctx(owner),'PUT',operation,new URLSearchParams())]);
 check(retries.every(r=>r.revision===1),'Concurrent identical retries yield one acknowledged revision');
 check((await admin.query('SELECT count(*)::int n FROM game_control_revisions')).rows[0].n===1,'Exactly one actual PostgreSQL revision persisted');
 const fork1={...operation,revision:1,operationId:randomUUID()},fork2={...fork1,operationId:randomUUID()};
 const forks=await Promise.allSettled([a.route(ctx(owner),'PUT',fork1,new URLSearchParams()),b.route(ctx(owner),'PUT',fork2,new URLSearchParams())]);
 check(forks.filter(r=>r.status==='fulfilled').length===1&&forks.some(r=>r.status==='rejected'&&r.reason.status===409),'Concurrent divergent edits conflict without lost update');
 check((await a.route(ctx(other),'GET',{},new URLSearchParams())).revision===0,'Other account cannot select private revisions through service');
 check((await b.route(ctx(owner),'GET',{},new URLSearchParams())).revision===2,'Second runtime client sees durable current state');
}catch(e){failure=String(e);console.error(e);}
finally{for(const c of clients)await c.end().catch(()=>{});if(server&&server.exitCode===null){const closed=new Promise(r=>server.once('close',r));server.kill('SIGTERM');await closed;}await rm(temp,{recursive:true,force:true});const report={passed:!failure,checks,version,migrationSha256:sha256,failure,scope:'Disposable socket-only PostgreSQL with synthetic accounts; production migration remains unapplied'};await writeFile(new URL('postgres.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(failure)process.exitCode=1;}
