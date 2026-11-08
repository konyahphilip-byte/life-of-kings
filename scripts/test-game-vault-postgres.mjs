import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,chmod,readFile,rm,mkdir,writeFile,realpath} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {Client} from 'pg';
import {createGameVault} from '../server/game-vault.mjs';
import {createGameControl} from '../server/game-control.mjs';
import {emptyVault,newProject} from '../shared/game-vault.mjs';
import {emptyWorkspace} from '../shared/game-control.mjs';
assert(process.env.PG_BINDIR,'Set existing local PG_BINDIR. No provider database is used.');
const bin=await realpath(process.env.PG_BINDIR),temp=await mkdtemp('/tmp/eco-vault-pg-');await chmod(temp,0o700);
const out=new URL('../work/ecogames-vault-20261108/',import.meta.url);await mkdir(out,{recursive:true});
let server,logs='',failure,version;const clients=[],checks=[];
function command(name,args){const r=spawnSync(join(bin,name),args,{encoding:'utf8',timeout:20000,env:{PATH:process.env.PATH,LC_ALL:'C'}});assert.equal(r.status,0,r.stderr||r.stdout);}
async function connect(user){const c=new Client({host:temp,port:54394,user,database:'postgres',ssl:false,connectionTimeoutMillis:2000,query_timeout:5000});c.on('error',()=>{});await c.connect();clients.push(c);return c;}
const check=(condition,name)=>{assert(condition,name);checks.push(name);};
function dependencies(client){const query=(s,p)=>{let i=0;return client.query(s.replace(/\?/g,()=>'$'+(++i)),p);};return {q:async(s,...p)=>(await query(s,p)).rows[0],all:async(s,...p)=>(await query(s,p)).rows,run:async(s,...p)=>({changes:(await query(s,p)).rowCount}),now:()=>new Date().toISOString(),rateLimit:async()=>{},available:true};}
const migration=await readFile(new URL('../supabase/migrations/20261108210000_game_vault.sql',import.meta.url),'utf8'),sha256=createHash('sha256').update(migration).digest('hex');
try{
 command('initdb',['-D',join(temp,'data'),'-U','postgres','--auth-local=trust','--auth-host=reject','--locale=C','--encoding=UTF8','--no-instructions']);
 server=spawn(join(bin,'postgres'),['-D',join(temp,'data'),'-k',temp,'-p','54394','-c','listen_addresses=','-c','unix_socket_permissions=0700'],{env:{PATH:process.env.PATH,LC_ALL:'C'},stdio:['ignore','ignore','pipe']});server.stderr.on('data',v=>logs=(logs+v).slice(-4000));
 let admin;for(let n=0;n<100;n++){try{admin=await connect('postgres');break;}catch{await delay(100);}}assert(admin,'Private PostgreSQL failed to start: '+logs);
 version=(await admin.query('SHOW server_version')).rows[0].server_version;
 await admin.query('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE ecovibes_api_runtime LOGIN;CREATE TABLE users(id uuid PRIMARY KEY);CREATE TABLE ecovibes_schema_version(version text PRIMARY KEY);');
 await admin.query(await readFile(new URL('../supabase/migrations/20261108150000_game_control_revisions.sql',import.meta.url),'utf8'));
 await admin.query(migration);check(true,'Exact Vault migration applies alongside existing Control Hub migration');
 const owner=randomUUID(),other=randomUUID();await admin.query('INSERT INTO users VALUES($1),($2)',[owner,other]);
 check((await admin.query("SELECT relrowsecurity FROM pg_class WHERE oid='game_vaults'::regclass")).rows[0].relrowsecurity,'Vault RLS enabled');
 for(const role of ['anon','authenticated','service_role']){await admin.query('SET ROLE '+role);for(const statement of ['SELECT * FROM game_vaults',"INSERT INTO game_vaults SELECT * FROM game_vaults",'UPDATE game_vaults SET revision=1','DELETE FROM game_vaults','TRUNCATE game_vaults']){await assert.rejects(()=>admin.query(statement),e=>e.code==='42501');check(true,role+' direct '+statement.split(' ')[0]+' denied');}await admin.query('RESET ROLE');}
 const one=await connect('ecovibes_api_runtime'),two=await connect('ecovibes_api_runtime'),a=createGameVault(dependencies(one)),b=createGameVault(dependencies(two)),ctx=id=>({user:{id,status:'active'}}),query=new URLSearchParams();
 for(const statement of ['DELETE FROM game_vaults','TRUNCATE game_vaults']){await assert.rejects(()=>one.query(statement),e=>e.code==='42501');check(true,'Runtime '+statement.split(' ')[0]+' denied');}
 const p=newProject('Synthetic private project');p.files=[{path:'main.gd',content:'synthetic-private-source-needle'}];
 const operation={expectedOwnerId:owner,revision:0,operationId:randomUUID(),consent:'private-storage-v1',vault:{...emptyVault(),projects:[p]}};
 const retries=await Promise.all([a.route(ctx(owner),'PUT',operation,query),b.route(ctx(owner),'PUT',{...operation,operationId:operation.operationId.toUpperCase()},query)]);
 check(retries.every(r=>r.revision===1),'Concurrent identical case-canonical retries acknowledge one save');
 check((await admin.query('SELECT count(*)::int n FROM game_vaults')).rows[0].n===1,'Exactly one actual current PostgreSQL row');
 const fork1={...operation,revision:1,operationId:randomUUID()},fork2={...fork1,operationId:randomUUID(),vault:{...emptyVault(),projects:[{...p,story:'Other client change'}]}};
 const forks=await Promise.allSettled([a.route(ctx(owner),'PUT',fork1,query),b.route(ctx(owner),'PUT',fork2,query)]);
 check(forks.filter(r=>r.status==='fulfilled').length===1&&forks.some(r=>r.status==='rejected'&&r.reason.status===409),'Concurrent divergent edits produce one ACK and one conflict');
 check((await a.route(ctx(other),'GET',{},query)).revision===0,'Other account sees no private source');
 const old=await a.route(ctx(owner),'PUT',operation,query);check(old.revision===2&&old.savedRevision===1,'Old receipt retry reports current head without restoring history');
 const before=(await admin.query('SELECT * FROM game_vaults')).rows[0];
 await admin.query("CREATE FUNCTION reject_vault_fixture() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic write failure';END$$;CREATE TRIGGER fail_vault BEFORE UPDATE ON game_vaults FOR EACH ROW EXECUTE FUNCTION reject_vault_fixture();");
 await assert.rejects(()=>a.route(ctx(owner),'PUT',{...operation,revision:2,operationId:randomUUID(),vault:emptyVault()},query));
 check(JSON.stringify((await admin.query('SELECT * FROM game_vaults')).rows[0])===JSON.stringify(before),'Failed database statement leaves content and receipts unchanged atomically');
 await admin.query('DROP TRIGGER fail_vault ON game_vaults;DROP FUNCTION reject_vault_fixture();');
 const removed=await a.route(ctx(owner),'PUT',{...operation,revision:2,operationId:randomUUID(),vault:emptyVault()},query);
 check(removed.revision===3&&removed.vault.projects.length===0,'Runtime can update the owner row to remove source');
 check(!JSON.stringify((await admin.query('SELECT snapshot_json,receipts_json FROM game_vaults')).rows[0]).includes('synthetic-private-source-needle'),'No removed raw source retained in current payload or receipts');
 for(let revision=3;revision<54;revision++)await a.route(ctx(owner),'PUT',{...operation,revision,operationId:randomUUID(),vault:emptyVault()},query);
 check((await admin.query('SELECT jsonb_array_length(receipts_json) n FROM game_vaults')).rows[0].n===50,'Operation receipt retention bounded to latest fifty');
 await assert.rejects(()=>a.route(ctx(owner),'PUT',operation,query),e=>e.status===409);check(true,'Pruned old operation cannot overwrite current source');
 const control=createGameControl(dependencies(one));check((await control.route(ctx(owner),'PUT',{expectedOwnerId:owner,revision:0,operationId:randomUUID(),workspace:emptyWorkspace()},query)).revision===1,'Existing Control Hub still saves after coexisting migrations');
 check((await admin.query("SELECT count(*)::int n FROM ecovibes_schema_version WHERE version IN ('20261108150000_game_control_revisions','20261108210000_game_vault')")).rows[0].n===2,'Both exact schema markers retained');
}catch(e){failure=String(e);console.error(e);}
finally{for(const c of clients)await c.end().catch(()=>{});if(server&&server.exitCode===null){const closed=new Promise(r=>server.once('close',r));server.kill('SIGTERM');await closed;}await rm(temp,{recursive:true,force:true});const report={passed:!failure,checks,version,migrationSha256:sha256,failure,scope:'Disposable socket-only PostgreSQL and synthetic source; production migration unapplied. No disk/backups erasure claim.'};await writeFile(new URL('postgres.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(failure)process.exitCode=1;}
