import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile,statfs} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {createWebHandler} from '../server/web.mjs';

// Actual production build, disposable browser profiles and synthetic identity only.
// No production API, .env, real account, provider or financial operation is used.
const output=process.env.BAG_SAFETY_OUTPUT||`work/assignment-00a/browser/run-${Date.now()}`;
await mkdir(output,{recursive:true});
const capacity=[];
async function checkCapacity(phase){
 const samples=await Promise.all([output,tmpdir()].map(async path=>{const s=await statfs(path);return {path,freeBytes:s.bavail*s.bsize};}));
 capacity.push({phase,at:new Date().toISOString(),samples});
 assert(samples.every(s=>s.freeBytes>=2*1024**3),'Insufficient storage: at least2GiB must be available before continuing; incomplete runs are not passes');
}
await checkCapacity('before-browser');
const serve=await createWebHandler(fileURLToPath(new URL('../dist',import.meta.url)));
const server=createServer(async(req,res)=>{try{if(!await serve(req,res)){res.writeHead(503,{'Content-Type':'application/json'});res.end('{}');}}catch{res.writeHead(500);res.end();}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin=`http://127.0.0.1:${server.address().port}`;
const user={id:'00000000-0000-4000-8000-000000000001',eco_id:'bag.owner.a',display_name:'Synthetic Bag Owner A',roles:['customer'],created_at:'2026-11-14T00:00:00Z'};
const other={...user,id:'00000000-0000-4000-8000-000000000002',eco_id:'bag.owner.b',display_name:'Synthetic Bag Owner B'};
const accountKey=u=>`ecovibes:v1:account:${u.id}`;
const checks=[];
const failures=[];
const badgeMeasurements=[];
const actionMeasurements=[];
let browser;
async function setup({width=390,height=844,signedIn=false,theme='light',serviceWorkers='block',cart={x1:2},sellerProducts=[]}={}){
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers});
 let current=signedIn?user:null,apiDown=false;
 await context.addInitScript(({user,other,signedIn,theme,origin,cart,sellerProducts})=>{
  if(location.origin!==origin)return;
  if(sessionStorage.getItem('bag-fixture-seeded'))return;
  sessionStorage.setItem('bag-fixture-seeded','1');
  localStorage.setItem(signedIn?`ecovibes:v1:account:${user.id}`:'ecovibes:v1',JSON.stringify({cart,theme}));
  localStorage.setItem('ecovibes:marketplace-products:v1',JSON.stringify(sellerProducts));
  localStorage.setItem(`ecovibes:v1:account:${other.id}`,JSON.stringify({cart:{x2:3},theme}));
 },{user,other,signedIn,theme,origin,cart,sellerProducts});
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
async function openBag(page,count=2){await page.locator('.bag-button').click();const bag=page.getByRole('dialog',{name:'Your bag '+count,exact:true});await bag.waitFor();return bag;}
async function hasBasket(page,key,cart){assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'{}').cart,key),cart);}
function luminance(rgb){const c=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{const s=n/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});return .2126*c[0]+.7152*c[1]+.0722*c[2];}

