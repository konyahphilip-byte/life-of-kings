import assert from 'node:assert/strict';
import { spawn,spawnSync } from 'node:child_process';
import { mkdir,mkdtemp,readFile,writeFile,chmod } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { FRIENDS_SQLITE_SCHEMA } from '../server/people-friends.mjs';
import { createNativeStudio } from '../server/commerce/native-studio.mjs';
assert(process.env.PG_BINDIR,'Pass existing disposable PostgreSQL tooling, never a hosted URL.');
const bin=process.env.PG_BINDIR,tmp=await mkdtemp('/tmp/ev-native-pg-');await chmod(tmp,0o700);
const data=join(tmp,'data'),port=54855,results=[],clients=[];let engine,log='',failure=null,version;
await mkdir(resolve('work/m01-native'),{recursive:true});
const out=await mkdtemp(resolve('work/m01-native/pg-'));
function command(name,args){const r=spawnSync(join(bin,name),args,{encoding:'utf8',timeout:20000,env:{PATH:process.env.PATH,LC_ALL:'C'}});assert.equal(r.status,0,r.stderr||r.stdout);return r.stdout;}
async function connect(user='postgres'){const c=new pg.Client({host:tmp,port,user,database:'postgres',ssl:false,connectionTimeoutMillis:3000,query_timeout:7000});c.on('error',()=>{});await c.connect();clients.push(c);return c;}
function check(ok,label,detail){results.push({passed:Boolean(ok),label,detail});}
const A=randomUUID(),B=randomUUID(),C=randomUUID(),R=randomUUID();
let founderMode=false;
const actor=id=>({user:{id,status:'active',roles:id===R?['trust_staff']:id===A?(founderMode?['seller','admin']:['seller']):['customer']},sessionHash:createHash('sha256').update(id).digest('hex'),csrfToken:id,authAssurance:'aal2'});
const main=await readFile('server/index.mjs','utf8'),migration=await readFile('supabase/migrations/20261126090000_native_studio.sql','utf8');
const hashes={migration:createHash('sha256').update(migration).digest('hex'),service:createHash('sha256').update(await readFile('server/commerce/native-studio.mjs')).digest('hex'),reviewMigration:createHash('sha256').update(await readFile('supabase/migrations/20261126100000_publication_review.sql')).digest('hex')};
function query(client,sql,params=[]){let n=0;return client.query(sql.replace(/\?/g,()=>'$'+(++n)),params);}
function service(client,founderReviewScope=null){return createNativeStudio({q:async(s,...p)=>(await query(client,s,p)).rows[0],all:async(s,...p)=>(await query(client,s,p)).rows,
 run:async(s,...p)=>({changes:(await query(client,s,p)).rowCount}),
 transaction:async work=>{await client.query('BEGIN');try{const r=await work();await client.query('COMMIT');return r;}catch(e){await client.query('ROLLBACK');throw e;}},
 assert:(ok,status,code,message)=>{if(!ok)throw Object.assign(Error(message),{status,code});},now:()=>new Date().toISOString(),id:randomUUID,rateLimit:async()=>{},event:async()=>{},notify:async()=>{},
 postgresMode:true,enabled:true,available:true,founderReviewScope,requireStaff:ctx=>{if(!ctx.user.roles.some(r=>['trust_staff','admin'].includes(r))||ctx.authAssurance!=='aal2')throw Object.assign(Error('Staff required'),{status:403});},
 normalizePhoto:()=>{throw Error('Photo decoding is tested through the real HTTP path, not this SQL fixture.');},storeMediaAsset:async()=>{},loadMediaAsset:async()=>Buffer.alloc(0),removeMediaAsset:async()=>{}});}
