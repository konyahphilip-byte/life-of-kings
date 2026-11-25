import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile,statfs} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
import {createWebHandler} from '../server/web.mjs';

// Actual old and candidate builds, one origin, real browser worker/cache, synthetic API only.
const baseline='56e0c2ebf83dfc2c89fccd0bc552691e4ae42b9b';
const output=process.env.BAG_UPGRADE_OUTPUT||`work/bag-upgrade/run-${Date.now()}`;
await mkdir(output,{recursive:true});
const sourceHashes={};for(const file of ['src/main.tsx','src/offline-shell.ts','src/modules/App.tsx','public/sw.js','scripts/test-bag-upgrade-browser.mjs','dist/index.html','dist/sw.js'])sourceHashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
const {readdir}=await import('node:fs/promises');for(const name of await readdir('dist/assets')){const file=join('dist/assets',name);sourceHashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');}
for(const path of [output,tmpdir()]){const s=await statfs(path);assert(s.bavail*s.bsize>=2*1024**3,'Browser verification requires 2 GiB free');}
let legacy=process.env.BAG_UPGRADE_LEGACY_DIST;
if(!legacy){
 const source=resolve(output,'legacy-source');await mkdir(source);
 const archive=execFileSync('git',['archive',baseline,'src','shared','index.html','vite.config.ts','package.json','public/sw.js','public/manifest.webmanifest','public/favicon.svg'],{maxBuffer:20*1024**2});
 execFileSync('tar',['-x','-C',source],{input:archive});
 const {symlink}=await import('node:fs/promises');await symlink(resolve('node_modules'),source+'/node_modules','dir');
 const build=execFileSync(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'build'],{cwd:source,maxBuffer:4*1024**2});await writeFile(output+'/legacy-build.log',build);
 legacy=source+'/dist';
}
const legacyWorker=await readFile(resolve(legacy,'sw.js'));
assert.equal(legacyWorker.toString(),execFileSync('git',['show',baseline+':public/sw.js']).toString(),'Baseline worker must match the deployed revision');
const serveLegacy=await createWebHandler(legacy),serveCandidate=await createWebHandler(resolve('dist'));
const owner={id:'00000000-0000-4000-8000-000000000001',eco_id:'upgrade.owner',display_name:'Synthetic upgrade owner',roles:['customer'],created_at:'2026-11-17T00:00:00Z'};
let phase='legacy',signedIn=false;const mutations=[];
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://local').pathname;
  if(path.startsWith('/api/')){
   if(req.method!=='GET')mutations.push({path,method:req.method});
   const data=path.endsWith('/auth/me')?{user:signedIn?owner:null,csrfToken:signedIn?'synthetic-csrf':null}:path.endsWith('/ai/status')?{configured:false,paidFallback:false}:path.endsWith('/notifications/summary')?{ownerId:owner.id,items:[],unread:0,truncated:false}:['/api/v1/jobs','/api/v1/marketplace/products','/api/v1/marketplace/orders','/api/v1/notifications','/api/v1/trust/verifications'].includes(path)?[]:{};
   res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));return;
  }
  if(path==='/sw.js'&&phase!=='ready'){res.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'});res.end(legacyWorker);return;}
  if(!await (phase==='legacy'?serveLegacy:serveCandidate)(req,res)){res.writeHead(404);res.end();}
 }catch{res.writeHead(500);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const checks=[],failures=[];let browser;
try{
 browser=await chromium.launch(process.platform==='darwin'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{});
 for(const member of [false,true])for(const updateReady of [false,true]){
  signedIn=member;phase='legacy';
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow',reducedMotion:'reduce'});
  const key=member?`ecovibes:v1:account:${owner.id}`:'ecovibes:v1';
  await context.addInitScript(({key,origin})=>{if(location.origin===origin&&!sessionStorage.getItem('upgrade-seeded')){localStorage.setItem(key,JSON.stringify({cart:{x1:2}}));sessionStorage.setItem('upgrade-seeded','1');}},{key,origin});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage(),label=`${member?'member':'guest'}-${updateReady?'worker-updated':'worker-delayed'}`;
  try{
   await page.goto(origin+'/#settings');await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();
   await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
   await page.reload();await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();
   await page.locator('.bag-button').click();await page.getByRole('button',{name:'Continue in sandbox',exact:true}).waitFor();
   await page.keyboard.press('Escape'); // Old drawer is not native; reload closes it below.
   await page.waitForFunction(async()=>{const c=await caches.open('ecovibes-shell-v2'),root=await c.match('/'),keys=await c.keys();return Boolean(root)&&keys.some(r=>r.url.endsWith('.js'))&&keys.some(r=>r.url.endsWith('.css'));});
   phase=updateReady?'ready':'pending';console.log('Upgrading '+label);await page.reload();await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();
   await page.locator('.bag-button').click();await page.getByRole('button',{name:'Open EcoVibes ID',exact:true}).waitFor();
   await page.keyboard.press('Escape');
   if(updateReady){await page.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>r.update()));await page.waitForFunction(async()=>{const keys=await caches.keys();return keys.includes('ecovibes-shell-v3')&&!keys.includes('ecovibes-shell-v2');});await page.reload();await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();await page.waitForFunction(async()=>{const c=await caches.open('ecovibes-shell-v3');const keys=await c.keys();return keys.some(r=>r.url.endsWith('.js'))&&keys.some(r=>r.url.endsWith('.css'));});}
   const beforeOffline=await page.evaluate(async()=>{const keys=await caches.keys();return {keys,unsafeRootPresent:keys.includes('ecovibes-shell-v2')&&Boolean(await caches.open('ecovibes-shell-v2').then(c=>c.match('/')))};});assert.equal(beforeOffline.unsafeRootPresent,false,'Old install-time document must be retired even before new worker activation');console.log(JSON.stringify({label,beforeOffline}));
   await context.setOffline(true);
   let offline='safe app';
   try{await page.reload({waitUntil:'domcontentloaded'});}catch(error){assert.match(error.message,/ERR_FAILED|ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED/);assert(!updateReady,'Updated worker must retain a safe offline shell');offline='document unavailable until reconnect';}
   if(offline==='safe app'){await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();await page.locator('.bag-button').click();assert.equal(await page.getByRole('dialog',{name:/Your bag/}).count(),1,'Offline Bag must be the safe native dialog even when identity is unavailable');assert.equal(await page.getByRole('button',{name:'Continue in sandbox',exact:true}).count(),0,'Old false-checkout application returned offline');if(member)await page.getByText('Your bag is taking a breather',{exact:true}).waitFor();else await page.getByRole('button',{name:'Open EcoVibes ID',exact:true}).waitFor();}
   if(updateReady)assert(beforeOffline.keys.includes('ecovibes-shell-v3')&&!beforeOffline.keys.includes('ecovibes-shell-v2'),'Updated worker must retire v2 before offline acceptance');
   if(updateReady){if(member)await page.getByText('Your bag is taking a breather',{exact:true}).waitFor();else await page.getByRole('button',{name:'Open EcoVibes ID',exact:true}).waitFor();await page.screenshot({path:output+'/'+label+'.png'});}
   await context.setOffline(false);await page.goto(origin+'/#settings');await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();
   assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).cart,key),{x1:2});
   assert.deepEqual(mutations.filter(r=>/checkout|orders|payments|refund|payout|transfers/.test(r.path)),[]);
   checks.push({label,passed:true,offline,basketPreserved:true,financialMutations:0});
  }catch(error){failures.push({label,message:error.message,stack:error.stack});await page.screenshot({path:output+'/'+label+'-failure.png'}).catch(()=>{});}
  finally{await context.close();}
 }
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));await writeFile(output+'/checks.json',JSON.stringify({baseline,baseRevision:execFileSync('git',['rev-parse','HEAD']).toString().trim(),workingTree:execFileSync('git',['status','--short']).toString(),sourceHashes,passed:checks.length===4&&failures.length===0,checks,failures,scope:'Local desktop Chromium, real two-build same-origin worker upgrade, synthetic identities. No hosted or physical-device acceptance.'},null,2));console.log(JSON.stringify({checks,failures},null,2));if(failures.length||checks.length!==4)process.exitCode=1;}
