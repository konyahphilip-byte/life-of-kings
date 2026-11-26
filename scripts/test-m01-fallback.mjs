import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir,copyFile,mkdtemp,writeFile,readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
const root=fileURLToPath(new URL('../',import.meta.url));
assert(process.argv[2],'Pass the exact retained native HTTP report path.');
const source=JSON.parse(await readFile(process.argv[2],'utf8'));assert(source.passed,'Use a passing isolated fixture only.');
await mkdir(resolve(root,'work/m01-native'),{recursive:true});
const folder=await mkdtemp(resolve(root,'work/m01-native/fallback-')),database=resolve(folder,'copy.sqlite');
for(const suffix of ['','-wal','-shm'])await copyFile(resolve(source.evidenceDirectory,'test.sqlite')+suffix,database+suffix).catch(e=>{if(suffix===''||e.code!=='ENOENT')throw e;});
const db=new DatabaseSync(database);
const product=db.prepare('SELECT p.id,p.image_url FROM products p JOIN m01_product_publication v ON v.product_id=p.id LIMIT 1').get();assert(product);
db.prepare("UPDATE products SET status='active' WHERE id=?").run(product.id);
db.prepare("UPDATE m01_product_publication SET publication='published',moderation='approved',approved_revision=revision WHERE product_id=?").run(product.id);
db.prepare("UPDATE m01_shops SET status='suspended'").run();
const originalStock=db.prepare('SELECT stock FROM products WHERE id=?').get(product.id).stock;
db.close();
let origin,exit=false,log='',failure=null;const checks=[];
const child=spawn(process.execPath,['--import','./scripts/chale-test-provider.mjs','server/index.mjs'],{cwd:process.env.M01_FALLBACK_SERVER_ROOT||root,env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',AI_PROVIDER_KEY:'synthetic-chale-http-fixture',CHALE_SMOKE_CAPTURE:resolve(folder,'unused.jsonl'),PORT:'0',ECOVIBES_DB_PATH:database,ECOVIBES_MEDIA_LOCAL_ROOT:resolve(source.evidenceDirectory,'media'),ECOVIBES_M01_ENABLED:'false',ECOVIBES_TRACKING_DISABLED:'true',OPENAI_ENV_FILE:'',SUPABASE_URL:'',DATABASE_URL:'',ECOVIBES_PUBLIC_TRENDS_DISABLED:'true'},stdio:['ignore','pipe','pipe','ipc']});
child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);child.on('message',m=>{if(m?.event==='chale-smoke-ready')origin='http://127.0.0.1:'+m.port;});child.on('exit',()=>exit=true);
async function get(path,actor){const r=await fetch(origin+'/api/v1'+path,{headers:actor?{cookie:actor.cookie}:{}});return {status:r.status,body:r.headers.get('content-type')?.startsWith('application/json')?await r.json():null};}
try{
 for(let n=0;n<300&&!origin&&!exit;n++)await delay(50);assert(origin,'Owned fallback API failed to start: '+log);
 const r=await fetch(origin+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({ecoId:'m01.buyer',password:'Local-proof-only-Not-a-production-password!42'})});
 assert.equal(r.status,200);const data=await r.json(),actor={cookie:r.headers.get('set-cookie').split(';')[0],csrfToken:data.csrfToken};
 const publicResult=await get('/marketplace/products',actor);
 assert.equal(publicResult.status,200);assert.deepEqual(publicResult.body,[],'Disabling Studio must not expose a suspended native shop through legacy catalogue.');
 checks.push('default-off fallback hides native records from legacy catalogue');
 const image=await get(product.image_url,actor);assert.equal(image.status,404);checks.push('fallback cannot expose native photos through legacy media path');
 const search=await get('/search?q=Native',actor);assert.equal(search.status,200);assert.equal(search.body.items.filter(p=>p.kind==='product').length,0);checks.push('fallback preserves search visibility isolation');
 const order=await fetch(origin+'/api/v1/marketplace/orders',{method:'POST',headers:{cookie:actor.cookie,'X-CSRF-Token':actor.csrfToken,'Content-Type':'application/json',Origin:origin},body:JSON.stringify({items:[{productId:product.id,quantity:1,variantId:'medium'}]})});assert.equal(order.status,503);checks.push('fallback cannot restore checkout for native listings');
 const login=await fetch(origin+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({ecoId:'m01.seller',password:'Local-proof-only-Not-a-production-password!42'})});
 assert.equal(login.status,200);const sellerData=await login.json();
 const edit=await fetch(origin+'/api/v1/marketplace/products/'+product.id,{method:'PATCH',headers:{cookie:login.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':sellerData.csrfToken,'Content-Type':'application/json',Origin:origin},body:JSON.stringify({priceMinor:999})});
 assert.equal(edit.status,409,'Disabling Studio must not allow unreviewed legacy product edits.');checks.push('fallback blocks legacy edits of native review versions');
 const checkDb=new DatabaseSync(database);assert.equal(checkDb.prepare('SELECT stock FROM products WHERE id=?').get(product.id).stock,originalStock);assert.equal(checkDb.prepare('SELECT count(*) n FROM orders').get().n,0);checkDb.close();checks.push('fallback creates no order and preserves inventory');
 assert.equal((await get('/public/catalogue')).status,503);checks.push('new Studio paths remain explicitly unavailable while disabled');
}catch(e){failure={message:e.message,stack:e.stack};}
finally{
 child.kill('SIGTERM');for(let n=0;n<100&&!exit;n++)await delay(20);if(!exit)child.kill('SIGKILL');
 const report={passed:!failure,checks,failure,folder,sourceReport:process.argv[2],scope:'Copied isolated synthetic database; original evidence unchanged. No hosted changes.'};
 await writeFile(resolve(folder,'report.json'),JSON.stringify(report,null,2));await writeFile(resolve(folder,'server.log'),log);console.log(JSON.stringify(report,null,2));if(failure)process.exitCode=1;
}
