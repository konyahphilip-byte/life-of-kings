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
 const signup=async ecoId=>{const r=await call('/auth/register',{method:'POST',body:{ecoId,displayName:'Synthetic Classification',password:'Synthetic-Classification-123'}});assert.equal(r.status,200);return {id:r.body.user.id,cookie:r.cookie,csrf:r.body.csrfToken};};
 const seller=await signup('class.seller'),buyer=await signup('class.buyer');
 db.prepare("INSERT INTO roles(user_id,role,created_at) VALUES(?,'seller',?)").run(seller.id,new Date().toISOString());
 const draft={name:'Seller phone',description:'Used phone, actual seller description',categoryId:'electronics.phones',categoryVersion:1,attributes:{condition:'used',brand:'  Example  ',storageGb:128},priceMinor:12500,stock:2,location:'Accra',shippingInfo:'Pickup by agreement'};
 let r=await call('/marketplace/products',{method:'POST',account:buyer,body:draft});assert.equal(r.status,403);pass('Buyer role cannot publish seller inventory');
 r=await call('/marketplace/products',{method:'POST',account:seller,body:draft});assert.equal(r.status,200);const product=r.body;assert.equal(product.category,'Phones');assert.equal(product.attributes.brand,'Example');assert.equal(product.categoryId,draft.categoryId);pass('Seller saves canonical category and normalized category-specific details');
 const stored=db.prepare('SELECT * FROM products WHERE id=?').get(product.id);assert.equal(JSON.parse(stored.attributes_json).storageGb,128);assert.equal(stored.category_version,1);pass('Reloaded canonical product retains actual seller attributes');
 const bad=[{attributes:{}},{attributes:{condition:'verified'}},{attributes:{condition:'used',storageGb:'128'}},{attributes:{condition:'used',sellerId:buyer.id}},{categoryId:'electronics'},{categoryId:'restricted.medicines'},{categoryVersion:2},{productType:'digital'}];
 for(const change of bad){r=await call('/marketplace/products',{method:'POST',account:seller,body:{...draft,...change}});assert.equal(r.status,400);assert(r.body.error.requestId);}
 assert.equal(db.prepare('SELECT count(*) n FROM products').get().n,1);pass('Invalid, restricted, private or mismatched metadata never creates a listing');
 r=await catalog('categoryId=electronics');assert.equal(r.status,200);assert.equal(r.body.items.length,1);assert.equal(r.body.items[0].id,product.id);assert.equal(r.body.items[0].attributes.condition,'used');assert(!('cost_minor' in r.body.items[0]));pass('Buyer finds the saved listing through its parent category and reads seller-declared details');
 r=await catalog('categoryId=electronics.phones');assert.equal(r.body.items[0].id,product.id);r=await catalog('categoryId=home');assert.deepEqual(r.body.items,[]);pass('Exact category and sibling filters use actual category IDs, not text guesses');
 for(const query of ['categoryId=unknown','categoryId=electronics&category=Phones']){r=await catalog(query);assert.equal(r.status,400);}pass('Invalid and ambiguous category filters fail clearly');
 const snapshot=()=>JSON.stringify(db.prepare('SELECT * FROM products WHERE id=?').get(product.id));
 const before=snapshot();r=await call('/marketplace/products/'+product.id,{method:'PATCH',account:seller,body:{stock:9,status:'made-up',attributes:{condition:'used'}}});assert.equal(r.status,400);assert.equal(snapshot(),before);pass('A later invalid status cannot leave an earlier stock or metadata write');
 r=await call('/marketplace/products/'+product.id,{method:'PATCH',account:buyer,body:{attributes:{condition:'new'}}});assert.equal(r.status,404);assert.equal(snapshot(),before);pass('Another account cannot edit product classification');
 r=await call('/marketplace/products/'+product.id,{method:'PATCH',account:seller,body:{attributes:{condition:'refurbished',storageGb:256}}});assert.equal(r.status,200);assert.equal(r.body.attributes.storageGb,256);assert.equal(r.body.attributes.condition,'refurbished');pass('Authorized seller correction persists without changing product identity');
 const count=()=>db.prepare('SELECT count(*) n FROM products').get().n;
 const initial=count();r=await call('/marketplace/products/import',{method:'POST',account:seller,body:{items:[{...draft,name:'Valid batch row'},{...draft,name:'Invalid batch row',attributes:{}}]}});assert.equal(r.status,400);assert.equal(count(),initial);pass('Mixed invalid imports roll back every product and attribute in the batch');
 db.exec("CREATE TRIGGER class_audit_fail BEFORE INSERT ON audit_logs WHEN NEW.action='PRODUCT_CREATED' BEGIN SELECT RAISE(ABORT,'Synthetic audit failure'); END;");
 r=await call('/marketplace/products',{method:'POST',account:seller,body:{...draft,name:'Must roll back'}});assert.equal(r.status,500);assert.equal(count(),initial);db.exec('DROP TRIGGER class_audit_fail');pass('Audit failure rolls back new product and classification together');
 r=await call('/marketplace/products',{method:'POST',account:seller,body:{name:'Legacy text listing',category:'Existing free text',priceMinor:100,stock:1}});assert.equal(r.status,200);assert.equal(r.body.categoryId,null);assert.deepEqual(r.body.attributes,{});r=await catalog('productId='+r.body.id);assert.equal(r.body.items[0].category,'Existing free text');assert.equal(r.body.items[0].categoryId,null);pass('Legacy listings remain readable without invented structured details');
 db.prepare("DELETE FROM roles WHERE user_id=? AND role='seller'").run(seller.id);r=await call('/marketplace/products/'+product.id,{method:'PATCH',account:seller,body:{stock:1}});assert.equal(r.status,403);pass('Withdrawn seller membership cannot edit classified inventory');
 assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n,0);pass('Category discovery and publishing do not fabricate orders, matches, payments or demand');
}catch(e){failure={name:e.name,message:e.message};process.exitCode=1;console.error('FAIL',e.message);}
finally{
 const report={success:!failure,checks:checks.length,results:checks,failure:failure||null,scope:'Actual isolated HTTP/SQLite with synthetic seller and buyer; no hosted Auth, merchant traction, device, provider or money acceptance'};
 if(process.env.CLASSIFICATION_REPORT_PATH)await writeFile(process.env.CLASSIFICATION_REPORT_PATH,JSON.stringify(report,null,2));
 db?.close();child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),delay(3000)]);if(!exited)child.kill('SIGKILL');await rm(temp,{recursive:true,force:true});console.log(JSON.stringify(report));
}