async function route(s,id,method,path,body={}){return s.route(actor(id),method,path,body,new URLSearchParams());}
async function denied(work,label){let error;try{await work();}catch(e){error=e;}check(error?.status===404,label,error?.message);}
try{
 version=command('postgres',['--version']).trim();
 command('initdb',['-D',data,'-U','postgres','--auth-local=trust','--auth-host=reject','--no-instructions']);
 engine=spawn(join(bin,'postgres'),['-D',data,'-k',tmp,'-h','','-p',String(port)],{env:{PATH:process.env.PATH,LC_ALL:'C'},stdio:['ignore','pipe','pipe']});
 engine.stdout.on('data',b=>log+=b);engine.stderr.on('data',b=>log+=b);
 let admin;for(let n=0;n<200&&!admin;n++){try{admin=await connect();}catch{await delay(25);}}assert(admin,'Owned PostgreSQL did not start.');
 let base='';
 for(const table of ['users','roles','sessions','products','media_assets','staff_access']){
  const pattern=new RegExp('CREATE TABLE IF NOT EXISTS '+table+'\\([\\s\\S]*?\\);');const match=main.match(pattern);assert(match,'Missing real baseline '+table);base+=match[0]+'\n';
 }
 base+=FRIENDS_SQLITE_SCHEMA;
 for(const key of ['id','user_id','seller_id','owner_id','low_user_id','high_user_id','requester_id'])base=base.replace(new RegExp('\\b'+key+' TEXT\\b','g'),key+' uuid');
 base=base.replace(/ COLLATE NOCASE/g,'').replace(/\b(created_at|expires_at|updated_at|requested_at) TEXT\b/g,'$1 timestamptz');
 await admin.query(base);
 await admin.query("CREATE TABLE ecovibes_schema_version(version text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now());CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE ecovibes_api_runtime LOGIN;");
 await admin.query(migration);
 await admin.query(await readFile('supabase/migrations/20261126100000_publication_review.sql','utf8'));
 await admin.query('GRANT SELECT,INSERT,UPDATE ON users,roles,sessions,products,media_assets,staff_access,people_friendships TO ecovibes_api_runtime');
 for(const who of [A,B,C,R]){
  await admin.query("INSERT INTO users(id,eco_id,display_name,password_salt,password_hash,status,created_at) VALUES($1,$2,'Synthetic SQL fixture','fixture','fixture','active',now())",[who,'fixture.'+who.slice(0,8)]);
  await admin.query('INSERT INTO roles VALUES($1,$2,now())',[who,who===A?'seller':'customer']);
  const ctx=actor(who);await admin.query("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES($1,$2,$3,now()+interval '1 hour',now())",[ctx.sessionHash,who,ctx.csrfToken]);
 }
 await admin.query("INSERT INTO staff_access VALUES($1,'trust_staff',now())",[R]);
 const runtime=await connect('ecovibes_api_runtime'),s=service(runtime);
 const permissions=(await admin.query("SELECT has_table_privilege('anon','public.m01_shops','SELECT') anon_read,has_table_privilege('authenticated','public.m01_product_publication','SELECT') authenticated_read,has_table_privilege('service_role','public.connect_enquiry_messages','SELECT') service_read,has_table_privilege('ecovibes_api_runtime','public.m01_theme_versions','DELETE') can_delete_history,has_table_privilege('ecovibes_api_runtime','public.connect_enquiry_messages','UPDATE') can_rewrite_message")).rows[0];
 check(!permissions.anon_read&&!permissions.authenticated_read&&!permissions.service_read,'new private tables deny browser/service-role direct access',permissions);
 check(!permissions.can_delete_history&&!permissions.can_rewrite_message,'runtime cannot erase immutable theme history or rewrite messages',permissions);
 const shop=(await route(s,A,'POST','/studio/shops',{requestId:randomUUID(),name:'Isolated PostgreSQL shop',slug:'isolated-postgres-shop'})).shop;
 const photo=randomUUID();
 await admin.query("INSERT INTO media_assets VALUES($1,$2,'image/webp',10,now());",[photo,A]);
 await admin.query('INSERT INTO m01_photos VALUES($1,$2,$3,12,12,$4)',[photo,shop.id,A,new Date().toISOString()]);
 const fields={title:'Native PostgreSQL product',description:'Synthetic SQL concurrency fixture',categoryId:'fashion',priceMinor:1200,stock:5,availability:'in_stock',variants:[],gallery:[{assetId:photo,alt:'Synthetic SQL fixture'}],collection:'Test collection'};
 const product=(await route(s,A,'POST','/studio/shops/'+shop.id+'/products',{requestId:randomUUID(),...fields})).product;
 await denied(()=>route(s,C,'GET','/studio/products/'+product.id),'outsider cannot read a native draft on PostgreSQL');
 const queue=await route(s,R,'GET','/studio/reviews');
 for(const [kind,target] of [['shops',shop.id],['products',product.id]])await route(s,R,'POST','/studio/reviews/'+kind+'/'+target,{requestId:randomUUID(),revision:1,contentHash:queue[kind].find(x=>x.id===target).reviewContentHash,decision:'approved',reason:'Reviewed synthetic PostgreSQL content and policy.',selfReviewConfirmed:false});
 const immutable=(await admin.query("SELECT has_table_privilege('anon','m01_review_receipts','SELECT') anon_read,has_table_privilege('authenticated','m01_review_receipts','SELECT') member_read,has_table_privilege('service_role','m01_review_receipts','SELECT') service_read,has_table_privilege('ecovibes_api_runtime','m01_review_receipts','UPDATE') can_update,has_table_privilege('ecovibes_api_runtime','m01_review_receipts','DELETE') can_delete")).rows[0];
 check(Object.values(immutable).every(x=>x===false),'review receipts deny direct browser access and runtime rewriting',immutable);
 const receipts=(await admin.query('SELECT * FROM m01_review_receipts')).rows;
 check(receipts.length===2&&receipts.every(x=>x.reviewer_id===R&&x.capacity==='moderator_review'&&x.reason.length>=5),'review decisions persist creator/reviewer/version/snapshot/reason');

 await route(s,A,'POST','/studio/products/'+product.id+'/publish',{revision:1,confirmPublication:true,confirmSupply:true});
 const shopRead=await route(s,B,'GET','/public/shops/isolated-postgres-shop'),discover=await route(s,B,'GET','/public/catalogue');
 check(shopRead.products[0].id===product.id&&discover.products[0].id===product.id,'real PostgreSQL shop/Discover share one product authority');
 for(const statement of ['UPDATE m01_review_receipts SET reason=reason','DELETE FROM m01_review_receipts']){
  let blocked;try{await runtime.query(statement);}catch(e){blocked=e;}
  check(blocked?.code==='42501','actual runtime receipt mutation denied: '+statement,{code:blocked?.code});
 }
 await admin.query("INSERT INTO staff_access VALUES($1,'admin',now())",[A]);founderMode=true;
 const fs=service(runtime,{accountId:A,shopId:shop.id});
 const edited=(await route(fs,A,'PATCH','/studio/products/'+product.id,{revision:1,...fields,description:'Exact PostgreSQL founder-reviewed version'})).product;
 const fq=await route(fs,A,'GET','/studio/reviews'),fp=fq.products.find(x=>x.id===product.id);
 const fr=(await route(fs,A,'POST','/studio/reviews/products/'+product.id,{requestId:randomUUID(),revision:edited.revision,contentHash:fp.reviewContentHash,decision:'approved',reason:'Explicit synthetic founder review of this exact version.',selfReviewConfirmed:true})).receipt;
 check(fr.capacity==='founder_self_review'&&fr.creator_id===A&&fr.reviewer_id===A,'PostgreSQL persists scoped founder self-review separately from moderator review');
 await route(fs,A,'POST','/studio/products/'+product.id+'/publish',{revision:edited.revision,confirmPublication:true,confirmSupply:true});
 const enq=(await route(s,B,'POST','/connect/enquiries',{listingId:product.id,clientId:randomUUID(),body:'Synthetic first enquiry'})).enquiry;
 const low=[A,B].sort()[0],high=[A,B].sort()[1];
 const blocker=await connect();await blocker.query('BEGIN');
 for(const who of [A,B].sort())await blocker.query('UPDATE users SET id=id WHERE id=$1',[who]);
 await blocker.query("INSERT INTO people_friendships(low_user_id,high_user_id,status,low_blocked,high_blocked,updated_at) VALUES($1,$2,'none',1,0,now())",[low,high]);
 const raceClient=await connect('ecovibes_api_runtime'),race=service(raceClient),pid=(await raceClient.query('SELECT pg_backend_pid() pid')).rows[0].pid;
 const pending=route(race,B,'POST','/connect/enquiries/'+enq.id+'/messages',{clientId:randomUUID(),body:'Must not arrive after block commit'}).then(value=>({value}),error=>({error:{status:error.status,message:error.message}}));
 let waiting;for(let n=0;n<200&&!waiting;n++){const row=(await admin.query("SELECT query,wait_event_type FROM pg_stat_activity WHERE pid=$1",[pid])).rows[0];if(row?.wait_event_type==='Lock')waiting=row;else await delay(10);}
 assert(waiting,'The concurrent request did not reach its real PostgreSQL lock.');
 await blocker.query('COMMIT');
 const outcome=await pending;
 check(outcome.error?.status===404,'a queued enquiry is denied after the existing Connect block commits',{blockedStatement:waiting.query,...outcome});
 const count=(await admin.query('SELECT count(*) n FROM connect_enquiry_messages WHERE enquiry_id=$1',[enq.id])).rows[0].n;
 check(Number(count)===1,'blocked concurrent send inserts no private message',{messages:Number(count)});
 check((await admin.query('SELECT count(*) n FROM products')).rows[0].n==='1','PostgreSQL uses one product row');
}catch(e){failure={message:e.message,stack:e.stack};}
finally{
 for(const c of clients)await c.end().catch(()=>{});
 if(engine){command('pg_ctl',['-D',data,'-m','fast','-w','stop']);}
 const report={passed:!failure&&results.every(r=>r.passed),version,results,failure,hashes,disposableData:tmp,scope:'Real isolated PostgreSQL migration/privilege and service concurrency checks using synthetic SQL accounts. Base tables derived from current source; real auth, photos, audit and HTTP tested separately in SQLite. No hosted migration or provider verification.'};
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));await writeFile(join(out,'server.log'),log);console.log(JSON.stringify({...report,out},null,2));if(!report.passed)process.exitCode=1;
}