async function measureBadge(bag,{width,theme,phase}){
 const computed=await bag.locator('#bag-title span').evaluate(badge=>{
  const style=getComputedStyle(badge),backgrounds=[];
  for(let node=badge;node;node=node.parentElement){
   const current=getComputedStyle(node);backgrounds.push({color:current.backgroundColor,image:current.backgroundImage});
   const rgba=current.backgroundColor.match(/[\d.]+/g)?.map(Number);
   if(rgba&&(rgba.length===3||rgba[3]===1))break;
  }
  return {foreground:style.color,background:style.backgroundColor,fontSize:parseFloat(style.fontSize),backgrounds};
 });
 const rgba=value=>{assert(/^rgba?\(/.test(value),'Badge measurement requires computed RGB colors');const parts=value.match(/[\d.]+/g).map(Number);assert(parts.length===3||parts.length===4);return [...parts.slice(0,3),parts[3]??1];};
 assert(computed.backgrounds.every(b=>b.image==='none'),'Badge effective background must be measurable without an image');
 const layers=computed.backgrounds.map(b=>rgba(b.color));assert.equal(layers.at(-1)[3],1,'Badge measurement must reach an opaque background');
 const blend=(over,under)=>over.slice(0,3).map((n,i)=>n*over[3]+under[i]*(1-over[3]));
 let effectiveBackground=layers.at(-1).slice(0,3);
 for(let i=layers.length-2;i>=0;i--)effectiveBackground=blend(layers[i],effectiveBackground);
 const effectiveForeground=blend(rgba(computed.foreground),effectiveBackground);
 const rgb=values=>'rgb('+values.join(', ')+')';
 const a=luminance(rgb(effectiveForeground)),b=luminance(rgb(effectiveBackground));
 const result={width,theme,phase,foreground:computed.foreground,background:computed.background,effectiveBackground:rgb(effectiveBackground),fontSize:computed.fontSize,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
 badgeMeasurements.push(result);console.log('Badge measurement '+JSON.stringify(result));return result;
}
function assertBadge(sample){assert(sample.contrast>=4.5,'Bag badge contrast below 4.5:1: '+JSON.stringify(sample));assert(sample.fontSize>=13,'Bag badge font below 13px: '+JSON.stringify(sample));}

// Wait for browser rendering after changing root text sizing; no arbitrary sleep or relaxed threshold.
async function setTextScale(page,scale){
 await page.evaluate(scale=>{document.documentElement.style.fontSize=`${scale*100}%`;return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},scale);
 assert.equal(await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize)),16*scale);
}
async function measureAction(bag,{width,height,theme,scale=1,actionName='Open EcoVibes ID'}){
 const geometry=await bag.getByRole('button',{name:actionName}).evaluate(button=>{
  const rect=r=>({top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height});
  const bounds=button.getBoundingClientRect(),style=getComputedStyle(button),textRects=[];
  const walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
   const node=walker.currentNode;if(!node.textContent.trim()||node.parentElement.closest('svg'))continue;
   const range=document.createRange();range.selectNodeContents(node);textRects.push(...[...range.getClientRects()].map(rect));
  }
  const icons=[...button.querySelectorAll('svg')].map(el=>rect(el.getBoundingClientRect()));
  const visiblePoint=r=>{const el=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return Boolean(el&&button.contains(el));};
  return {button:rect(bounds),textRects,icons,fontSize:parseFloat(style.fontSize),lineHeight:parseFloat(style.lineHeight),overflowX:style.overflowX,overflowY:style.overflowY,visiblePoints:[...textRects,...icons].map(visiblePoint)};
 });
 const result={width,height,theme,scale,...geometry};actionMeasurements.push(result);console.log('Action measurement '+JSON.stringify(result));return result;
}
function assertAction(sample){
 const {button,textRects,icons,width,height,scale}=sample;
 const inside=(r,padding=0)=>r.left>=button.left+padding-.5&&r.right<=button.right-padding+.5&&r.top>=button.top+padding-.5&&r.bottom<=button.bottom-padding+.5;
 assert(textRects.length>0&&textRects.every(r=>r.width>0&&r.height>0),'Bag action must have rendered label rectangles');
 assert(textRects.every(r=>inside(r,8)),'Bag action label escapes its padded button bounds: '+JSON.stringify(sample));
 assert.equal(icons.length,1,'Bag action needs its navigation icon');
 assert(icons.every(r=>inside(r,8)&&r.width>=16&&r.height>=16),'Bag action icon must remain readable and contained: '+JSON.stringify(sample));
 assert(icons.every(r=>Math.abs((r.top+r.bottom)-(button.top+button.bottom))<=1),'Bag action icon must stay vertically centred');
 assert(sample.fontSize>=15*scale&&sample.lineHeight>=sample.fontSize*1.4-.1,'Bag action text cannot shrink to fit');
 assert(button.width>=44&&button.height>=48,'Bag action minimum touch target');
 assert(!['hidden','clip'].includes(sample.overflowX)&&!['hidden','clip'].includes(sample.overflowY),'Bag action cannot hide overflowing content');
 assert(button.left>=-.5&&button.right<=width+.5&&button.top>=-.5&&button.bottom<=height+.5,'Scrolled Bag action must fit the viewport');
 assert(sample.visiblePoints.every(Boolean),'Bag action label and icon must be unobscured');
}

