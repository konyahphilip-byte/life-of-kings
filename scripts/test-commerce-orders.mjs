import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';

const app=new URL('..',import.meta.url),temp=await mkdtemp(resolve(tmpdir(),'ecovibes-commerce-'));
const dbPath=resolve(temp,'isolated.sqlite'),checks=[];
let origin,db,log='',failure,exited=false;
const bootstrap="import{Server}from'node:http';if(process.env.NODE_ENV!=='test')throw Error('test only');const listen=Server.prototype.listen;Server.prototype.listen=function(...args){this.once('listening',()=>process.send?.({event:'commerce-test-ready',port:this.address()?.port}));return listen.apply(this,args)};globalThis.fetch=()=>{throw Error('External provider access is disabled in this commerce test')}";
const child=spawn(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(bootstrap),'server/index.mjs'],{cwd:app,stdio:['ignore','pipe','pipe','ipc'],env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',PORT:'0',API_PORT:'0',ECOVIBES_DB_PATH:dbPath,ECOVIBES_SERVE_WEB:'false',DATABASE_URL:'',SUPABASE_URL:'',OPENAI_ENV_FILE:''}});
child.on('message',m=>{if(m?.event==='commerce-test-ready'&&Number.isInteger(m.port))origin='http://127.0.0.1:'+m.port;});
child.on('exit',()=>exited=true);child.on('error',e=>failure=e);
for(const s of[child.stdout,child.stderr])s.on('data',b=>{log=(log+b).slice(-5000);});
const pass=name=>{checks.push(name);console.log('PASS',name);};
async function call(path,{method='GET',body,account,csrf=true}={}){
 assert(origin&&!exited);
 const r=await fetch(origin+'/api/v1'+path,{method,signal:AbortSignal.timeout(5000),headers:{Origin:origin,'Content-Type':'application/json',...(account?{Cookie:account.cookie,...(csrf?{'X-CSRF-Token':account.csrf}:{})}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 return{status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
const snap=()=>Object.fromEntries(['products','orders','order_items','fulfillment_groups','domain_events','audit_logs','notifications'].map(t=>[t,db.prepare('SELECT * FROM '+t+' ORDER BY 1').all()]));
try{
 const deadline=Date.now()+15000;
 while(!origin&&!exited&&!failure&&Date.now()<deadline)await delay(30);
 assert(origin&&!failure&&!exited,'Isolated startup failed: '+(failure?.message||log));
 db=new DatabaseSync(dbPath);
 const signup=async ecoId=>{const r=await call('/auth/register',{method:'POST',body:{ecoId,displayName:'Synthetic Commerce',password:'Synthetic-Commerce-Test-123'}});assert.equal(r.status,200);return{id:r.body.user.id,cookie:r.cookie,csrf:r.body.csrfToken};};
 const buyer=await signup('commerce.buyer'),seller=await signup('commerce.seller'),other=await signup('commerce.other');
 db.prepare("INSERT INTO roles(user_id,role,created_at) VALUES(?,'seller',?)").run(seller.id,new Date().toISOString());
 let r=await call('/marketplace/products',{method:'POST',account:seller,body:{name:'Synthetic item',category:'Testing',priceMinor:1200,stock:10}});
 assert.equal(r.status,200,JSON.stringify(r.body));const product=r.body.id;
 const endpoint='/marketplace/orders',valid={items:[{productId:product,quantity:1}]};
 for(const [name,account,csrf,status]of[['anonymous',null,true,401],['CSRF missing',buyer,false,403]]){
  const before=snap();r=await call(endpoint,{method:'POST',body:valid,account,csrf});assert.equal(r.status,status);assert.deepEqual(snap(),before);pass(name+' cannot write an order');
 }
 const invalid=[null,[],{},{items:[]},{items:[null]},{items:[[]]},{items:[true]},{items:[{productId:product,quantity:'1'}]},{items:[{productId:product,quantity:0}]},{items:[{productId:product,quantity:1.5}]},{items:[{productId:'',quantity:1}]},{items:[{productId:product,quantity:Number.MAX_SAFE_INTEGER},{productId:product,quantity:1}]},{items:Array.from({length:31},()=>({productId:product,quantity:1}))}];
 for(const [i,body]of invalid.entries()){
  const before=snap();r=await call(endpoint,{method:'POST',body,account:buyer});assert.equal(r.status,400,'Malformed order case '+i+': '+JSON.stringify(r.body));assert.deepEqual(snap(),before);assert(r.body.error.requestId);pass('Malformed order '+i+' rejected without writes');
 }
 r=await call(endpoint,{method:'POST',body:valid,account:seller});assert.equal(r.status,400);pass('Seller cannot buy own listing');
 const before=snap();
 r=await call(endpoint,{method:'POST',account:buyer,body:{items:[{productId:product,quantity:1},{productId:'00000000-0000-0000-0000-000000000000',quantity:1}]}});assert.equal(r.status,404);assert.deepEqual(snap(),before);pass('Unavailable line rolls back complete order');
 db.exec("CREATE TRIGGER synthetic_order_audit_failure BEFORE INSERT ON audit_logs WHEN NEW.action='ORDER_CREATED' BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END");
 r=await call(endpoint,{method:'POST',account:buyer,body:valid});assert.equal(r.status,500);assert.deepEqual(snap(),before);db.exec('DROP TRIGGER synthetic_order_audit_failure');pass('Audit failure rolls back inventory, order, notice and events');
 r=await call(endpoint,{method:'POST',account:buyer,body:{items:[{productId:product,quantity:1},{productId:product,quantity:2}],priceMinor:1,totalMinor:1,buyerId:other.id}});
 assert.equal(r.status,200,JSON.stringify(r.body));const order=r.body;
 assert.equal(order.buyer_id,buyer.id);assert.equal(order.total_minor,3600);assert.equal(order.payment_status,'unpaid');assert.equal(order.groups[0].items.length,1);assert.equal(order.groups[0].items[0].quantity,3);assert.equal(db.prepare('SELECT stock FROM products WHERE id=?').get(product).stock,7);pass('One durable unpaid order uses canonical buyer, price and merged quantities');
 assert.equal(db.prepare("SELECT count(*) n FROM domain_events WHERE aggregate_id=? AND event_type='ORDER_CREATED'").get(order.id).n,1);
 assert.equal(db.prepare("SELECT count(*) n FROM audit_logs WHERE target_id=? AND action='ORDER_CREATED'").get(order.id).n,1);pass('Committed order has one domain and audit record');
 r=await call(endpoint,{account:other});assert.equal(r.status,200);assert(!r.body.some(x=>x.id===order.id));pass('Other buyer cannot see the order');
 r=await call(endpoint,{account:buyer});assert.equal(r.body.find(x=>x.id===order.id).total_minor,3600);pass('Buyer reload returns persisted order');
 r=await call(endpoint+'/'+order.id+'/cancel',{method:'POST',account:buyer,body:{}});assert.equal(r.status,200);assert.equal(db.prepare('SELECT stock FROM products WHERE id=?').get(product).stock,10);pass('Existing cancellation restores reserved stock');
}catch(error){failure={name:error.name,message:error.message};process.exitCode=1;console.error('FAIL',error.message);}
finally{
 const report={success:!failure,checks:checks.length,results:checks,failure:failure||null,scope:'Isolated SQLite and synthetic accounts, real HTTP; no provider/production data or real payments'};
 if(process.env.COMMERCE_REPORT_PATH)await writeFile(process.env.COMMERCE_REPORT_PATH,JSON.stringify(report,null,2));
 db?.close();child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),delay(3000)]);if(!exited)child.kill('SIGKILL');await rm(temp,{recursive:true,force:true});console.log(JSON.stringify(report));
}
