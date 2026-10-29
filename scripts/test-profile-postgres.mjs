import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,chmod,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
const source=fileURLToPath(new URL('../',import.meta.url));
const {Client}=createRequire(join(source,'package.json'))('pg');
const {createPeopleFriends}=await import(join(source,'server/people-friends.mjs'));
const {createDirectMessages}=await import(join(source,'server/direct-messages.mjs'));
const {createPeopleProfile}=await import(join(source,'server/people-profile.mjs'));
assert(process.env.PG_BINDIR,'Set PG_BINDIR to an existing PostgreSQL bin directory. No provider/database environment is used.');
const bin=await realpath(process.env.PG_BINDIR);
const tmp=await mkdtemp('/tmp/ev-profile-pg-');await chmod(tmp,0o700);const data=join(tmp,'data');
const clients=[],checks=[];let server,log='',failure=null,serverVersion=null;
const sourcePaths=['server/people-friends.mjs','server/index.mjs','supabase/migrations/20261026233442_connect_friend_requests.sql','server/direct-messages.mjs','supabase/migrations/20261027070000_connect_direct_messages.sql','supabase/migrations/20261028220000_connect_message_receipts.sql','server/people-profile.mjs','supabase/migrations/20261028233000_people_profile_media.sql'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashes=Object.fromEntries(await Promise.all(sourcePaths.map(async path=>[path,hash(await readFile(join(source,path)))])));
function command(name,args){const result=spawnSync(join(bin,name),args,{encoding:'utf8',env:{PATH:process.env.PATH,LC_ALL:'C'},timeout:20000});assert.equal(result.status,0,result.stderr||result.stdout);return result.stdout;}
async function connect(user){const client=new Client({host:tmp,port:54391,user,database:'postgres',ssl:false,connectionTimeoutMillis:2000,query_timeout:5000});client.on('error',()=>{});await client.connect();clients.push(client);return client;}
function check(value,message){assert(value,message);checks.push(message);}
function service(client){
 const query=(sql,p=[])=>{let i=0;return client.query(sql.replace(/\?/g,()=>`$${++i}`),p);};
 return createPeopleFriends({q:async(sql,...p)=>(await query(sql,p)).rows[0],all:async(sql,...p)=>(await query(sql,p)).rows,run:async(sql,...p)=>({changes:(await query(sql,p)).rowCount}),
 transaction:async(work)=>{await client.query('BEGIN');try{const r=await work();await client.query('COMMIT');return r;}catch(e){await client.query('ROLLBACK');throw e;}},
 assert:(value,status,code,message)=>{if(!value)throw Object.assign(Error(message),{status,code});},now:()=>new Date().toISOString(),postgresMode:true,rateLimit:async()=>{},
 notify:async(...p)=>query('INSERT INTO notifications VALUES(?,?,?,?,?,?)',p),event:async(actor,type,id,event,details)=>query('INSERT INTO domain_events VALUES(?,?,?,?,?)',[actor,type,id,event,JSON.stringify(details)])});
}
try{
 command('initdb',['-D',data,'-U','postgres','--auth-local=trust','--auth-host=reject','--no-instructions','--locale=C','--encoding=UTF8']);
 server=spawn(join(bin,'postgres'),['-D',data,'-k',tmp,'-p','54391','-c','listen_addresses=','-c','unix_socket_permissions=0700'],{env:{PATH:process.env.PATH,LC_ALL:'C'},stdio:['ignore','ignore','pipe']});
 server.stderr.on('data',bytes=>{log=(log+bytes.toString()).slice(-4000);});
 let admin;
 for(let i=0;i<100;i++){try{admin=await connect('postgres');break;}catch{await delay(100);}}
 assert(admin,'Private local PostgreSQL failed to start');
 serverVersion=(await admin.query('SHOW server_version')).rows[0].server_version;
 await admin.query(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE ecovibes_api_runtime LOGIN;
 CREATE TABLE users(id uuid PRIMARY KEY,eco_id text,display_name text,status text);
 CREATE TABLE media_assets(id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users(id),mime_type text NOT NULL);
 CREATE TABLE people_follows(user_id uuid NOT NULL REFERENCES users(id),target_user_id uuid NOT NULL REFERENCES users(id),PRIMARY KEY(user_id,target_user_id));
 GRANT SELECT ON media_assets,people_follows TO ecovibes_api_runtime;
 CREATE TABLE notifications(user_id uuid,type text,title text,body text,target_type text,target_id text);
 CREATE TABLE domain_events(actor_id uuid,aggregate_type text,aggregate_id text,event_type text,details text);
 CREATE TABLE ecovibes_schema_version(version text PRIMARY KEY);
 GRANT SELECT,UPDATE(id) ON users TO ecovibes_api_runtime;
 GRANT INSERT ON notifications,domain_events TO ecovibes_api_runtime;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;`);
 const migration=await readFile(join(source,sourcePaths[2]),'utf8');await admin.query(migration);check(true,'Actual unchanged migration applies to PostgreSQL with API runtime role');
 const security=(await admin.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.people_friendships'::regclass")).rows[0];check(security.relrowsecurity,'Friendship table RLS enabled');
 for(const role of ['anon','authenticated','service_role']){
  await admin.query(`SET ROLE ${role}`);
  for(const sql of ['SELECT * FROM people_friendships','DELETE FROM people_friendships','TRUNCATE people_friendships',"INSERT INTO people_friendships(low_user_id,high_user_id,updated_at) VALUES(gen_random_uuid(),gen_random_uuid(),now())","UPDATE people_friendships SET status='accepted'"]){await assert.rejects(()=>admin.query(sql),e=>e.code==='42501');check(true,`${role} direct friendship access denied: ${sql.split(' ')[0]}`);}
  await admin.query('RESET ROLE');
 }
 const A=randomUUID(),B=randomUUID(),C=randomUUID();for(const [id,name] of [[A,'alpha'],[B,'beta'],[C,'gamma']])await admin.query('INSERT INTO users VALUES($1,$2,$2,\'active\')',[id,name]);
 const one=await connect('ecovibes_api_runtime'),two=await connect('ecovibes_api_runtime'),s1=service(one),s2=service(two);
 await assert.rejects(()=>one.query('DELETE FROM people_friendships'),e=>e.code==='42501');check(true,'API runtime has no DELETE');
 await assert.rejects(()=>one.query('TRUNCATE people_friendships'),e=>e.code==='42501');check(true,'API runtime has no TRUNCATE');
 const crossed=await Promise.allSettled([s1.act(A,B,{action:'request',revision:0}),s2.act(B,A,{action:'request',revision:0})]);
 check(crossed.filter(x=>x.status==='fulfilled').length===1,'Concurrent opposite requests produce exactly one pending request');
 check(crossed.some(x=>x.status==='rejected'&&x.reason.status===409),'Losing crossed request conflicts instead of auto-accepting');
 const row=(await admin.query('SELECT * FROM people_friendships')).rows[0],sender=row.requester_id,recipient=sender===A?B:A;
 check((await s1.get(recipient,sender)).state==='incoming','Recipient observes saved incoming request on real Postgres');
 check((await s1.list(C)).incoming.length===0,'Unrelated account cannot list pair');
 check((await s1.act(recipient,sender,{action:'accept',revision:1})).state==='friends','Recipient acceptance persists');
 check((await s2.get(sender,recipient)).state==='friends','Other PostgreSQL client observes accepted friendship');
 await s1.act(sender,recipient,{action:'block',revision:2});
 check((await s2.get(recipient,sender)).state==='unavailable','Block immediately revokes relationship for other client');
 await assert.rejects(()=>s2.act(recipient,sender,{action:'accept',revision:2}),e=>e.status===409);check(true,'Stale accepted-state write cannot restore blocked friendship');
 await s1.act(recipient,sender,{action:'block',revision:3});await s2.act(sender,recipient,{action:'unblock',revision:4});
 check((await s1.get(sender,recipient)).state==='unavailable','Independent opposite block survives first unblock');
 check((await admin.query('SELECT count(*)::int n FROM notifications')).rows[0].n===2,'Request and acceptance each create exactly one notification');
 check((await admin.query('SELECT count(*)::int n FROM domain_events')).rows[0].n===5,'Relationship writes have transactionally saved audit events');
 await admin.query('BEGIN');await admin.query('DROP TABLE people_friendships');await admin.query('ROLLBACK');
 check((await admin.query('SELECT count(*)::int n FROM people_friendships')).rows[0].n===1,'Local rollback of schema removal preserves consent and blocks; production rollback retains table');
 await admin.query(await readFile(join(source,sourcePaths[4]),'utf8'));
 check(true,'Exact additive direct-message migration applies to PostgreSQL');
 await admin.query(await readFile(join(source,sourcePaths[5]),'utf8'));
 check((await admin.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.connect_direct_message_receipts'::regclass")).rows[0].relrowsecurity,'Receipt RLS enabled');
 for(const role of ['anon','authenticated','service_role']){await admin.query(`SET ROLE ${role}`);for(const sql of ['SELECT * FROM connect_direct_message_receipts','DELETE FROM connect_direct_message_receipts','TRUNCATE connect_direct_message_receipts']){await assert.rejects(()=>admin.query(sql),e=>e.code==='42501');check(true,`${role} receipt access denied: ${sql.split(' ')[0]}`);}await admin.query('RESET ROLE');}
 for(const sql of ['UPDATE connect_direct_message_receipts SET delivered_at=now()','DELETE FROM connect_direct_message_receipts','TRUNCATE connect_direct_message_receipts']){await assert.rejects(()=>one.query(sql),e=>e.code==='42501');check(true,`Receipt immutable runtime: ${sql.split(' ')[0]}`);}
 check((await admin.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.connect_direct_messages'::regclass")).rows[0].relrowsecurity,'Message RLS enabled');
 for(const role of ['anon','authenticated','service_role']){
  await admin.query(`SET ROLE ${role}`);
  for(const sql of ['SELECT * FROM connect_direct_messages','DELETE FROM connect_direct_messages','TRUNCATE connect_direct_messages',"UPDATE connect_direct_messages SET body='forged'",'SELECT nextval(\'connect_direct_messages_sequence_seq\')']){
   await assert.rejects(()=>admin.query(sql),e=>e.code==='42501');check(true,`${role} direct message access denied: ${sql.split(' ')[0]}`);
  }
  await admin.query('RESET ROLE');
 }
 for(const sql of ['DELETE FROM connect_direct_messages','TRUNCATE connect_direct_messages',"UPDATE connect_direct_messages SET body='changed'"]){await assert.rejects(()=>one.query(sql),e=>e.code==='42501');check(true,`Runtime immutable message access: ${sql.split(' ')[0]}`);}
 const ids=[A,B].sort();await admin.query("UPDATE people_friendships SET status='accepted',revision=10,low_blocked=0,high_blocked=0 WHERE low_user_id=$1 AND high_user_id=$2",ids);
 function dm(client){
  const query=(sql,p=[])=>{let n=0;return client.query(sql.replace(/\?/g,()=>`$${++n}`),p);};
  return createDirectMessages({q:async(s,...p)=>(await query(s,p)).rows[0],all:async(s,...p)=>(await query(s,p)).rows,run:async(s,...p)=>({changes:(await query(s,p)).rowCount}),transaction:async work=>{await client.query('BEGIN');try{const r=await work();await client.query('COMMIT');return r;}catch(e){await client.query('ROLLBACK');throw e;}},assert:(v,status,code,message)=>{if(!v)throw Object.assign(Error(message),{status,code});},now:()=>new Date().toISOString(),id:randomUUID,rateLimit:async()=>{},postgresMode:true,notify:async(...p)=>query('INSERT INTO notifications VALUES(?,?,?,?,?,?)',p),event:async(actor,type,id,event,details)=>query('INSERT INTO domain_events VALUES(?,?,?,?,?)',[actor,type,id,event,JSON.stringify(details)])});
 }
 const m1=dm(one),m2=dm(two),ctx=id=>({user:{id,status:'active'}}),path=`/connect/messages/${B}`,body={body:'Synthetic private PG message',revision:10,clientId:randomUUID()};
 const send=(service=m1,payload=body)=>service.route(ctx(A),'POST',path,payload,new URLSearchParams());
 const concurrent=await Promise.all([send(m1),send(m2)]);
 check(concurrent[0].message.id===concurrent[1].message.id,'Concurrent retries return exactly the same persisted message');
 check((await admin.query('SELECT count(*)::int n FROM connect_direct_messages')).rows[0].n===1,'Concurrent retries produce one row');
 const receive=await m2.route(ctx(B),'GET',`/connect/messages/${A}`,{},new URLSearchParams());
 check(receive.ownerId===B&&receive.messages.length===1&&receive.messages[0].body===body.body,'Second actual PostgreSQL runtime client reads saved message');
 const receiptBody={revision:10,messageIds:[concurrent[0].message.id]};
 const receipt=()=>m2.route(ctx(B),'POST',`/connect/messages/${A}/receipts`,receiptBody,new URLSearchParams());
 check(receive.messages[0].deliveredAt===null,'Read alone does not create receipt');
 await receipt();const stamp=(await m1.route(ctx(A),'GET',path,{},new URLSearchParams())).messages[0].deliveredAt.toISOString();
 await receipt();check((await m1.route(ctx(A),'GET',path,{},new URLSearchParams())).messages[0].deliveredAt.toISOString()===stamp&&Boolean(stamp),'Recipient ACK is durable and idempotent across runtime clients');
 await assert.rejects(()=>m1.route(ctx(A),'POST',path+'/receipts',receiptBody,new URLSearchParams()),e=>e.status===404);check(true,'Sender cannot forge delivery acknowledgement');
 await assert.rejects(()=>m1.route(ctx(C),'GET',path,{},new URLSearchParams()),e=>e.status===404);check(true,'Unrelated actual PostgreSQL user is denied');
 await one.query('BEGIN');for(const user of ids)await one.query('UPDATE users SET id=id WHERE id=$1',[user]);
 await one.query('SELECT * FROM people_friendships WHERE low_user_id=$1 AND high_user_id=$2 FOR UPDATE',ids);
 await one.query("UPDATE people_friendships SET status='closed',revision=11,low_blocked=1 WHERE low_user_id=$1 AND high_user_id=$2",ids);
 let done=false;const queued=send(m2,{...body,clientId:randomUUID()}).then(()=>({allowed:true}),e=>({status:e.status})).finally(()=>{done=true;});
 await delay(80);check(!done,'In-flight send waits behind relationship revocation locks');await one.query('COMMIT');
 check((await queued).status===404,'Blocked relationship rejects previously queued send after commit');
 await assert.rejects(()=>send(m2),e=>e.status===404);check(true,'Cached idempotent retry cannot bypass block');
 await admin.query("UPDATE people_friendships SET status='accepted',revision=14,low_blocked=0 WHERE low_user_id=$1 AND high_user_id=$2",ids);
 const reopened=await m1.route(ctx(A),'GET',path,{},new URLSearchParams());check(reopened.messages.length===0,'Reaccepted friendship does not reveal former revision history');
 await assert.rejects(()=>send(m1),e=>e.status===409);check(true,'Old consent revision is rejected after reaccept');
 await send(m1,{...body,revision:14,clientId:randomUUID()});
 const audit=(await admin.query("SELECT details FROM domain_events WHERE event_type='DIRECT_MESSAGE_SENT'")).rows;
 check(audit.length===2&&!JSON.stringify(audit).includes(body.body),'Message audit stores metadata, not text');
 await admin.query('BEGIN');await admin.query('DROP TABLE connect_direct_message_receipts;DROP TABLE connect_direct_messages');await admin.query('ROLLBACK');
 check((await admin.query('SELECT count(*)::int n FROM connect_direct_messages')).rows[0].n===2,'Disposable schema rollback preserves messages; production rollback retains additive table');

 await admin.query(await readFile(join(source,sourcePaths[7]),'utf8'));
 check((await admin.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.people_profiles'::regclass")).rows[0].relrowsecurity,'Exact profile migration enables RLS');
 check((await admin.query("SELECT count(*)::int n FROM pg_policies WHERE tablename='people_profiles'")).rows[0].n===3,'Profile migration has only runtime select/insert/update policies');
 for(const role of ['anon','authenticated','service_role']){
  await admin.query('SET ROLE '+role);
  for(const sql of ['SELECT * FROM people_profiles','DELETE FROM people_profiles','TRUNCATE people_profiles',"UPDATE people_profiles SET revision=999"]){
   await assert.rejects(()=>admin.query(sql),e=>e.code==='42501');check(true,role+' direct profile access denied: '+sql.split(' ')[0]);
  }
  await admin.query('RESET ROLE');
 }
 for(const sql of ['DELETE FROM people_profiles','TRUNCATE people_profiles']){await assert.rejects(()=>one.query(sql),e=>e.code==='42501');check(true,'Runtime profile removal denied: '+sql.split(' ')[0]);}
 const photo=randomUUID(),cover=randomUUID(),other=randomUUID(),video=randomUUID();
 for(const [asset,owner,mime] of [[photo,A,'image/png'],[cover,A,'image/webp'],[other,B,'image/jpeg'],[video,A,'video/mp4']])await admin.query('INSERT INTO media_assets VALUES($1,$2,$3)',[asset,owner,mime]);
 await admin.query('INSERT INTO people_follows VALUES($1,$2),($3,$1)',[A,B,C]);
 function profile(client,failAudit=false){
  const query=(sql,p=[])=>{let n=0;return client.query(sql.replace(/\?/g,()=>'$'+(++n)),p);};
  return createPeopleProfile({q:async(s,...p)=>(await query(s,p)).rows[0],run:async(s,...p)=>({changes:(await query(s,p)).rowCount}),transaction:async work=>{await client.query('BEGIN');try{const r=await work();await client.query('COMMIT');return r;}catch(e){await client.query('ROLLBACK');throw e;}},assert:(v,status,code,message)=>{if(!v)throw Object.assign(Error(message),{status,code});},now:()=>new Date().toISOString(),rateLimit:async()=>{},postgresMode:true,available:true,event:async(actor,type,id,event,details)=>{if(failAudit)throw Error('Synthetic audit refusal');return query('INSERT INTO domain_events VALUES(?,?,?,?,?)',[actor,type,id,event,JSON.stringify(details)]);}});
 }
 const profile1=profile(one),profile2=profile(two),payload={expectedOwnerId:A,avatarAssetId:photo,bannerAssetId:cover,revision:0};
 const profileRoute=(service,actor,method='GET',target='me',body={})=>service.route(ctx(actor),method,'/people/profiles/'+target,body,new URLSearchParams());
 const counts=(await profileRoute(profile1,A)).counts;
 check(counts.friends===1&&counts.followers===1&&counts.following===1,'Profile counts use existing active relationships/follows on PostgreSQL');
 const saves=await Promise.all([profileRoute(profile1,A,'POST','me',payload),profileRoute(profile2,A,'POST','me',payload)]);
 check(saves.every(x=>x.revision===1&&x.avatarAssetId===photo&&x.bannerAssetId===cover),'Concurrent identical profile saves share one durable revision');
 check((await admin.query("SELECT count(*)::int n FROM domain_events WHERE event_type='PROFILE_IMAGES_UPDATED'")).rows[0].n===1,'Profile retry records one metadata event');
 await assert.rejects(()=>profileRoute(profile2,B,'POST','me',payload),e=>e.status===403);check(true,'Replacement account cannot save the old captured owner');
 await assert.rejects(()=>profileRoute(profile1,A,'POST','me',{...payload,revision:1,avatarAssetId:other}),e=>e.status===404);check(true,'Other account image cannot become profile photo');
 await assert.rejects(()=>profileRoute(profile1,A,'POST','me',{...payload,revision:1,avatarAssetId:video}),e=>e.status===400);check(true,'Video cannot be a profile image');
 await assert.rejects(()=>profileRoute(profile1,A,'POST','me',{...payload,bannerAssetId:null}),e=>e.status===409);check(true,'Stale editor revision cannot overwrite a newer profile');
 check((await profileRoute(profile2,B,'GET',A+'/media/avatar')).mediaAsset.id===photo,'Other unblocked member gets only a published image reference');
 await assert.rejects(()=>admin.query('DELETE FROM media_assets WHERE id=$1',[photo]),e=>e.code==='23503');check(true,'Foreign key preserves an image while referenced by profile');
 await assert.rejects(()=>profileRoute(profile(one,true),A,'POST','me',{...payload,revision:1,bannerAssetId:null}),/Synthetic audit refusal/);
 check((await profileRoute(profile2,A)).revision===1&&(await profileRoute(profile2,A)).bannerAssetId===cover,'Audit failure rolls back profile revision and images');
 const contenders=await Promise.allSettled([profileRoute(profile1,A,'POST','me',{...payload,revision:1,bannerAssetId:null}),profileRoute(profile2,A,'POST','me',{...payload,revision:1,avatarAssetId:null})]);
 check(contenders.filter(x=>x.status==='fulfilled').length===1&&contenders.some(x=>x.status==='rejected'&&x.reason.status===409),'Two different edits at one revision cannot both overwrite');
 await admin.query("UPDATE people_friendships SET low_blocked=1 WHERE low_user_id=$1 AND high_user_id=$2",ids);
 await assert.rejects(()=>profileRoute(profile2,B,'GET',A+'/media/avatar'),e=>e.status===404);check(true,'A current block stops member image reference reads');
 check((await profileRoute(profile1,A)).counts.friends===0&&(await profileRoute(profile1,A)).counts.following===0,'Blocked relationship/follow excluded from synced counts');
 await admin.query("UPDATE users SET status='suspended' WHERE id=$1",[C]);check((await profileRoute(profile1,A)).counts.followers===0,'Suspended follower excluded from count');

 for(const path of sourcePaths)check(hash(await readFile(join(source,path)))===hashes[path],`Source preserved: ${path}`);
}catch(error){failure=error.stack||String(error);process.exitCode=1;}
finally{
 for(const client of clients)await client.end().catch(()=>{});
 if(server&&server.exitCode===null){try{command('pg_ctl',['-D',data,'-m','immediate','-w','stop']);}catch{server.kill('SIGTERM');}await new Promise(resolve=>{if(server.exitCode!==null)resolve();else server.once('exit',resolve);});}
 assert(tmp.startsWith('/tmp/ev-profile-pg-'));await rm(tmp,{recursive:true,force:true});
 const report={at:new Date().toISOString(),serverVersion,success:!failure,checks,sourceHashes:hashes,scope:'Disposable PostgreSQL schema/runtime/concurrency only, not hosted or physical accounts. Synthetic fixtures, no external network or real credentials.',isolation:{privateSocket:true,tcp:false,stopped:true,removed:true},failure,...(failure?{log}:{})};
 if(process.env.PROFILE_PG_REPORT)await writeFile(process.env.PROFILE_PG_REPORT,JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,serverVersion,checks:checks.length,failure}));
}
