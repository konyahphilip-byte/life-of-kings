import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,chmod,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {randomUUID} from 'node:crypto';
import {Client} from 'pg';
import {createKnowledgeService} from '../server/chale-knowledge.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),bin=process.env.PG_BINDIR;
assert(bin,'Set PG_BINDIR to existing local PostgreSQL binaries; no hosted database is used.');
const temp=await mkdtemp('/tmp/ev-knowledge-pg-');await chmod(temp,0o700);const data=join(temp,'data'),clients=[],checks=[];let server,failure,serverVersion;let clock='2026-11-06T00:00:00.000Z';
const check=(ok,label)=>{assert(ok,label);checks.push(label);};
async function connect(user){const c=new Client({host:temp,port:54392,database:'postgres',user,ssl:false,connectionTimeoutMillis:2000,query_timeout:5000});c.on('error',()=>{});await c.connect();clients.push(c);return c;}
function service(c){const query=(s,p)=>{let i=0;return c.query(s.replace(/\?/g,()=>'$'+ ++i),p);};return createKnowledgeService({q:async(s,...p)=>(await query(s,p)).rows[0],all:async(s,...p)=>(await query(s,p)).rows,run:async(s,...p)=>({changes:(await query(s,p)).rowCount}),transaction:async work=>{await c.query('BEGIN');try{const r=await work();await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}},assert:(ok,status,code,message)=>{if(!ok)throw Object.assign(Error(message),{status,code});},requireAdmin:ctx=>assert(ctx.user.roles.includes('admin')),now:()=>clock,enabled:true,available:true,postgresMode:true});}
try{
 const init=spawnSync(join(bin,'initdb'),['-D',data,'-U','postgres','--auth-local=trust','--auth-host=reject','--no-instructions','--locale=C','--encoding=UTF8'],{encoding:'utf8',env:{PATH:process.env.PATH,LC_ALL:'C'},timeout:20000});assert.equal(init.status,0,init.stderr);
 server=spawn(join(bin,'postgres'),['-D',data,'-k',temp,'-p','54392','-c','listen_addresses=','-c','unix_socket_permissions=0700'],{env:{PATH:process.env.PATH,LC_ALL:'C'},stdio:'ignore'});
 let admin;for(let i=0;i<100;i++){try{admin=await connect('postgres');break;}catch{await delay(100);}}assert(admin,'Private PostgreSQL startup failed');serverVersion=(await admin.query('SHOW server_version')).rows[0].server_version;
 await admin.query('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE ecovibes_api_runtime LOGIN;CREATE TABLE users(id uuid PRIMARY KEY);CREATE TABLE ecovibes_schema_version(version text PRIMARY KEY);');
 await admin.query(await readFile(join(root,'supabase/migrations/20261106184616_chale_knowledge_studio.sql'),'utf8'));check(true,'Exact proposed migration applies in disposable PostgreSQL');
 const tables=['knowledge_sources','knowledge_versions','knowledge_chunks','knowledge_events'];for(const table of tables){check((await admin.query('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass',['public.'+table])).rows[0].relrowsecurity,table+' RLS enabled');for(const role of ['anon','authenticated','service_role']){await admin.query('SET ROLE '+role);await assert.rejects(()=>admin.query('SELECT * FROM '+table),e=>e.code==='42501');check(true,role+' cannot read '+table);await admin.query('RESET ROLE');}}
 const actor={user:{id:randomUUID(),roles:['admin']}};await admin.query('INSERT INTO users VALUES($1)',[actor.user.id]);
 const runtime=await connect('ecovibes_api_runtime'),other=await connect('ecovibes_api_runtime'),a=service(runtime),b=service(other),id=randomUUID(),input={id,title:'Synthetic public guide',sourceUrl:'https://example.org/guide',license:'CC0-1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',attribution:'Synthetic test',category:'recycling',language:'en',region:'GH',text:'Separate clean bottles.',expiresAt:'2026-11-20T00:00:00.000Z',publicContentConfirmed:true};
 const creates=await Promise.allSettled([a.create(actor,input),b.create(actor,input)]);check(creates.every(r=>r.status==='fulfilled'),'Concurrent identical create retries return one stable source');check(Number((await admin.query('SELECT count(*) FROM knowledge_sources')).rows[0].count)===1,'Concurrent retries persist exactly one source');check((await a.search(actor,{q:'bottles'})).items.length===0,'Unpublished PostgreSQL text is excluded');await a.publish(actor,id,{revision:1,version:1,reviewed:true});check((await a.search(actor,{q:'bottles'})).items[0].version===1,'Runtime writes and cited retrieval work under RLS');
 for(const table of tables){for(const verb of ['DELETE','TRUNCATE']){await assert.rejects(()=>runtime.query(verb==='DELETE'?'DELETE FROM '+table:'TRUNCATE '+table),e=>e.code==='42501');check(true,'Runtime '+verb+' denied for '+table);}}
 for(const table of tables.slice(1)){await assert.rejects(()=>runtime.query('UPDATE '+table+' SET source_id=source_id'),e=>e.code==='42501');check(true,'Runtime cannot mutate immutable '+table);}
 await assert.rejects(()=>runtime.query('UPDATE knowledge_sources SET title=title'),e=>e.code==='42501');check(true,'Runtime cannot change immutable source provenance');
 await a.revise(actor,id,{revision:2,text:'Collect dry metal.',expiresAt:input.expiresAt,publicContentConfirmed:true});
 const outcomes=await Promise.allSettled([a.publish(actor,id,{revision:3,version:2,reviewed:true}),b.withdraw(actor,id,{revision:3})]);check(outcomes.filter(r=>r.status==='fulfilled').length===1&&outcomes.filter(r=>r.status==='rejected'&&r.reason.code==='knowledge_changed').length===1,'Concurrent publish/withdraw admits one revision only');
 const current=await a.read(actor,id);await a.publish(actor,id,{revision:current.revision,version:1,reviewed:true});clock=input.expiresAt;check((await a.search(actor,{q:'bottles'})).items.length===0,'PostgreSQL retrieval excludes expired versions');
 check(Number((await admin.query('SELECT count(*) FROM knowledge_versions')).rows[0].count)===2,'Version history remains immutable after rollback and races');
}catch(e){failure={name:e.name,message:e.message};}
finally{for(const c of clients)await c.end().catch(()=>{});if(server&&server.exitCode===null){const stopped=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await stopped;}await rm(temp,{recursive:true,force:true});}
const result={passed:!failure,serverVersion,checks,failure:failure||null,scope:'Disposable local PostgreSQL and synthetic public documents only; migration not applied to Supabase.'};if(process.env.CHALE_KNOWLEDGE_PG_REPORT)await writeFile(process.env.CHALE_KNOWLEDGE_PG_REPORT,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(failure)process.exitCode=1;