async function verifyLayout(page,bag,width,height){
 const info=await bag.evaluate(dialog=>{
  const aside=dialog.querySelector('.cart-drawer'),rect=aside.getBoundingClientRect();
  const samples=[...dialog.querySelectorAll('.cart-item b,.cart-item small,.cart-summary>small,.cart-summary>p,.checkout-button')].map(el=>({color:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor==='rgba(0, 0, 0, 0)'?getComputedStyle(el.closest('.cart-drawer')).backgroundColor:getComputedStyle(el).backgroundColor,font:parseFloat(getComputedStyle(el).fontSize)}));
  const targets=[...dialog.querySelectorAll('button')].map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height};});
  return {rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},samples,targets,modal:dialog.matches(':modal')};
 });
 const theme=await bag.evaluate(el=>el.closest('.app').classList.contains('theme-dark')?'dark':'light');
 assertBadge(await measureBadge(bag,{width,theme,phase:'safety-matrix'}));
 await bag.getByRole('button',{name:'Open EcoVibes ID'}).scrollIntoViewIfNeeded();
 const scale=await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize)/16);
 assertAction(await measureAction(bag,{width,height,theme,scale}));
 assert(info.modal,'Native modal must make the background inert');
 assert(info.rect.x>=-1&&info.rect.y>=-1&&info.rect.x+info.rect.width<=width+1&&info.rect.y+info.rect.height<=height+1);
 assert(info.targets.every(t=>t.width>=44&&t.height>=44),'All Bag buttons need 44px touch targets');
 for(const s of info.samples){assert(s.font>=13,'Bag copy must stay legible');const a=luminance(s.color),b=luminance(s.bg);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,'Bag text contrast');}
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');
 await bag.getByRole('button',{name:'Open EcoVibes ID'}).scrollIntoViewIfNeeded();
 await bag.getByRole('button',{name:'Close bag'}).focus();
 await page.keyboard.press('Shift+Tab');
 assert(await bag.getByRole('button',{name:'Open EcoVibes ID'}).evaluate(e=>document.activeElement===e),'Keyboard focus must wrap inside Bag');
 await page.keyboard.press('Tab');
 assert(await bag.getByRole('button',{name:'Close bag'}).evaluate(e=>document.activeElement===e),'Forward keyboard focus must wrap inside Bag');
 await page.keyboard.press('Escape');await bag.waitFor({state:'detached'});
 assert(await page.locator('.bag-button').evaluate(e=>document.activeElement===e),'Return keyboard focus to Bag opener');
}

