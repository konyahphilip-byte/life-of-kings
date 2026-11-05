import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';
const app=new URL('..',import.meta.url),temp=await mkdtemp(resolve(tmpdir(),'ecovibes-catalog-')),dbPath=resolve(temp,'isolated.sqlite'),checks=[];
let origin,db,log='',failure,exited=false;
const bootstrap="import{Server}from'node:http';if(process.env.NODE_ENV!=='test')throw Error('test only');const listen=Server.prototype.listen;Server.prototype.listen=function(...args){this.once('listening',()=>process.send?.({event:'catalog-ready',port:this.address()?.port}));return listen.apply(this,args)};globalThis.fetch=()=>{throw Error('External provider access disabled in catalog test')}";
const child=spawn(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(bootstrap),'server/index.mjs'],{cwd:app,stdio:['ignore','pipe','pipe','ipc'],env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',PORT:'0',API_PORT:'0',ECOVIBES_DB_PATH:dbPath,ECOVIBES_SERVE_WEB:'false',DATABASE_URL:'',SUPABASE_URL:'',OPENAI_ENV_FILE:''}});
child.on('message',m=>{if(m?.event==='catalog-ready'&&Number.isInteger(m.port))origin='http://127.0.0.1:'+m.port;});child.on('exit',()=>exited=true);child.on('error',e=>failure=e);
for(const s of[child.stdout,child.stderr])s.on('data',b=>{log=(log+b).slice(-4000);});
async function call(path,{method='GET',body,account}={}){
 const r=await fetch(origin+'/api/v1'+path,{method,signal:AbortSignal.timeout(5000),headers:{Origin:origin,'Content-Type':'application/json',...(account?{Cookie:account.cookie,'X-CSRF-Token':account.csrf}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0],cache:r.headers.get('cache-control')};
}
const pass=name=>{checks.push(name);console.log('PASS',name);};
const catalog=query=>call('/marketplace/catalog'+(query?'?'+query:''));
try{
 const deadline=Date.now()+15000;while(!origin&&!exited&&!failure&&Date.now()<deadline)await delay(30);assert(origin&&!failure&&!exited,'Isolated startup failed: '+(failure?.message||log));
 db=new DatabaseSync(dbPath);
 let r=await catalog('');assert.equal(r.status,200);assert.deepEqual(r.body.items,[]);assert.equal(r.cache,'no-store');pass('Guest can distinguish a genuine empty catalog from an outage');
 const signup=async ecoId=>{const r=await call('/auth/register',{method:'POST',body:{ecoId,displayName:'Synthetic Catalog',password:'Synthetic-Catalog-123'}});assert.equal(r.status,200);return {id:r.body.user.id,cookie:r.cookie,csrf:r.body.csrfToken};};
 const seller=await signup('catalog.seller'),buyer=await signup('catalog.buyer'),other=await signup('catalog.other');
 db.prepare("INSERT INTO roles(user_id,role,created_at) VALUES(?,'seller',?)").run(seller.id,new Date().toISOString());
 const created=[];
 for(let i=0;i<15;i++){r=await call('/marketplace/products',{method:'POST',account:seller,body:{name:i===0?'100% cotton':i===1?'100x cotton':'Native tomato '+i,description:'Seller-entered produce',category:i%2?'Vegetables':'Textiles',priceMinor:100+i*100,costMinor:50,stock:i===2?0:10,supplierName:'PRIVATE-COST-SUPPLIER',location:'Accra'}});assert.equal(r.status,200);created.push(r.body);}
 db.prepare("UPDATE products SET created_at='2026-11-05T10:00:00.000Z'").run();
 r=await catalog('limit=4');assert.equal(r.body.items.length,4);assert(r.body.nextCursor);const seen=new Set(r.body.items.map(i=>i.id));
 let cursor=r.body.nextCursor;while(cursor){r=await catalog('limit=4&cursor='+cursor);assert.equal(r.status,200);for(const i of r.body.items){assert(!seen.has(i.id));seen.add(i.id);}cursor=r.body.nextCursor;}assert.equal(seen.size,15);pass('Stable keyset pagination returns every saved product once, including timestamp ties');
 r=await catalog('q=100%25');assert.deepEqual(r.body.items.map(i=>i.name),['100% cotton']);pass('Search treats wildcard characters as literal user text');
 r=await catalog('q=tomato&category=vegetables&minPrice=300&maxPrice=800&inStock=1&sort=price_low');assert.equal(r.status,200);assert(r.body.items.length>0);assert(r.body.items.every(i=>i.category==='Vegetables'&&i.priceMinor>=300&&i.priceMinor<=800&&i.stock>0));assert.deepEqual(r.body.items.map(i=>i.priceMinor),[400,600,800]);pass('Search/category/price/availability filters use actual canonical data');
 r=await catalog('seller=%40catalog.seller');assert(r.body.items.every(i=>i.sellerEcoId==='catalog.seller'));assert(!JSON.stringify(r.body).includes('PRIVATE-COST-SUPPLIER'));for(const i of r.body.items){assert(!('costMinor'in i));assert(!('seller_id'in i));assert(!('source_url'in i));}pass('Public seller search exposes no cost, internal identity or private source URL');
 r=await catalog('productId='+created[0].id);assert.equal(r.body.items.length,1);assert.equal(r.body.items[0].id,created[0].id);pass('Canonical selected-product lookup reaches items beyond an initial page');
 r=await catalog('sort=price_high&limit=3');assert.deepEqual(r.body.items.map(i=>i.priceMinor),[1500,1400,1300]);pass('Price sorting uses canonical base prices');
 for(const text of['mine=1','limit=999','limit=0','q=a&q=b','source=unsupported','cursor=broken','minPrice=9&maxPrice=1','buyerId='+buyer.id]){r=await catalog(text);assert.equal(r.status,400,text);assert(r.body.error.requestId);}pass('Private selectors, malformed cursor and ambiguous/unbounded filters fail closed');
 const first=await catalog('q=tomato&limit=2');assert(first.body.nextCursor);r=await catalog('q=cotton&limit=2&cursor='+first.body.nextCursor);assert.equal(r.status,400);pass('Pagination cannot silently cross into a different search');
 db.prepare("UPDATE products SET status='paused' WHERE id=?").run(created[0].id);db.prepare("UPDATE products SET status='removed' WHERE id=?").run(created[1].id);db.prepare("UPDATE products SET fulfillment_type='external_checkout' WHERE id=?").run(created[2].id);
 r=await catalog('limit=24');assert.equal(r.body.items.length,12);assert(!r.body.items.some(i=>created.slice(0,3).some(x=>x.id===i.id)));pass('Paused, removed and external-checkout records are excluded without deleting them');
 db.prepare("UPDATE products SET source_type='shopify' WHERE id=?").run(created[3].id);r=await catalog('source=shopify');assert.equal(r.body.items.length,1);assert.equal(r.body.items[0].source_type,'shopify');pass('Imported source labels come from the actual saved source field, not a direct-listing default');
 db.prepare("UPDATE users SET status='suspended' WHERE id=?").run(seller.id);r=await catalog('');assert.deepEqual(r.body.items,[]);db.prepare("UPDATE users SET status='active' WHERE id=?").run(seller.id);pass('Inactive sellers cannot appear as current storefront stock');
 db.prepare("DELETE FROM roles WHERE user_id=? AND role='seller'").run(seller.id);r=await catalog('');assert.deepEqual(r.body.items,[]);pass('Withdrawn seller membership removes public catalog eligibility');
 assert.equal(db.prepare('SELECT count(*) n FROM products').get().n,15);assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n,0);pass('Discovery does not create orders, alter inventory or delete uncertain records');
 r=await call('/marketplace/products/'+created[4].id,{method:'PATCH',account:other,body:{name:'Unauthorized edit'}});assert.equal(r.status,404);assert.equal(db.prepare('SELECT name FROM products WHERE id=?').get(created[4].id).name,created[4].name);pass('Existing seller ownership hides and denies another account’s edit without mutation');
}catch(e){failure={name:e.name,message:e.message};process.exitCode=1;console.error('FAIL',e.message);}
finally{
 const report={success:!failure,checks:checks.length,results:checks,failure:failure||null,scope:'Actual HTTP, disposable SQLite, synthetic seller/buyer records; no real Auth, hosted merchant, external API, storage or money acceptance'};
 if(process.env.CATALOG_REPORT_PATH)await writeFile(process.env.CATALOG_REPORT_PATH,JSON.stringify(report,null,2));
 db?.close();child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),delay(3000)]);if(!exited)child.kill('SIGKILL');await rm(temp,{recursive:true,force:true});console.log(JSON.stringify(report));
}
