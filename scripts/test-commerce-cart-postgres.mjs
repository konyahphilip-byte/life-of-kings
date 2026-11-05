import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,chmod,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createCartService} from '../server/commerce/cart.mjs';
import {createOrderWriter} from '../server/commerce/orders.mjs';
import {createCatalog} from '../server/commerce/catalog.mjs';
import {saveClassification} from '../server/commerce/classification.mjs';
import {readClassification} from '../shared/marketplace-taxonomy.mjs';
const source=fileURLToPath(new URL('..',import.meta.url)),{Client}=createRequire(join(source,'package.json'))('pg');
assert(process.env.PG_BINDIR,'Set PG_BINDIR to an installed PostgreSQL bin directory; no provider credentials are used.');
const bin=await realpath(process.env.PG_BINDIR),tmp=await mkdtemp('/tmp/ev-cart-pg-');await chmod(tmp,0o700);
const data=join(tmp,'data'),clients=[],checks=[];let server,log='',failure=null,serverVersion=null;
function command(name,args){const r=spawnSync(join(bin,name),args,{encoding:'utf8',env:{PATH:process.env.PATH,LC_ALL:'C'},timeout:20000});assert.equal(r.status,0,r.stderr||r.stdout);}
async function connect(user){const c=new Client({host:tmp,port:54392,user,database:'postgres',ssl:false,connectionTimeoutMillis:2000,query_timeout:5000});c.on('error',()=>{});await c.connect();clients.push(c);return c;}
const check=(value,label)=>{assert(value,label);checks.push(label);};
const fail=(value,status,code,message)=>{if(!value)throw Object.assign(Error(message),{status,code});};
const A=randomUUID(),B=randomUUID(),S=randomUUID(),P=randomUUID(),token=id=>createHash('sha256').update(id).digest('hex');
const ctx=id=>({user:{id,status:'active'},sessionHash:token(id),csrfToken:'synthetic-'+id});
function service(client){
 const query=(sql,params=[])=>{let n=0;return client.query(sql.replace(/\?/g,()=>'$'+(++n)),params);};
 const q=async(s,...p)=>(await query(s,p)).rows[0],all=async(s,...p)=>(await query(s,p)).rows,run=async(s,...p)=>({changes:(await query(s,p)).rowCount});
 const transaction=async work=>{await client.query('BEGIN');try{const r=await work();await client.query('COMMIT');return r;}catch(e){await client.query('ROLLBACK');throw e;}};
 const now=()=>new Date().toISOString(),productVariants=p=>JSON.parse(p.variants_json||'[]'),getOrder=id=>q('SELECT * FROM orders WHERE id=?',id),visibleOrder=order=>order;
 const event=async(actor,type,id,name)=>{await run('INSERT INTO domain_events(actor_id,aggregate_id,event_type) VALUES(?,?,?)',actor,id,name);await run('INSERT INTO audit_logs(actor_id,target_id,action) VALUES(?,?,?)',actor,id,name);};
 const notify=async(user,type,title,body,targetType,targetId)=>run('INSERT INTO notifications(user_id,type,title,body,target_type,target_id) VALUES(?,?,?,?,?,?)',user,type,title,body,targetType,targetId);
 const writeOrder=createOrderWriter({q,all,run,assert:fail,now,id:randomUUID,productVariants,notify,event,getOrder,visibleOrder,postgresMode:true});
 return createCartService({q,all,run,transaction,assert:fail,now,rateLimit:async()=>{},productVariants,writeOrder,getOrder,visibleOrder,postgresMode:true});
}
const call=(svc,id,method,path,body={})=>svc.route(ctx(id),method,'/marketplace/cart'+path,body,new URLSearchParams());
const get=(svc,id=A)=>call(svc,id,'GET','');
const save=(svc,id,cart,product=P,quantity=2)=>call(svc,id,'PUT','',{ownerId:id,revision:cart.revision,items:[{productId:product,quantity}]});
try{
 command('initdb',['-D',data,'-U','postgres','--auth-local=trust','--auth-host=reject','--no-instructions','--locale=C','--encoding=UTF8']);
 server=spawn(join(bin,'postgres'),['-D',data,'-k',tmp,'-p','54392','-c','listen_addresses=','-c','unix_socket_permissions=0700'],{env:{PATH:process.env.PATH,LC_ALL:'C'},stdio:['ignore','ignore','pipe']});server.stderr.on('data',b=>{log=(log+b.toString()).slice(-4000);});
 let admin;for(let i=0;i<100;i++){try{admin=await connect('postgres');break;}catch{await delay(100);}}assert(admin,'Private PostgreSQL did not start');
 serverVersion=(await admin.query('SHOW server_version')).rows[0].server_version;
 await admin.query(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE ecovibes_api_runtime LOGIN;
 CREATE TABLE users(id uuid PRIMARY KEY,eco_id text,display_name text,status text);
 CREATE TABLE sessions(token_hash text PRIMARY KEY,user_id uuid REFERENCES users(id),csrf_token text,expires_at timestamptz);
 CREATE TABLE products(id uuid PRIMARY KEY,seller_id uuid REFERENCES users(id),name text,description text DEFAULT '',category text DEFAULT 'Testing',source_type text DEFAULT 'direct',currency text DEFAULT 'GHS',price_minor integer,stock integer,variants_json text DEFAULT '[]',fulfillment_type text DEFAULT 'own_inventory',status text DEFAULT 'active',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
 CREATE TABLE roles(user_id uuid REFERENCES users(id),role text);
 CREATE TABLE orders(id uuid PRIMARY KEY,buyer_id uuid REFERENCES users(id),total_minor integer,currency text DEFAULT 'GHS',status text DEFAULT 'pending',payment_status text DEFAULT 'unpaid',created_at timestamptz,updated_at timestamptz);
 CREATE TABLE fulfillment_groups(id uuid PRIMARY KEY,order_id uuid REFERENCES orders(id),seller_id uuid REFERENCES users(id),created_at timestamptz,updated_at timestamptz);
 CREATE TABLE order_items(id uuid PRIMARY KEY,order_id uuid REFERENCES orders(id),group_id uuid REFERENCES fulfillment_groups(id),product_id uuid REFERENCES products(id),product_name text,variant_id text,variant_title text,quantity integer,unit_price_minor integer,seller_id uuid REFERENCES users(id));
 CREATE TABLE domain_events(actor_id uuid,aggregate_id uuid,event_type text);
 CREATE TABLE audit_logs(actor_id uuid,target_id uuid,action text);
 CREATE TABLE notifications(user_id uuid,type text,title text,body text,target_type text,target_id uuid);
 CREATE TABLE ecovibes_schema_version(version text PRIMARY KEY);
 GRANT SELECT,UPDATE ON users,products TO ecovibes_api_runtime;
 GRANT SELECT ON roles TO ecovibes_api_runtime;
 GRANT SELECT,INSERT,DELETE ON sessions TO ecovibes_api_runtime;
 ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
 CREATE POLICY runtime_session_select ON sessions FOR SELECT TO ecovibes_api_runtime USING(true);
 CREATE POLICY runtime_session_insert ON sessions FOR INSERT TO ecovibes_api_runtime WITH CHECK(true);
 CREATE POLICY runtime_session_delete ON sessions FOR DELETE TO ecovibes_api_runtime USING(true);
 GRANT SELECT,INSERT ON orders,fulfillment_groups,order_items TO ecovibes_api_runtime;
 GRANT INSERT ON notifications,domain_events,audit_logs TO ecovibes_api_runtime;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;`);
 await admin.query(await readFile(join(source,'supabase/migrations/20261105084536_commerce_account_cart.sql'),'utf8'));check(true,'Exact additive migration applies');
 await admin.query(await readFile(join(source,'supabase/migrations/20261105120000_product_classification.sql'),'utf8'));check(true,'Exact additive product classification migration applies without table replacement');
 for(const role of['anon','authenticated','service_role']){
  await admin.query('SET ROLE '+role);
  await assert.rejects(()=>admin.query('SELECT public.ecovibes_cart_session_authorized($1,$2,$3)',[token(A),A,'synthetic-'+A]),e=>e.code==='42501');
  check(true,role+' denied session-lock helper');await admin.query('RESET ROLE');
 }
 const tables=['commerce_carts','commerce_cart_items','commerce_order_commands'];
 for(const table of tables){
  check((await admin.query('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass',[table])).rows[0].relrowsecurity,table+' RLS enabled');
  for(const role of['anon','authenticated','service_role']){
   await admin.query('SET ROLE '+role);
   for(const verb of['SELECT * FROM ','DELETE FROM ','TRUNCATE ']){await assert.rejects(()=>admin.query(verb+table),e=>e.code==='42501');check(true,role+' denied '+verb+table);}
   await admin.query('RESET ROLE');
  }
 }
 for(const id of[A,B,S]){await admin.query("INSERT INTO users VALUES($1,$2,$2,'active')",[id,'synthetic-'+id.slice(0,8)]);await admin.query("INSERT INTO sessions VALUES($1,$2,$3,now()+interval '1 hour')",[token(id),id,'synthetic-'+id]);}
 await admin.query("INSERT INTO products(id,seller_id,name,price_minor,stock) VALUES($1,$2,'Synthetic PG product',1200,20)",[P,S]);
 const one=await connect('ecovibes_api_runtime'),two=await connect('ecovibes_api_runtime'),s1=service(one),s2=service(two);
 await admin.query("INSERT INTO roles VALUES($1,'seller')",[S]);
 const listing=randomUUID();await admin.query("INSERT INTO products(id,seller_id,name,price_minor,stock,category) VALUES($1,$2,'100% cotton',1300,4,'Textiles')",[listing,S]);
 const cat=createCatalog({all:async(sql,...params)=>{let n=0;return(await one.query(sql.replace(/\?/g,()=>'$'+(++n)),params)).rows;},assert:fail,publicProduct:row=>({id:row.id,name:row.name,price:row.price_minor,source:row.source_type,classification:readClassification(row)}),now:()=>new Date().toISOString(),classificationAvailable:true});
 const browse=query=>cat(ctx(A),new URLSearchParams(query));
 let first=await browse('limit=1&sort=price_low');check(first.items[0].id===P&&Boolean(first.nextCursor),'PostgreSQL public catalog uses real low-price pagination');
 const second=await browse('limit=1&sort=price_low&cursor='+first.nextCursor);check(second.items[0].id===listing&&second.nextCursor===null,'PostgreSQL timestamp cursor returns the next canonical product');
 check((await browse('q=100%25')).items[0].id===listing,'PostgreSQL literal wildcard search is escaped');
 check((await browse('category=Textiles&minPrice=1250&maxPrice=1350&inStock=1')).items.length===1,'PostgreSQL category, price and stock filters compose');
 check((await browse('source=direct&seller=synthetic-'+S.slice(0,8))).items.length===2,'PostgreSQL public source and seller filters use saved fields');
 await admin.query('DELETE FROM roles WHERE user_id=$1',[S]);check((await browse('')).items.length===0,'PostgreSQL catalog hides withdrawn seller membership');await admin.query("INSERT INTO roles VALUES($1,'seller')",[S]);
 await admin.query("UPDATE users SET status='suspended' WHERE id=$1",[S]);check((await browse('')).items.length===0,'PostgreSQL catalog hides inactive seller stock');await admin.query("UPDATE users SET status='active' WHERE id=$1",[S]);
 check((await one.query('SELECT category_id,attributes_json FROM products WHERE id=$1',[listing])).rows[0].category_id===null,'Existing rows remain unclassified after additive migration');
 await saveClassification(async(sql,...params)=>{let n=0;return one.query(sql.replace(/\?/g,()=>'$'+(++n)),params);},listing,{categoryId:'electronics.phones',categoryVersion:1,attributes:{condition:'used',storageGb:128}});
 check((await browse('categoryId=electronics')).items[0]?.classification?.attributes.storageGb===128,'Runtime saves and reads structured details through real PostgreSQL category-parent query');
 check((await browse('categoryId=electronics.phones')).items.length===1&&(await browse('categoryId=home')).items.length===0,'PostgreSQL exact and sibling categories do not infer legacy matches');
 for(const sql of["UPDATE products SET attributes_json='[]' WHERE id=$1","UPDATE products SET category_version=NULL WHERE id=$1","UPDATE products SET attributes_json=repeat('x',4097) WHERE id=$1"]){await assert.rejects(()=>one.query(sql,[listing]),e=>['23514','22P02'].includes(e.code));check(true,'PostgreSQL rejects malformed classification shape without changing record');}
 for(const role of['anon','authenticated','service_role']){await admin.query('SET ROLE '+role);await assert.rejects(()=>admin.query('SELECT attributes_json FROM products'),e=>e.code==='42501');await admin.query('RESET ROLE');check(true,role+' receives no new direct product access from classification migration');}
 await assert.rejects(()=>one.query('SELECT token_hash FROM sessions FOR SHARE'),e=>e.code==='42501');check(true,'Runtime session UPDATE/row-lock remains denied, matching existing grants');
 check(!(await one.query("SELECT has_table_privilege(current_user,'sessions','UPDATE') AS allowed")).rows[0].allowed,'Helper does not add session UPDATE privilege');
 for(const [hash,subject,csrf]of[[token(A),B,'synthetic-'+A],[token(A),A,'wrong-csrf'],[token(B),A,'synthetic-'+A]]){
  check(!(await one.query('SELECT public.ecovibes_cart_session_authorized($1,$2,$3) AS allowed',[hash,subject,csrf])).rows[0].allowed,'Helper rejects wrong captured-session binding');
 }
 for(const sql of['UPDATE commerce_order_commands SET request_hash=request_hash','DELETE FROM commerce_order_commands','TRUNCATE commerce_order_commands','DELETE FROM commerce_carts','TRUNCATE commerce_cart_items']){await assert.rejects(()=>one.query(sql),e=>e.code==='42501');check(true,'Runtime least privilege: '+sql.split(' ')[0]+' '+sql.split(' ')[1]);}
 let cart=await get(s1);cart=await save(s1,A,cart);
 check((await get(s2)).items[0].quantity===2,'Second runtime connection sees saved account cart');
 check((await get(s2,B)).items.length===0,'Other account has an isolated cart');
 const request={ownerId:A,revision:cart.revision,totalMinor:2400,quoteId:cart.quoteId,clientId:randomUUID()},submit=(svc=s1,body=request)=>call(svc,A,'POST','/checkout',body);
 const concurrent=await Promise.all([submit(s1),submit(s2)]);
 check(concurrent[0].order.id===concurrent[1].order.id,'Concurrent checkout retries return the same order');
 check((await admin.query('SELECT count(*)::int n FROM orders')).rows[0].n===1,'Exactly one order');
 check((await admin.query('SELECT stock FROM products WHERE id=$1',[P])).rows[0].stock===18,'Exactly one stock reservation');
 check((await admin.query('SELECT count(*)::int n FROM commerce_order_commands')).rows[0].n===1,'Exactly one immutable command');
 check((await admin.query("SELECT count(*)::int n FROM audit_logs WHERE action='ORDER_CREATED'")).rows[0].n===1,'Exactly one order audit');
 cart=await save(s1,A,await get(s1),P,1);
 await submit(s2);check((await get(s1)).items[0].quantity===1,'Retry preserves later cart items');
 await assert.rejects(()=>submit(s2,{...request,totalMinor:2401}),e=>e.status===409);check(true,'Changed command payload denied');
 await assert.rejects(()=>submit(s2,{...request,clientId:randomUUID()}),e=>e.status===409);check(true,'Another key cannot buy an old cart revision');
 // A product-price update commits after preliminary read but before writer obtains its lock.
 await admin.query('BEGIN');await admin.query('UPDATE products SET price_minor=1300 WHERE id=$1',[P]);
 let finished=false;const raced=submit(s2,{ownerId:A,revision:cart.revision,totalMinor:1200,quoteId:cart.quoteId,clientId:randomUUID()}).then(()=>null,e=>e).finally(()=>{finished=true;});
 await delay(80);check(!finished,'Checkout waits behind real product lock');await admin.query('COMMIT');
 check((await raced)?.status===409,'Locked canonical price requires fresh review after concurrent price change');
 check((await get(s1)).items.length===1&&(await admin.query('SELECT count(*)::int n FROM orders')).rows[0].n===1,'Price conflict preserves cart and creates no second order');
 await admin.query('UPDATE products SET price_minor=1200 WHERE id=$1',[P]);
 // Inject a genuine PostgreSQL audit-write failure.
 await admin.query("ALTER TABLE audit_logs ADD CONSTRAINT synthetic_audit_failure CHECK(action<>'ORDER_CREATED') NOT VALID");
 await assert.rejects(()=>submit(s1,{ownerId:A,revision:cart.revision,totalMinor:1200,quoteId:cart.quoteId,clientId:randomUUID()}));
 await admin.query('ALTER TABLE audit_logs DROP CONSTRAINT synthetic_audit_failure');
 check((await get(s2)).items.length===1&&(await admin.query('SELECT stock FROM products WHERE id=$1',[P])).rows[0].stock===18,'Audit failure rolls back stock, order, command and cart clear');
 // Session deletion must revoke even an already-known, cached order request.
 await admin.query('BEGIN');await admin.query('DELETE FROM sessions WHERE user_id=$1',[A]);
 finished=false;const revoked=submit(s2).then(()=>null,e=>e).finally(()=>{finished=true;});await delay(80);check(!finished,'In-flight command waits on session revocation');
 await admin.query('COMMIT');check((await revoked)?.status===401,'Revoked session cannot retrieve an existing command');
 await admin.query("INSERT INTO sessions VALUES($1,$2,$3,now()+interval '1 hour')",[token(A),A,'synthetic-'+A]);
 // Two different customers contend for one actual unit.
 const scarce=randomUUID();await admin.query("INSERT INTO products(id,seller_id,name,price_minor,stock) VALUES($1,$2,'Last unit',500,1)",[scarce,S]);
 const ca=await save(s1,A,await get(s1),scarce,1),cb=await save(s2,B,await get(s2,B),scarce,1);
 const competition=await Promise.allSettled([[s1,A,ca],[s2,B,cb]].map(([svc,id,c])=>call(svc,id,'POST','/checkout',{ownerId:id,revision:c.revision,totalMinor:500,quoteId:c.quoteId,clientId:randomUUID()})));
 check(competition.filter(r=>r.status==='fulfilled').length===1,'One customer wins the last unit');
 check(competition.filter(r=>r.status==='rejected'&&r.reason.status===409).length===1,'Other customer gets stock conflict, never false success');
 check((await admin.query('SELECT stock FROM products WHERE id=$1',[scarce])).rows[0].stock===0,'No oversold or negative stock');
 await admin.query('BEGIN');await admin.query('DROP TABLE commerce_order_commands');await admin.query('ROLLBACK');
 check((await admin.query('SELECT count(*)::int n FROM commerce_order_commands')).rows[0].n===2,'Disposable schema rollback retains commands; production rollback must retain them');
}catch(e){failure=e.stack||String(e);process.exitCode=1;}
finally{
 for(const c of clients)await c.end().catch(()=>{});
 if(server&&server.exitCode===null){try{command('pg_ctl',['-D',data,'-m','immediate','-w','stop']);}catch{server.kill('SIGTERM');}await new Promise(r=>{if(server.exitCode!==null)r();else server.once('exit',r);});}
 assert(tmp.startsWith('/tmp/ev-cart-pg-'));await rm(tmp,{recursive:true,force:true});
 const report={success:!failure,serverVersion,checks,scope:'Disposable PostgreSQL and actual cart/order services; synthetic accounts, no provider or hosted data',failure,...(failure?{log}:{})};
 if(process.env.CART_PG_REPORT)await writeFile(process.env.CART_PG_REPORT,JSON.stringify(report,null,2));console.log(JSON.stringify({success:!failure,serverVersion,checks:checks.length,failure}));
}