// R5 checks empty/single/multiple states using real built DOM and disposable fixtures.
const r5Measurements=[];
const money=n=>new Intl.NumberFormat('en-GH',{style:'currency',currency:'GHS'}).format(n);
async function readSubtotal(bag){return bag.locator('.cart-summary>div').evaluate(row=>{
 const rect=r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom});
 const rangeText=el=>{const range=document.createRange();range.selectNodeContents(el);return [...range.getClientRects()].map(rect);};
 const drawer=row.closest('.cart-drawer');return {row:rect(row.getBoundingClientRect()),texts:[...row.children].map(el=>({text:el.textContent,rects:rangeText(el)})),scrollWidth:drawer.scrollWidth,clientWidth:drawer.clientWidth};
});}
function assertSubtotal(sample,expected){
 assert.equal(sample.texts[1].text,expected,'The complete actual subtotal must remain unchanged');
 assert(sample.texts.every(t=>t.rects.length&&t.rects.every(r=>r.left>=sample.row.left-.5&&r.right<=sample.row.right+.5)),'Subtotal text escapes its padded row: '+JSON.stringify(sample));
 assert(sample.scrollWidth<=sample.clientWidth+1,'Bag drawer must not acquire horizontal scrolling');
}
async function checkR5Layout(page,bag,config){
 const {width,height,theme,scale,state}=config;
 assertBadge(await measureBadge(bag,{width,theme,phase:'R5-'+state}));
 const copy=await bag.evaluate(d=>[...d.querySelectorAll('.empty-state h3,.empty-state p,.cart-item b,.cart-item small,.cart-item strong,.cart-summary>small,.cart-summary>p')].map(el=>{const s=getComputedStyle(el);return {text:el.textContent,font:parseFloat(s.fontSize),color:s.color,bg:getComputedStyle(el.closest('.cart-drawer')).backgroundColor};}));
 for(const c of copy){assert(c.font>=13*scale,'Bag copy must retain readable text scaling');const a=luminance(c.color),b=luminance(c.bg);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,'Small Bag text must meet4.5:1 contrast');}
 const actionName=state==='empty'?'Explore the marketplace':'Open EcoVibes ID';
 await bag.getByRole('button',{name:actionName,exact:true}).scrollIntoViewIfNeeded();
 const action=await measureAction(bag,{...config,actionName});assertAction(action);
 for(const button of await bag.locator('button').all()){
  await button.scrollIntoViewIfNeeded();const r=await button.boundingBox();assert(r&&r.width>=44&&r.height>=44,'Every Bag control needs a44px target');
  assert(r.x>=-.5&&r.x+r.width<=width+.5&&r.y>=-.5&&r.y+r.height<=height+.5,'Every control must be reachable by vertical scrolling');
 }
 const geometry=await bag.locator('.cart-drawer').evaluate(d=>({scroll:d.scrollWidth,client:d.clientWidth}));assert(geometry.scroll<=geometry.client+1,'Drawer horizontal overflow');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Document horizontal overflow');
 let subtotal;
 if(state!=='empty'){subtotal=await readSubtotal(bag);assertSubtotal(subtotal,money(state==='single'?170:540));}
 await bag.getByRole('button',{name:'Close bag'}).focus();await page.keyboard.press('Shift+Tab');assert(await bag.getByRole('button',{name:actionName,exact:true}).evaluate(e=>document.activeElement===e));
 await page.keyboard.press('Tab');assert(await bag.getByRole('button',{name:'Close bag'}).evaluate(e=>document.activeElement===e));
 r5Measurements.push({...config,copy,action,subtotal,geometry});
}
async function collectR5Regressions(){
 const errors=[];
 const capture=(label,fn)=>{try{fn();checks.push({label,passed:true});}catch(e){errors.push({label,message:e.message});}};
 for(const theme of ['light','dark']){
  const config={width:320,height:844,theme,scale:2};
  const empty=await setup({...config,cart:{}});
  try{await empty.page.goto(origin+'/#settings');await empty.page.getByRole('heading',{name:'Settings',exact:true}).waitFor();const bag=await openBag(empty.page,0);await setTextScale(empty.page,2);
   const copy=await bag.locator('.empty-state p').evaluate(el=>({font:parseFloat(getComputedStyle(el).fontSize),color:getComputedStyle(el).color,bg:getComputedStyle(el.closest('.cart-drawer')).backgroundColor}));
   await bag.getByRole('button',{name:'Explore the marketplace'}).scrollIntoViewIfNeeded();const action=await measureAction(bag,{...config,actionName:'Explore the marketplace'});
   capture('R5 empty '+theme,()=>{assert(copy.font>=28);const a=luminance(copy.color),b=luminance(copy.bg);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5);assertAction(action);});
   r5Measurements.push({phase:'regression-empty',...config,copy,action});await empty.page.screenshot({path:`${output}/R5-empty-${theme}-200pct.png`});
  }finally{await empty.context.close();}
  const multi=await setup({...config,cart:{x1:2,x2:1,x3:2,x4:1}});
  try{await multi.page.goto(origin+'/#settings');await multi.page.getByRole('heading',{name:'Settings',exact:true}).waitFor();await multi.page.locator('.bag-button').focus();await multi.page.keyboard.press('Enter');const bag=multi.page.getByRole('dialog');await setTextScale(multi.page,2);await bag.locator('.cart-summary').scrollIntoViewIfNeeded();const subtotal=await readSubtotal(bag);
   capture('R5 subtotal '+theme,()=>assertSubtotal(subtotal,money(540)));r5Measurements.push({phase:'regression-subtotal',...config,subtotal});await multi.page.screenshot({path:`${output}/R5-subtotal-${theme}-200pct.png`});
   const focus=[];
   for(const [remove,next] of [['Remove Coastline print set','Remove Everyday carry tote'],['Remove Hand-thrown cup','Remove Field notes · Vol. 01'],['Remove Everyday carry tote','Remove Field notes · Vol. 01'],['Remove Field notes · Vol. 01','Explore the marketplace']]){
    const control=bag.getByRole('button',{name:remove,exact:true});await control.focus();await multi.page.keyboard.press('Enter');const expected=bag.getByRole('button',{name:next,exact:true});await expected.waitFor();focus.push({remove,next,focused:await expected.evaluate(e=>document.activeElement===e)});
   }
   capture('R5 removal focus '+theme,()=>assert(focus.every(s=>s.focused),'Removal must choose next, preceding or empty action; never BODY'));r5Measurements.push({phase:'regression-focus',...config,focus});
   await multi.page.keyboard.press('Escape');await bag.waitFor({state:'detached'});assert(await multi.page.locator('.bag-button').evaluate(e=>document.activeElement===e));assert.deepEqual(multi.requests.filter(financial),[]);
  }finally{await multi.context.close();}
 }
 assert.deepEqual(errors,[],'R5 consolidated regressions: '+JSON.stringify(errors));
}
async function runR5Matrix(){
 const views=[{width:320,height:844},{width:390,height:844},{width:768,height:844},{width:1440,height:900},{width:390,height:320},{width:844,height:240}];
 for(const view of views)for(const theme of ['light','dark'])for(const scale of [1,1.5,2])for(const state of ['empty','single','multiple']){
  await checkCapacity('R5-'+state+'-'+view.width+'-'+theme+'-'+scale);
  const cart=state==='empty'?{}:state==='single'?{x1:2}:{x1:2,x2:1,x3:2,x4:1};const count=Object.values(cart).reduce((a,b)=>a+b,0);const f=await setup({...view,theme,cart});
  try{await f.page.goto(origin+'/#settings');await f.page.getByRole('heading',{name:'Settings',exact:true}).waitFor();await f.page.locator('.bag-button').focus();await f.page.keyboard.press('Enter');const bag=f.page.getByRole('dialog');await setTextScale(f.page,scale);await checkR5Layout(f.page,bag,{...view,theme,scale,state});
   await f.page.keyboard.press('Escape');await bag.waitFor({state:'detached'});assert(await f.page.locator('.bag-button').evaluate(e=>document.activeElement===e));await hasBasket(f.page,'ecovibes:v1',cart);assert.deepEqual(f.requests.filter(financial),[]);assert.deepEqual(f.errors,[]);
   checks.push({label:`R5-${state}-${view.width}x${view.height}-${theme}-${scale*100}pct`,passed:true,count,financialMutations:0});
  }finally{await f.context.close();}
 }
 for(const theme of ['light','dark']){
  const synthetic={id:'r5-large',name:'Synthetic layout fixture',seller:'Synthetic test',category:'Home',price:123456.78,color:'sage',icon:'◒'};const f=await setup({width:320,theme,cart:{'r5-large':2},sellerProducts:[synthetic]});
  try{await f.page.goto(origin+'/#settings');await f.page.getByRole('heading',{name:'Settings',exact:true}).waitFor();const bag=await openBag(f.page);await setTextScale(f.page,2);await bag.locator('.cart-summary').scrollIntoViewIfNeeded();const expected='GH₵246913.56';assertSubtotal(await readSubtotal(bag),expected);
   for(const displayOnly of ['GHS 246,913.56','US$ 12,345,678.90','CHF 123,456,789.01','GH₵9,876,543,210.99']){
    await bag.locator('.cart-summary>div b').evaluate((el,text)=>{el.textContent=text;},displayOnly);await f.page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const subtotal=await readSubtotal(bag);assertSubtotal(subtotal,displayOnly);r5Measurements.push({phase:'display-only synthetic currency stress; not a supported financial currency',theme,subtotal});
   }
   await f.page.reload();await f.page.getByRole('heading',{name:'Settings',exact:true}).waitFor();const restored=await openBag(f.page);assert.equal(await restored.locator('.cart-summary>div b').textContent(),expected);await hasBasket(f.page,'ecovibes:v1',{'r5-large':2});assert.deepEqual(f.requests.filter(financial),[]);assert.deepEqual(f.errors,[]);
   checks.push({label:'R5 large actual GHS subtotal and display-only currency stress '+theme,passed:true,expected,financialMutations:0});
  }finally{await f.context.close();}
 }
}

