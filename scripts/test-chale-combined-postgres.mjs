import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,chmod,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import {Client} from 'pg';

const root=fileURLToPath(new URL('../',import.meta.url));
const bin=process.env.PG_BINDIR;
assert(bin,'Use the existing local PostgreSQL binaries; never a hosted database.');
const temp=await mkdtemp(join(tmpdir(),'ev-chale-combined-pg-'));
await chmod(temp,0o700);
const data=join(temp,'data'),clients=[],checks=[],migrations=[];
let server,failure,serverVersion;
const check=(condition,label)=>{assert(condition,label);checks.push(label);};
async function connect(){
 const client=new Client({host:temp,port:54394,database:'postgres',user:'postgres',ssl:false,connectionTimeoutMillis:2000,query_timeout:5000});
 client.on('error',()=>{});await client.connect();clients.push(client);return client;
}
const tables=['knowledge_sources','knowledge_versions','knowledge_chunks','knowledge_events','chale_history_settings','chale_conversations','chale_turns','knowledge_sync_jobs','knowledge_sync_snapshots','knowledge_sync_events'];
try{
 const init=spawnSync(join(bin,'initdb'),['-D',data,'-U','postgres','--auth-local=trust','--auth-host=reject','--no-instructions','--locale=C','--encoding=UTF8'],{encoding:'utf8',env:{PATH:process.env.PATH,LC_ALL:'C'},timeout:20000});
 assert.equal(init.status,0,init.stderr);
 server=spawn(join(bin,'postgres'),['-D',data,'-k',temp,'-p','54394','-c','listen_addresses=','-c','unix_socket_permissions=0700'],{env:{PATH:process.env.PATH,LC_ALL:'C'},stdio:'ignore'});
 let admin;
 for(let attempt=0;attempt<100;attempt++){try{admin=await connect();break;}catch{await delay(100);}}
 assert(admin,'Private PostgreSQL startup failed');
 serverVersion=(await admin.query('SHOW server_version')).rows[0].server_version;
 await admin.query('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE ecovibes_api_runtime LOGIN;CREATE TABLE users(id uuid PRIMARY KEY,status text);CREATE TABLE sessions(token_hash text PRIMARY KEY,user_id uuid REFERENCES users(id),expires_at text);GRANT SELECT ON users,sessions TO ecovibes_api_runtime;GRANT UPDATE(id) ON users TO ecovibes_api_runtime;CREATE TABLE ecovibes_schema_version(version text PRIMARY KEY);');
 for(const file of ['20261106184616_chale_knowledge_studio.sql','20261106220412_chale_conversation_history.sql','20261107064239_chale_knowledge_sync.sql']){
  const body=await readFile(join(root,'supabase/migrations',file),'utf8');
  await admin.query(body);
  migrations.push({file,sha256:createHash('sha256').update(body).digest('hex')});
  check(true,'Exact migration applied: '+file);
 }
 check(Number((await admin.query('SELECT count(*) n FROM ecovibes_schema_version')).rows[0].n)===3,'All three distinct schema markers coexist');
 for(const table of tables){
  check((await admin.query('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass',['public.'+table])).rows[0].relrowsecurity,table+' retains RLS');
  for(const role of ['anon','authenticated','service_role']){
   await admin.query('SET ROLE '+role);
   try{await assert.rejects(()=>admin.query('SELECT * FROM '+table),error=>error.code==='42501');check(true,role+' direct read denied: '+table);}
   finally{await admin.query('RESET ROLE');}
  }
  check(!(await admin.query("SELECT has_table_privilege('ecovibes_api_runtime',$1,'TRUNCATE') ok",['public.'+table])).rows[0].ok,'Runtime cannot truncate '+table);
 }
 for(const table of ['knowledge_versions','knowledge_chunks','knowledge_events','knowledge_sync_events']){
  for(const privilege of ['UPDATE','DELETE']){
   check(!(await admin.query("SELECT has_table_privilege('ecovibes_api_runtime',$1,$2) ok",['public.'+table,privilege])).rows[0].ok,'Immutable public evidence denies '+privilege+': '+table);
  }
 }
 check((await admin.query("SELECT has_table_privilege('ecovibes_api_runtime','public.chale_turns','DELETE') ok")).rows[0].ok,'Private turn erasure retains its narrow DELETE grant');
 check(!(await admin.query("SELECT has_table_privilege('ecovibes_api_runtime','public.chale_conversations','DELETE') ok")).rows[0].ok,'Conversation deletion identifiers cannot be physically deleted');
 check((await admin.query("SELECT has_table_privilege('ecovibes_api_runtime','public.knowledge_sync_snapshots','DELETE') ok")).rows[0].ok,'Expiring staged source text retains its narrow DELETE grant');
 check((await admin.query("SELECT has_column_privilege('ecovibes_api_runtime','public.sessions','token_hash','UPDATE') ok")).rows[0].ok,'Existing-session row locking grant is retained');
 check(!(await admin.query("SELECT has_column_privilege('ecovibes_api_runtime','public.sessions','user_id','UPDATE') ok")).rows[0].ok,'Session owner reassignment is not granted');
}catch(error){failure={name:error.name,message:error.message};}
finally{
 await Promise.allSettled(clients.map(client=>client.end()));
 if(server&&server.exitCode===null){const exited=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await exited;}
 await rm(temp,{recursive:true,force:true});
}
const result={passed:!failure,serverVersion,checks,migrations,failure:failure??null,scope:'One disposable local PostgreSQL database, exact three proposed migrations and synthetic base schema. No hosted migration, user records, runtime authorization certification or deployment.'};
if(process.env.CHALE_COMBINED_PG_REPORT)await writeFile(process.env.CHALE_COMBINED_PG_REPORT,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(failure)process.exitCode=1;
