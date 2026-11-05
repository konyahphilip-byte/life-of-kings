import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';

const temp=await mkdtemp(resolve(tmpdir(),'ecovibes-cart-')),dbPath=resolve(temp,'isolated.sqlite'),checks=[];
let origin,db,log='',failure,exited=false;
const bootstrap="import{Server}from'node:http';if(process.env.NODE_ENV!=='test')throw Error('test only');const listen=Server.prototype.listen;Server.prototype.listen=function(...args){this.once('listening',()=>process.send?.({event:'cart-ready',port:this.address()?.port}));return listen.apply(this,args)};globalThis.fetch=()=>{throw Error('Provider access disabled in cart test')}";
const child=spawn(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(bootstrap),'server/index.mjs'],{cwd:new URL('..',import.meta.url),stdio:['ignore','pipe','pipe','ipc'],env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',PORT:'0',API_PORT:'0',ECOVIBES_DB_PATH:dbPath,ECOVIBES_SERVE_WEB:'false',DATABASE_URL:'',SUPABASE_URL:'',OPENAI_ENV_FILE:''}});
child.on('message',m=>{if(m?.event==='cart-ready'&&Number.isInteger(m.port))origin='http://127.0.0.1:'+m.port;});
child.on('exit',()=>exited=true);child.on('error',e=>failure=e);
for(const s of [child.stdout,child.stderr])s.on('data',b=>{log=(log+b).slice(-3000);});
const pass=name=>{checks.push(name);console.log('PASS',name);};
async function call(path,{method='GET',body,account,csrf=true}={}){
 const r=await fetch(origin+'/api/v1'+path,{method,signal:AbortSignal.timeout(5000),headers:{Origin:origin,'Content-Type':'application/json',...(account?{Cookie:account.cookie,...(csrf?{'X-CSRF-Token':account.csrf}:{})}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 return{status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0],cache:r.headers.get('cache-control')};
}
const snapshot=()=>Object.fromEntries(['products','orders','order_items','fulfillment_groups','commerce_carts','commerce_cart_items','commerce_order_commands','domain_events','audit_logs','notifications'].map(t=>[t,db.prepare('SELECT * FROM '+t+' ORDER BY 1').all()]));
try{
 const deadline=Date.now()+15000;while(!origin&&!exited&&!failure&&Date.now()<deadline)await delay(30);
 assert(origin&&!failure&&!exited,'Isolated startup failed: '+(failure?.message||log));db=new DatabaseSync(dbPath);
 const signup=async ecoId=>{const r=await call('/auth/register',{method:'POST',body:{ecoId,displayName:'Synthetic Cart',password:'Synthetic-Cart-Test-123'}});assert.equal(r.status,200);return{id:r.body.user.id,cookie:r.cookie,csrf:r.body.csrfToken};};
 const buyer=await signup('cart.buyer'),seller=await signup('cart.seller'),other=await signup('cart.other');
 db.prepare("INSERT INTO roles(user_id,role,created_at) VALUES(?,'seller',?)").run(seller.id,new Date().toISOString());
 const productResponse=await call('/marketplace/products',{method:'POST',account:seller,body:{name:'Synthetic Cart Item',category:'Testing',priceMinor:1200,stock:10}});assert.equal(productResponse.status,200);const product=productResponse.body.id;
 const endpoint='/marketplace/cart';
 let r=await call(endpoint,{account:buyer});assert.equal(r.status,200,'Account cart must be implemented');assert.equal(r.body.ownerId,buyer.id);assert.deepEqual(r.body.items,[]);assert(r.cache.includes('no-store'));pass('Own empty cart is private and persisted');
 for(const account of[null,other]){r=await call(endpoint+(account?'?ownerId='+buyer.id:''),{account});assert.equal(r.status,account?400:401);}pass('No anonymous cart or account selector');
 const save=(cart,items,account=buyer)=>call(endpoint,{method:'PUT',account,body:{ownerId:account.id,revision:cart.revision,items}});
 const first=await call(endpoint,{account:buyer});
 r=await save(first.body,[{productId:product,quantity:2}]);assert.equal(r.status,200,JSON.stringify(r.body));let cart=r.body;assert.equal(cart.totalMinor,2400);assert.equal(cart.items[0].name,'Synthetic Cart Item');assert.equal(cart.items[0].quantity,2);pass('Canonical catalog IDs, names and prices populate saved cart');
 r=await call(endpoint,{account:buyer});assert.deepEqual(r.body,cart);pass('Reload returns same saved quantities and revision');
 r=await call(endpoint,{account:other});assert.equal(r.body.items.length,0);pass('Second account cannot see buyer cart');
 const before=snapshot();r=await call(endpoint,{method:'PUT',account:other,body:{ownerId:buyer.id,revision:cart.revision,items:[]}});assert.equal(r.status,409);assert.deepEqual(snapshot(),before);pass('Owner hint prevents retargeted account writes');
 for(const items of [[null],[{productId:product,quantity:0}],[{productId:product,quantity:'2'}],[{productId:'not-a-real-product',quantity:1}]]){
  const old=snapshot();r=await save(cart,items);assert(r.status>=400&&r.status<500,JSON.stringify(r));assert.deepEqual(snapshot(),old);
 }pass('Malformed and nonexistent cart lines cannot write');
 r=await call(endpoint,{method:'PUT',account:buyer,csrf:false,body:{ownerId:buyer.id,revision:cart.revision,items:[]}});assert.equal(r.status,403);pass('Cart writes require CSRF');
 r=await save(first.body,[{productId:product,quantity:3}]);assert.equal(r.status,409);pass('Stale tab cannot overwrite changed cart');
 r=await save(first.body,[{productId:product,quantity:2}]);assert.equal(r.status,200);assert.equal(r.body.revision,cart.revision);pass('Repeated absolute PUT is a no-op without quantity doubling');
 const checkout={ownerId:buyer.id,revision:cart.revision,totalMinor:cart.totalMinor,quoteId:cart.quoteId,clientId:randomUUID()};
 const submit=(body=checkout,account=buyer)=>call(endpoint+'/checkout',{method:'POST',account,body});
 db.prepare('UPDATE products SET price_minor=1300 WHERE id=?').run(product);
 const priceBefore=snapshot();r=await submit();assert.equal(r.status,409);assert.deepEqual(snapshot(),priceBefore);pass('Changed canonical price requires another review; no order or stock write');
 db.prepare('UPDATE products SET price_minor=1200 WHERE id=?').run(product);
 db.exec("CREATE TRIGGER synthetic_cart_audit_failure BEFORE INSERT ON audit_logs WHEN NEW.action='ORDER_CREATED' BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END");
 const auditBefore=snapshot();r=await submit();assert.equal(r.status,500);assert.deepEqual(snapshot(),auditBefore);db.exec('DROP TRIGGER synthetic_cart_audit_failure');pass('Audit failure rolls back order, command, stock, notices and cart clearing');
 const results=await Promise.all([submit(),submit()]);for(const result of results)assert.equal(result.status,200,JSON.stringify(result.body));
 assert.equal(results[0].body.order.id,results[1].body.order.id);const order=results[0].body.order;assert.equal(order.total_minor,2400);assert.equal(order.payment_status,'unpaid');assert.equal(results[0].body.ownerId,buyer.id);
 assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n,1);assert.equal(db.prepare('SELECT stock FROM products WHERE id=?').get(product).stock,8);assert.equal(db.prepare('SELECT count(*) n FROM commerce_order_commands').get().n,1);pass('Overlapping retries create one unpaid order and one stock reservation');
 const cleared=(await call(endpoint,{account:buyer})).body;assert.equal(cleared.items.length,0);assert.equal(cleared.lastOrderId,order.id);pass('Committed order clears only that cart revision and remains discoverable after reload');
 let newCart=(await save(cleared,[{productId:product,quantity:1}])).body;
 r=await submit();assert.equal(r.status,200);assert.equal(r.body.order.id,order.id);assert.equal((await call(endpoint,{account:buyer})).body.items[0].quantity,1);pass('Lost-response retry returns original order without clearing later cart items');
 r=await submit({...checkout,totalMinor:2401});assert.equal(r.status,409);pass('Operation key cannot be reassigned to another request');
 r=await submit({...checkout,clientId:randomUUID()});assert.equal(r.status,409);pass('Different operation key cannot buy the same checked-out revision twice');
 r=await submit(checkout,other);assert.equal(r.status,409);pass('Captured checkout cannot retarget another account');
 db.prepare("UPDATE users SET status='suspended' WHERE id=?").run(buyer.id);
 r=await submit();assert.equal(r.status,403);pass('Suspended actor cannot retrieve a cached command');
 db.prepare("UPDATE users SET status='active' WHERE id=?").run(buyer.id);
 const fresh=await call('/auth/login',{method:'POST',body:{ecoId:'cart.buyer',password:'Synthetic-Cart-Test-123'}});assert.equal(fresh.status,200);buyer.cookie=fresh.cookie;buyer.csrf=fresh.body.csrfToken;
 const second=await call('/marketplace/products',{method:'POST',account:seller,body:{name:'Second synthetic item',category:'Testing',priceMinor:800,stock:10}});assert.equal(second.status,200);
 let reviewed=(await save(newCart,[{productId:product,quantity:1},{productId:second.body.id,quantity:1}])).body;assert.equal(reviewed.totalMinor,2000);
 db.prepare('UPDATE products SET price_minor=1300 WHERE id=?').run(product);db.prepare('UPDATE products SET price_minor=700 WHERE id=?').run(second.body.id);
 const offsetBefore=snapshot();r=await submit({ownerId:buyer.id,revision:reviewed.revision,totalMinor:2000,quoteId:reviewed.quoteId,clientId:randomUUID()});assert.equal(r.status,409);assert.deepEqual(snapshot(),offsetBefore);pass('Offsetting item-price changes still require a fresh review');
 db.prepare('UPDATE products SET price_minor=1200 WHERE id=?').run(product);db.prepare('UPDATE products SET price_minor=800 WHERE id=?').run(second.body.id);
 newCart=(await save((await call(endpoint,{account:buyer})).body,[{productId:product,quantity:1}])).body;
 db.prepare("UPDATE products SET status='paused' WHERE id=?").run(product);
 r=await call(endpoint,{account:buyer});assert.equal(r.body.canCheckout,false);assert.equal(r.body.items[0].available,false);
 const unavailableBefore=snapshot();r=await submit({ownerId:buyer.id,revision:newCart.revision,totalMinor:1200,quoteId:newCart.quoteId,clientId:randomUUID()});assert.equal(r.status,409);assert.deepEqual(snapshot(),unavailableBefore);pass('Paused listing is clearly unavailable and cannot be checked out');
}catch(error){failure={name:error.name,message:error.message};process.exitCode=1;console.error('FAIL',error.message);}
finally{
 const report={success:!failure,checks:checks.length,results:checks,failure:failure||null,scope:'Actual HTTP, disposable SQLite, synthetic accounts, no providers or real payments'};
 if(process.env.CART_REPORT_PATH)await writeFile(process.env.CART_REPORT_PATH,JSON.stringify(report,null,2));
 db?.close();child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),delay(3000)]);if(!exited)child.kill('SIGKILL');await rm(temp,{recursive:true,force:true});console.log(JSON.stringify(report));
}