try{
 browser=await chromium.launch(process.platform==='darwin'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{});
 await collectR5Regressions();
 // Reproduce both reported action failures before asserting, retaining the original measurements/screenshots.
 const originalActions=[];
 for(const theme of ['light','dark']){
  const f=await setup({width:320,theme});
  try{
   await f.page.goto(origin+'/#settings');await f.page.getByRole('heading',{name:'Settings',exact:true}).waitFor();const bag=await openBag(f.page);
   await setTextScale(f.page,2);await bag.getByRole('button',{name:'Open EcoVibes ID'}).scrollIntoViewIfNeeded();
   originalActions.push(await measureAction(bag,{width:320,height:844,theme,scale:2}));
   await f.page.screenshot({path:output+'/action-'+theme+'-320-200pct.png'});
  }finally{await f.context.close();}
 }
 const actionErrors=[];
 for(const sample of originalActions){try{assertAction(sample);}catch(e){actionErrors.push(e.message);}}
 assert.deepEqual(actionErrors,[],'Bag action text-scaling regression');
 for(const sample of originalActions)checks.push({label:'action regression '+sample.theme+' 320px 200%',passed:true});
 // Collect all four original measurements before failing, preserving both appearance/viewport results.
 const originalSamples=[];
 for(const width of [320,1440])for(const theme of ['light','dark']){
  const f=await setup({width,theme});
  try{await f.page.goto(origin+'/#settings');await f.page.getByRole('heading',{name:'Settings',exact:true}).waitFor();const bag=await openBag(f.page);const sample=await measureBadge(bag,{width,theme,phase:'badge-audit'});originalSamples.push(sample);await f.page.screenshot({path:output+'/badge-'+theme+'-'+width+'.png'});}finally{await f.context.close();}
 }
 assert(originalSamples.every(s=>s.contrast>=4.5&&s.fontSize>=13),'Bag badge accessibility thresholds failed: '+JSON.stringify(originalSamples));
 for(const sample of originalSamples){assertBadge(sample);checks.push({label:'quantity badge '+sample.theme+' '+sample.width+'px',passed:true,measurement:sample});}
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

 // Text sizing is independent of viewport sizing; include short-screen and landscape scrolling.
 const textViewports=[... [320,390,768,1440].map(width=>({width,height:width===1440?900:844})),{width:390,height:320},{width:844,height:240}];
 for(const {width,height} of textViewports)for(const theme of ['light','dark'])for(const scale of [1,1.5,2]){
  const f=await setup({width,height,theme}),label=`action-${width}x${height}-${theme}-${scale*100}pct`;
  try{
   await f.page.goto(origin+'/#settings');await f.page.getByRole('heading',{name:'Settings',exact:true}).waitFor();const bag=await openBag(f.page);
   await setTextScale(f.page,scale);await bag.getByRole('button',{name:'Open EcoVibes ID'}).scrollIntoViewIfNeeded();
   await f.page.screenshot({path:`${output}/${label}.png`});
   await verifyLayout(f.page,bag,width,height);await hasBasket(f.page,'ecovibes:v1',{x1:2});
   assert.deepEqual(f.requests.filter(financial),[]);assert.deepEqual(f.errors,[]);
   checks.push({label,passed:true,financialMutations:0,layout:'Label/icon inside padded action; text size retained; badge contrast; scrolling, Tab/Shift+Tab, Escape and focus return'});
  }finally{await f.context.close();}
 }

 await runR5Matrix();
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
finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));try{await checkCapacity('after-browser');}catch(e){failures.push({name:e.name,message:e.message});}const report={passed:failures.length===0,checks,badgeMeasurements,actionMeasurements,r5Measurements,capacity,failures,scope:'Built desktop Chromium with synthetic identities and real browser offline mode. Not hosted, physical-device, genuine sign-in or durable checkout acceptance.'};await writeFile(`${output}/checks.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;}
function infoLabel(width,theme){return `${width}px/${theme}: native modal, keyboard wrap/Escape/focus return, 44px targets, >=13px copy, >=4.5 contrast, no horizontal overflow`;}
