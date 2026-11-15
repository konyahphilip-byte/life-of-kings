import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {createWebHandler} from '../server/web.mjs';

// Actual production build, disposable browser profiles and synthetic identity only.
// No production API, .env, real account, provider or financial operation is used.
const output='work/assignment-00a/browser';
await mkdir(output,{recursive:true});
const serve=await createWebHandler(fileURLToPath(new URL('../dist',import.meta.url)));
const server=createServer(async(req,res)=>{try{if(!await serve(req,res)){res.writeHead(503,{'Content-Type':'application/json'});res.end('{}');}}catch{res.writeHead(500);res.end();}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin=`http://127.0.0.1:${server.address().port}`;
const user={id:'00000000-0000-4000-8000-000000000001',eco_id:'bag.owner.a',display_name:'Synthetic Bag Owner A',roles:['customer'],created_at:'2026-11-14T00:00:00Z'};
const other={...user,id:'00000000-0000-4000-8000-000000000002',eco_id:'bag.owner.b',display_name:'Synthetic Bag Owner B'};
const accountKey=u=>`ecovibes:v1:account:${u.id}`;
const checks=[];
const failures=[];
let browser;
async function setup({width=390,height=844,signedIn=false,theme='light',serviceWorkers='block'}={}){
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers});
 let current=signedIn?user:null,apiDown=false;
 await context.addInitScript(({user,other,signedIn,theme,origin})=>{
  if(location.origin!==origin)return;
  if(sessionStorage.getItem('bag-fixture-seeded'))return;
  sessionStorage.setItem('bag-fixture-seeded','1');
  localStorage.setItem(signedIn?`ecovibes:v1:account:${user.id}`:'ecovibes:v1',JSON.stringify({cart:{x1:2},theme}));
  localStorage.setItem(`ecovibes:v1:account:${other.id}`,JSON.stringify({cart:{x2:3},theme}));
 },{user,other,signedIn,theme,origin});
 const page=await context.newPage(),requests=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push({path:new URL(r.url()).pathname,method:r.method()});});
 await context.routeWebSocket('**/*',s=>s.close());
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==origin)return route.abort();
  if(!url.pathname.startsWith('/api/'))return route.continue();
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(apiDown)return json({error:{code:'synthetic_outage',message:'Synthetic API unavailable'}},503);
  if(url.pathname.endsWith('/auth/me'))return json({user:current,csrfToken:current?'synthetic-csrf':null});
  if(url.pathname.endsWith('/notifications/summary'))return json({ownerId:current?.id,items:[],unread:0,truncated:false});
  if(url.pathname.endsWith('/ai/status'))return json({configured:false,paidFallback:false});
  if(['/api/v1/jobs','/api/v1/marketplace/products','/api/v1/marketplace/orders','/api/v1/notifications','/api/v1/trust/verifications'].includes(url.pathname))return json([]);
  return json({});
 });
 return {context,page,requests,errors,setUser:u=>{current=u;},setApiDown:(value=true)=>{apiDown=value;}};
}
const financial=r=>!['GET','HEAD'].includes(r.method)&&/orders|checkout|payments|refund|transfers|payout/.test(r.path);
async function openBag(page){await page.locator('.bag-button').click();const bag=page.getByRole('dialog',{name:'Your bag 2',exact:true});await bag.waitFor();return bag;}
async function hasBasket(page,key,cart){assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'{}').cart,key),cart);}
function luminance(rgb){const c=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{const s=n/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});return .2126*c[0]+.7152*c[1]+.0722*c[2];}
async function verifyLayout(page,bag,width,height){
 const info=await bag.evaluate(dialog=>{
  const aside=dialog.querySelector('.cart-drawer'),rect=aside.getBoundingClientRect();
  const samples=[...dialog.querySelectorAll('.cart-item b,.cart-item small,.cart-summary>small,.cart-summary>p,.checkout-button')].map(el=>({color:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor==='rgba(0, 0, 0, 0)'?getComputedStyle(el.closest('.cart-drawer')).backgroundColor:getComputedStyle(el).backgroundColor,font:parseFloat(getComputedStyle(el).fontSize)}));
  const targets=[...dialog.querySelectorAll('button')].map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height};});
  return {rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},samples,targets,modal:dialog.matches(':modal')};
 });
 assert(info.modal,'Native modal must make the background inert');
 assert(info.rect.x>=-1&&info.rect.y>=-1&&info.rect.x+info.rect.width<=width+1&&info.rect.y+info.rect.height<=height+1);
 assert(info.targets.every(t=>t.width>=44&&t.height>=44),'All Bag buttons need 44px touch targets');
 for(const s of info.samples){assert(s.font>=13,'Bag copy must stay legible');const a=luminance(s.color),b=luminance(s.bg);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,'Bag text contrast');}
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');
 await bag.getByRole('button',{name:'Open EcoVibes ID'}).scrollIntoViewIfNeeded();
 await bag.getByRole('button',{name:'Close bag'}).focus();
 await page.keyboard.press('Shift+Tab');
 assert(await bag.getByRole('button',{name:'Open EcoVibes ID'}).evaluate(e=>document.activeElement===e),'Keyboard focus must wrap inside Bag');
 await page.keyboard.press('Escape');await bag.waitFor({state:'detached'});
 assert(await page.locator('.bag-button').evaluate(e=>document.activeElement===e),'Return keyboard focus to Bag opener');
}
try{
 browser=await chromium.launch(process.platform==='darwin'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{});
 for(const width of [320,390,768,1440])for(const theme of ['light','dark'])for(const signedIn of [false,true])for(const online of [true,false]){
  const height=width===1440?900:844,label=`${width}-${theme}-${signedIn?'member':'guest'}-${online?'online':'offline'}`;
  const f=await setup({width,height,signedIn,theme}),{context,page,requests,errors}=f;
  try{
   // Load the real account workspace while connected; offline navigation does not need a new JS download.
   await page.goto(`${origin}/#account`);await page.getByRole('heading',{name:'One account. Shared services.'}).waitFor();
   if(signedIn)await page.locator('.backend-tabs').getByRole('button',{name:'Marketplace',exact:true}).waitFor();
   else await page.getByRole('heading',{name:'Create your EcoVibes ID',exact:true}).waitFor();
   await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ecovibes:navigate',{detail:'Settings'})));
   await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();
   if(!online){await context.setOffline(true);await page.getByText('You’re offline. Saved content is still available.',{exact:true}).waitFor();}
   let bag=await openBag(page);
   assert(await bag.getByText('Coastline print set',{exact:true}).isVisible());
   assert(await bag.getByText(/Qty 2/).isVisible());
   assert(await bag.getByText(/Checkout is not connected to this bag/).isVisible());
   assert(await bag.getByText(/This subtotal is not a payment quote/).isVisible());
   if(width<=390)await page.screenshot({path:`${output}/${label}.png`});
   await verifyLayout(page,bag,width,height);
   bag=await openBag(page);await bag.getByRole('button',{name:'Open EcoVibes ID'}).click();
   await page.getByRole('heading',{name:'One account. Shared services.'}).waitFor();assert.equal(new URL(page.url()).hash,'#account');
   if(online&&signedIn){await page.locator('.backend-tabs').getByRole('button',{name:'Marketplace',exact:true}).click();await page.getByRole('heading',{name:'Your orders',exact:true}).waitFor();}
   assert.equal(await page.getByText('Sandbox order created · no payment was taken',{exact:true}).count(),0);
   assert.equal(await page.locator('.toast').count(),0,'Safety action must not create a success toast');
   await hasBasket(page,signedIn?accountKey(user):'ecovibes:v1',{x1:2});
   // Browser offline reload cannot be promised without a service worker. Test the actual failure,
   // then reconnect/reload and prove the stored basket survived without guessing account ownership.
   let offlineReload='not requested';
   if(!online){try{await page.reload({waitUntil:'domcontentloaded'});offlineReload='browser cached document; identity still requires confirmation';await hasBasket(page,signedIn?accountKey(user):'ecovibes:v1',{x1:2});}catch(e){assert.match(e.message,/ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED/);offlineReload='full offline document unavailable';}await context.setOffline(false);}
   await page.goto(`${origin}/#settings`);await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();
   if(signedIn)await page.waitForFunction(()=>document.querySelector('.side-profile small')?.textContent==='@bag.owner.a');
   bag=await openBag(page);assert(await bag.getByText(/Qty 2/).isVisible());
   await hasBasket(page,accountKey(other),{x2:3});
   assert.deepEqual(requests.filter(financial),[]);assert.deepEqual(errors,[]);
   checks.push({label,passed:true,financialMutations:0,reload:online?'online reload retained basket':`${offlineReload}; reconnect reload retained basket`,layout:infoLabel(width,theme)});
  }finally{await context.close();}
 }

 // Verify the existing app-shell worker rather than claiming all offline reloads are unsupported.
 for(const signedIn of [false,true]){
  const f=await setup({signedIn,serviceWorkers:'allow'});
  try{
   await f.page.goto(origin+'/#settings');await f.page.getByRole('heading',{name:'Settings',exact:true}).waitFor();
   await f.page.evaluate(()=>navigator.serviceWorker.ready);
   await f.page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
   await f.page.reload();await f.page.getByRole('heading',{name:'Settings',exact:true}).waitFor();
   if(signedIn)await f.page.waitForFunction(()=>document.querySelector('.side-profile small')?.textContent==='@bag.owner.a');
   await f.page.waitForFunction(async()=>{const keys=await caches.keys();const requests=(await Promise.all(keys.map(k=>caches.open(k).then(c=>c.keys())))).flat();return requests.some(r=>r.url.includes('/assets/')&&r.url.endsWith('.js'))&&requests.some(r=>r.url.endsWith('.css'));});
   f.setApiDown(true);await f.context.setOffline(true);await f.page.reload();await f.page.getByRole('heading',{name:'Settings',exact:true}).waitFor();
   await f.page.locator('.bag-button').click();
   if(signedIn){await f.page.getByText('Your bag is taking a breather',{exact:true}).waitFor();assert.equal(await f.page.getByText(/Qty 2/).count(),0);}
   else await f.page.getByRole('dialog').getByText(/Qty 2/).waitFor();
   await hasBasket(f.page,signedIn?accountKey(user):'ecovibes:v1',{x1:2});
   await f.page.keyboard.press('Escape');f.setApiDown(false);await f.context.setOffline(false);
   await f.page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
   if(signedIn)await f.page.waitForFunction(()=>document.querySelector('.side-profile small')?.textContent==='@bag.owner.a');
   const bag=await openBag(f.page);await bag.getByText(/Qty 2/).waitFor();
   const cachedApi=await f.page.evaluate(async()=>{const keys=await caches.keys();const requests=(await Promise.all(keys.map(k=>caches.open(k).then(c=>c.keys())))).flat();return requests.some(r=>new URL(r.url).pathname.startsWith('/api/'));});
   assert.equal(cachedApi,false);assert.deepEqual(f.requests.filter(financial),[]);assert.deepEqual(f.errors,[]);
   checks.push({label:'existing offline app-shell cache: '+(signedIn?'account basket retained privately until identity reconfirmed':'guest basket visible after offline reload'),passed:true,cachedApi:false});
  }finally{await f.context.close();}
 }
 // Actual account changes while the drawer is open must never mix the saved baskets.
 const f=await setup({signedIn:true});
 try{
  await f.page.goto(`${origin}/#settings`);await f.page.waitForFunction(()=>document.querySelector('.side-profile small')?.textContent==='@bag.owner.a');
  await openBag(f.page);f.setUser(other);await f.page.evaluate(()=>window.dispatchEvent(new Event('ecovibes:identity_changed')));
  const bag=f.page.getByRole('dialog');await bag.getByText(/Qty 3/).waitFor();assert.equal(await bag.getByText(/Qty 2/).count(),0);
  f.setUser(user);await f.page.evaluate(()=>window.dispatchEvent(new Event('ecovibes:identity_changed')));await bag.getByText(/Qty 2/).waitFor();
  await hasBasket(f.page,accountKey(other),{x2:3});await hasBasket(f.page,accountKey(user),{x1:2});assert.deepEqual(f.requests.filter(financial),[]);assert.deepEqual(f.errors,[]);
  checks.push({label:'account A → B → A while Bag remains open',passed:true});
 }finally{await f.context.close();}
 // Short landscape: the whole drawer scrolls and every action remains reachable.
 const short=await setup({width:844,height:240});
 try{await short.page.goto(`${origin}/#settings`);await short.page.getByRole('heading',{name:'Settings',exact:true}).waitFor();const bag=await openBag(short.page);await bag.getByRole('button',{name:'Open EcoVibes ID'}).scrollIntoViewIfNeeded();assert(await bag.getByRole('button',{name:'Open EcoVibes ID'}).isVisible());await short.page.screenshot({path:`${output}/short-landscape.png`});checks.push({label:'short landscape actions reachable',passed:true});}finally{await short.context.close();}
}catch(e){failures.push({name:e.name,message:e.message,stack:e.stack});}
finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));const report={passed:failures.length===0,checks,failures,scope:'Built desktop Chromium with synthetic identities and real browser offline mode. Not hosted, physical-device, genuine sign-in or durable checkout acceptance.'};await writeFile(`${output}/checks.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;}
function infoLabel(width,theme){return `${width}px/${theme}: native modal, keyboard wrap/Escape/focus return, 44px targets, >=13px copy, >=4.5 contrast, no horizontal overflow`;}
