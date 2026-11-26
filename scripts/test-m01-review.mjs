import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir,copyFile,mkdtemp,writeFile,readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
const root=fileURLToPath(new URL('../',import.meta.url));
assert(process.argv[2],'Pass an exact passing native fixture report.');
const source=JSON.parse(await readFile(process.argv[2],'utf8'));assert(source.passed);
await mkdir(resolve(root,'work/publication-review'),{recursive:true});
const folder=await mkdtemp(resolve(root,'work/publication-review/http-')),dbPath=resolve(folder,'test.sqlite');
for(const suffix of ['','-wal','-shm'])await copyFile(resolve(source.evidenceDirectory,'test.sqlite')+suffix,dbPath+suffix).catch(e=>{if(!suffix||e.code!=='ENOENT')throw e;});
const db=new DatabaseSync(dbPath),founder=db.prepare("SELECT id FROM users WHERE eco_id='m01.seller'").get().id;
const shop=db.prepare('SELECT * FROM m01_shops WHERE owner_id=? LIMIT 1').get(founder),product=db.prepare('SELECT p.*,v.* FROM products p JOIN m01_product_publication v ON v.product_id=p.id WHERE v.shop_id=?').get(shop.id);
db.prepare("INSERT INTO staff_access(user_id,staff_role,created_at) VALUES(?,'admin',?)").run(founder,new Date().toISOString());
db.prepare("UPDATE m01_shops SET status='draft',visibility='private' WHERE id=?").run(shop.id);
db.prepare("UPDATE m01_product_publication SET moderation='pending',approved_revision=NULL,approved_by=NULL WHERE product_id=?").run(product.id);
const before={payments:db.prepare('SELECT count(*) n FROM payments').get().n,orders:db.prepare('SELECT count(*) n FROM orders').get().n,stock:db.prepare('SELECT stock FROM products WHERE id=?').get(product.id).stock};
let origin,exited=false,log='',failure=null;const checks=[];
const child=spawn(process.execPath,['--import','./scripts/chale-test-provider.mjs','server/index.mjs'],{cwd:root,env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',AI_PROVIDER_KEY:'synthetic-chale-http-fixture',CHALE_SMOKE_CAPTURE:resolve(folder,'unused.jsonl'),PORT:'0',ECOVIBES_DB_PATH:dbPath,ECOVIBES_MEDIA_LOCAL_ROOT:resolve(source.evidenceDirectory,'media'),ECOVIBES_M01_ENABLED:'true',ECOVIBES_M01_FOUNDER_REVIEW_SCOPE:JSON.stringify({accountId:founder,shopId:shop.id}),ECOVIBES_TRACKING_DISABLED:'true',OPENAI_ENV_FILE:'',SUPABASE_URL:'',DATABASE_URL:'',ECOVIBES_PUBLIC_TRENDS_DISABLED:'true'},stdio:['ignore','pipe','pipe','ipc']});
child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);child.on('message',m=>{if(m?.event==='chale-smoke-ready')origin='http://127.0.0.1:'+m.port;});child.on('exit',()=>exited=true);
let actor;
async function request(method,path,body,status=200){
 const r=await fetch(origin+'/api/v1'+path,{method,signal:AbortSignal.timeout(5000),headers:{...(actor?{cookie:actor.cookie,'X-CSRF-Token':actor.csrf}:{}),...(body?{'Content-Type':'application/json',Origin:origin}:{})},body:body?JSON.stringify(body):undefined});
 const data=await r.json();assert.equal(r.status,status,method+' '+path+': '+JSON.stringify(data));return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
async function pending(kind,id){return (await request('GET','/studio/reviews')).data[kind].find(x=>x.id===id);}
const body=p=>({requestId:randomUUID(),revision:p.revision||1,contentHash:p.reviewContentHash,decision:'approved',reason:'I reviewed the exact ordinary-goods version in founder/admin capacity.',selfReviewConfirmed:true});
const review=(kind,id,value,status=200)=>request('POST','/studio/reviews/'+kind+'/'+id,value,status);
const check=(ok,label)=>{assert(ok,label);checks.push(label);};
try{
 for(let n=0;n<300&&!origin&&!exited;n++)await delay(40);assert(origin,'Owned isolated review API did not start: '+log);
 const login=await request('POST','/auth/login',{ecoId:'m01.seller',password:'Local-proof-only-Not-a-production-password!42'});actor={cookie:login.cookie,csrf:login.data.csrfToken};
 let target=await pending('shops',shop.id);
 await review('shops',shop.id,{...body(target),selfReviewConfirmed:false},400);
 const shopReceipt=(await review('shops',shop.id,body(target))).data.receipt;
 check(shopReceipt.capacity==='founder_self_review'&&shopReceipt.creator_id===founder&&shopReceipt.reviewer_id===founder,'explicit scoped founder/admin shop review is labelled self-review');
 target=await pending('products',product.id);check(target.selfReview===true,'queue identifies own listing without claiming independence');
 await review('products',product.id,{...body(target),reason:' '},400);
 await review('products',product.id,{...body(target),contentHash:'f'.repeat(64)},409);
 await review('products',product.id,{...body(target),selfReviewConfirmed:false},400);
 const decision=body(target),receipt=(await review('products',product.id,decision)).data.receipt;
 check(receipt.capacity==='founder_self_review'&&receipt.creator_id===founder&&receipt.reviewer_id===founder&&Number(receipt.revision)===product.revision&&receipt.reason===decision.reason&&Date.parse(receipt.created_at)>0&&JSON.parse(receipt.snapshot_json).content.title===product.name,'append-only receipt records creator/reviewer/time/reason/exact content/version');
 const count=db.prepare('SELECT count(*) n FROM m01_review_receipts').get().n;
 check((await review('products',product.id,decision)).data.replayed===true&&db.prepare('SELECT count(*) n FROM m01_review_receipts').get().n===count,'retry returns existing receipt without another approval');
 await review('products',product.id,{...decision,reason:'A different decision cannot reuse the request ID.'},409);
 assert.throws(()=>db.prepare("UPDATE m01_review_receipts SET reason='Changed reason' WHERE id=?").run(receipt.id),/immutable/);
 assert.throws(()=>db.prepare('DELETE FROM m01_review_receipts WHERE id=?').run(receipt.id),/immutable/);checks.push('SQLite rejects rewriting and deleting receipts');
 check((await request('GET','/public/catalogue')).data.products.length===0,'review approval does not itself publish a product');
 await request('POST','/studio/products/'+product.id+'/publish',{revision:product.revision,confirmPublication:true,confirmSupply:true});
 check((await request('GET','/public/products/'+product.id)).data.product.id===product.id,'separate explicit publication resolves the same reviewed listing');
 const other=(await request('POST','/studio/shops',{requestId:randomUUID(),name:'Life of Kings · different identity',slug:'different-owned-shop'})).data.shop;
 await review('shops',other.id,body(await pending('shops',other.id)),403);checks.push('editable shop name cannot inherit the immutable UUID exception');
 const fields={title:product.name,description:product.description,categoryId:'fashion',priceMinor:product.price_minor,availability:product.availability,stock:product.stock,variants:JSON.parse(product.variants_json),gallery:JSON.parse(receipt.snapshot_json).content.gallery,collection:product.collection_name};
 let changed=(await request('PATCH','/studio/products/'+product.id,{revision:product.revision,...fields,description:'Updated description requires a new review.'})).data.product;
 await review('products',product.id,{...decision,requestId:randomUUID()},409);
 check(db.prepare('SELECT count(*) n FROM m01_review_receipts WHERE id=?').get(receipt.id).n===1,'editing invalidates approval while retaining the old reviewed version');
 const history=(await request('GET','/studio/products/'+product.id)).data.product.reviewHistory;check(history.some(x=>x.id===receipt.id&&x.capacity==='founder_self_review'&&x.contentHash===receipt.content_hash),'authorized Studio reload retains the exact review history');
 await request('POST','/studio/products/'+product.id+'/publish',{revision:changed.revision,confirmPublication:true,confirmSupply:true},409);
 changed=(await request('PATCH','/studio/products/'+product.id,{revision:changed.revision,...fields,categoryId:'beauty',title:'Skin cream'})).data.product;
 await review('products',product.id,body(await pending('products',product.id)),400);checks.push('founder exception cannot approve a category with unavailable regulatory controls');
 changed=(await request('PATCH','/studio/products/'+product.id,{revision:changed.revision,...fields,title:'Prescription medicine'})).data.product;
 await review('products',product.id,body(await pending('products',product.id)),400);checks.push('known restricted content cannot bypass controls through the fashion category');
 changed=(await request('PATCH','/studio/products/'+product.id,{revision:changed.revision,...fields})).data.product;
 db.prepare("DELETE FROM staff_access WHERE user_id=? AND staff_role='admin'").run(founder);
 await request('GET','/studio/reviews',undefined,403);checks.push('revoked current admin authority immediately denies review access');
 check(db.prepare('SELECT count(*) n FROM payments').get().n===before.payments&&db.prepare('SELECT count(*) n FROM orders').get().n===before.orders&&db.prepare('SELECT stock FROM products WHERE id=?').get(product.id).stock===before.stock,'review and publication create no order/payment and do not reserve inventory');
}catch(e){failure={message:e.message,stack:e.stack};}
finally{
 db.close();child.kill('SIGTERM');for(let n=0;n<100&&!exited;n++)await delay(20);if(!exited)child.kill('SIGKILL');
 const report={passed:!failure,checks,failure,folder,sourceReport:process.argv[2],scope:'Real isolated HTTP/auth/SQLite with a synthetic admin and an exact synthetic UUID exception. No production role/scope or product activation; no physical-device or hosted acceptance.'};
 await writeFile(resolve(folder,'report.json'),JSON.stringify(report,null,2));await writeFile(resolve(folder,'server.log'),log);console.log(JSON.stringify(report,null,2));if(failure)process.exitCode=1;
}
