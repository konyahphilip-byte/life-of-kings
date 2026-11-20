import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,readdir,writeFile,statfs} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
import {createWebHandler} from '../server/web.mjs';

// Local production builds and disposable browser storage, never real accounts.
const output=process.env.BAG_RECOVERY_OUTPUT||`work/bag-recovery/run-${Date.now()}`;
await mkdir(output,{recursive:true});
for(const path of [output,tmpdir()]){const s=await statfs(path);assert(s.bavail*s.bsize>=2*1024**3,'Browser verification requires 2 GiB free');}
const normal=resolve('dist'),fallback=resolve(process.env.BAG_RECOVERY_FALLBACK_DIST||'work/bag-fallback-dist');
const serve={normal:await createWebHandler(normal),fallback:await createWebHandler(fallback)};
const hashes={};
async function hashTree(root){for(const entry of await readdir(root,{withFileTypes:true})){const path=join(root,entry.name);if(entry.isDirectory())await hashTree(path);else if(entry.isFile())hashes[path]=createHash('sha256').update(await readFile(path)).digest('hex');}}
for(const path of ['src/main.tsx','src/offline-shell.ts','src/modules/App.tsx','public/sw.js','scripts/test-bag-recovery-browser.mjs'])hashes[path]=createHash('sha256').update(await readFile(path)).digest('hex');
await hashTree(normal);await hashTree(fallback);
const A={id:'00000000-0000-4000-8000-000000000001',eco_id:'recovery.owner.a',display_name:'Synthetic recovery A',roles:['customer'],created_at:'2026-11-20T00:00:00Z'};
const B={...A,id:'00000000-0000-4000-8000-000000000002',eco_id:'recovery.owner.b',display_name:'Synthetic recovery B'};
const key=user=>user?`ecovibes:v1:account:${user.id}`:'ecovibes:v1';
const baskets={[key(null)]:{x1:1},[key(A)]:{x1:2},[key(B)]:{x2:3}};
let phase='normal',current=null;const mutations=[];
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://local').pathname;
 if(path.startsWith('/api/')){
  if(!['GET','HEAD'].includes(req.method))mutations.push({path,method:req.method});
  const body=path.endsWith('/auth/me')?{user:current,csrfToken:current?'synthetic-csrf':null}:path.endsWith('/ai/status')?{configured:false,paidFallback:false}:path.endsWith('/notifications/summary')?{ownerId:current?.id,items:[],unread:0,truncated:false}:['/api/v1/jobs','/api/v1/marketplace/products','/api/v1/marketplace/orders','/api/v1/notifications','/api/v1/trust/verifications'].includes(path)?[]:{};
  res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));return;
 }
 if(!await serve[phase](req,res)){res.writeHead(404);res.end();}
}catch{res.writeHead(500);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const checks=[],failures=[];let browser;
async function assertStorage(page,member){for(const [k,v] of Object.entries(baskets)){const actualKey=member&&k==='ecovibes:v1'?'ecovibes:v1:unassigned-backup':k;assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).cart,actualKey),v,'Recovery must preserve each separate basket and the existing unassigned backup');}}
async function identity(page,user){if(user)await page.waitForFunction(eco=>document.querySelector('.side-profile small')?.textContent==='@'+eco,user.eco_id);}
async function bag(page){await page.locator('.bag-button').click();const box=page.getByRole('dialog',{name:/Your bag/});await box.waitFor();assert.equal(await box.getByRole('button',{name:'Continue in sandbox',exact:true}).count(),0);assert.equal(await page.getByText(/Sandbox order created/).count(),0);return box;}
try{
 browser=await chromium.launch(process.platform==='darwin'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{});
 for(const user of [null,A,B])for(const theme of ['light','dark']){
  current=user;phase='normal';const label=`${user?.eco_id||'guest'}-${theme}`;
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow',reducedMotion:'reduce'});
  await context.addInitScript(({origin,baskets,theme})=>{if(location.origin!==origin||sessionStorage.getItem('recovery-seeded'))return;sessionStorage.setItem('recovery-seeded','1');for(const [k,cart] of Object.entries(baskets))localStorage.setItem(k,JSON.stringify({cart,theme}));},{origin,baskets,theme});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(origin+'/#settings');await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();await identity(page,user);
   await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
   await page.reload();await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();await identity(page,user);
   let box=await bag(page);await box.getByRole('button',{name:'Open EcoVibes ID',exact:true}).waitFor();await page.keyboard.press('Escape');await assertStorage(page,Boolean(user));
   phase='fallback';await page.reload();await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();await identity(page,user);box=await bag(page);
   assert.equal(await box.getByText('Your bag is temporarily unavailable. Your saved items are kept on this device. No order or payment was created.',{exact:true}).count(),1,'Emergency build must use its guard-preserving fallback');
   assert.equal(await box.locator('.cart-item').count(),0,'Fallback must not expose a previous account basket');
   await page.screenshot({path:output+'/'+label+'-fallback.png'});await assertStorage(page,Boolean(user));
   await box.getByRole('button',{name:'Open EcoVibes ID',exact:true}).click();
   await page.getByRole('heading',{name:'One account. Shared services.',exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),0,'Fallback account navigation must dismiss the drawer');
   if(!user&&theme==='light'){
    await page.goto(origin+'/#marketplace');await page.getByRole('heading',{name:'Good things, made by good people.',exact:true}).waitFor();
    await page.getByRole('button',{name:/^Your bag/}).click();box=page.getByRole('dialog',{name:/Your bag/});await box.waitFor();
    assert.equal(await box.getByText('Your bag is temporarily unavailable. Your saved items are kept on this device. No order or payment was created.',{exact:true}).count(),1,'Marketplace entry must use the same fallback');await page.keyboard.press('Escape');
   }
   await page.goto(origin+'/#settings');await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();box=await bag(page);

   if(user===A){
    current=B;await page.evaluate(()=>window.dispatchEvent(new Event('ecovibes:identity_changed')));await identity(page,B);if(!await page.getByRole('dialog',{name:/Your bag/}).count())box=await bag(page);
    assert.equal(await page.getByRole('dialog',{name:/Your bag/}).locator('.cart-item').count(),0);await assertStorage(page,Boolean(user));
    current=A;await page.evaluate(()=>window.dispatchEvent(new Event('ecovibes:identity_changed')));await identity(page,A);
   }
   await context.setOffline(true);await page.reload();await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();box=await bag(page);
   assert.equal(await box.getByText('Your bag is temporarily unavailable. Your saved items are kept on this device. No order or payment was created.',{exact:true}).count(),1,'Offline reload must keep the fallback');await assertStorage(page,Boolean(user));
   await context.setOffline(false);phase='normal';current=user;await page.reload();await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();await identity(page,user);box=await bag(page);
   assert.equal(await box.getByText('Your bag is temporarily unavailable. Your saved items are kept on this device. No order or payment was created.',{exact:true}).count(),0);await box.getByText('Qty '+(user===B?3:user===A?2:1),{exact:false}).waitFor();await assertStorage(page,Boolean(user));
   await page.screenshot({path:output+'/'+label+'-recovered.png'});
   await box.getByRole('button',{name:'Open EcoVibes ID',exact:true}).click();await page.getByRole('heading',{name:'One account. Shared services.',exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),0,'Restored normal account navigation must dismiss the drawer');
   assert.deepEqual(mutations.filter(r=>/checkout|orders|payments|refund|payout|transfers/.test(r.path)),[]);assert.deepEqual(errors,[]);
   checks.push({label,passed:true,stages:['normal','fallback','offline fallback','normal'],basketsPreserved:true,financialMutations:0});
  }catch(error){failures.push({label,message:error.message,stack:error.stack});await page.screenshot({path:output+'/'+label+'-failure.png'}).catch(()=>{});}
  finally{await context.close();}
 }
}finally{
 await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));
 await writeFile(output+'/checks.json',JSON.stringify({baseRevision:execFileSync('git',['rev-parse','HEAD']).toString().trim(),workingTree:execFileSync('git',['status','--short']).toString(),sourceHashes:hashes,passed:checks.length===6&&failures.length===0,checks,failures,scope:'Local desktop Chromium; actual normal/fallback production builds, worker/cache, synthetic accounts. No hosted/physical-device acceptance.'},null,2));
 console.log(JSON.stringify({checks,failures},null,2));if(failures.length||checks.length!==6)process.exitCode=1;
}
