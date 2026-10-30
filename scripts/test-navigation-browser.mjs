import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createWebHandler} from '../server/web.mjs';

// Built app, disposable guest browser, synthetic API outage. No .env or provider access.
const output='artifacts/navigation';
await mkdir(output,{recursive:true});
const serve=await createWebHandler(new URL('../dist',import.meta.url).pathname);
const server=createServer(async(req,res)=>{try{if(!await serve(req,res)){res.writeHead(503,{'Content-Type':'application/json'});res.end('{}');}}catch{res.writeHead(500);res.end();}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin=`http://127.0.0.1:${server.address().port}`;
let browser,failure;
const checks=[];
async function settleCapture(page){
 // Exercise existing below-fold lazy images, then finish finite entrance effects.
 const height=await page.evaluate(()=>document.documentElement.scrollHeight);
 for(let top=0;top<height;top+=700){await page.evaluate(y=>scrollTo(0,y),top);await page.waitForTimeout(60);}
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled([...document.images].map(img=>img.decode()));for(const animation of document.getAnimations()){if(animation.effect?.getTiming().iterations!==Infinity)try{animation.finish();}catch{}}scrollTo({top:0,behavior:'instant'});});
 await page.waitForTimeout(100);
}
try{
 browser=await chromium.launch();
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'no-preference',serviceWorkers:'block'});
  await context.addInitScript(()=>{if(!localStorage.getItem('ecovibes:v1'))localStorage.setItem('ecovibes:v1',JSON.stringify({saver:'standard'}));});
  await context.routeWebSocket('**/*',socket=>socket.close());
  const page=await context.newPage(),errors=[];
  page.on('pageerror',()=>errors.push('page_error'));
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin!==origin)return route.abort();
   if(url.pathname.startsWith('/api/v1/'))return route.fulfill({status:url.pathname.endsWith('/auth/me')?200:503,contentType:'application/json',body:JSON.stringify(url.pathname.endsWith('/auth/me')?{user:null,csrfToken:null}:{error:{code:'synthetic_outage',message:'Service temporarily unavailable'}})});
   return route.continue();
  });
  for(const [hash,title] of [['home','Welcome to EcoVibes'],['messages','Messages'],['calls','Calls & Live'],['waste','Waste, put to better use.'],['settings','Settings']]){
   await page.goto(`${origin}/#${hash}`);
   await page.getByRole('heading',{name:title,exact:true}).waitFor();
   assert.equal(await page.locator('.screen-recovery[role="alert"]').count(),0);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${hash}: horizontal overflow at ${width}`);
   if(hash==='home'||hash==='waste'){
    await page.locator('[data-depth="3d"]').waitFor();
    await settleCapture(page);
    await page.screenshot({path:`${output}/${hash}-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Use 2D view'}).click();
    assert.equal(await page.locator('[data-depth="3d"]').count(),0);
    await page.locator('[data-depth="2d"]').waitFor();
    if(width===390)await page.screenshot({path:`${output}/${hash}-flat-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Use 3D view'}).click();
    checks.push({width,check:`${hash}: CSS 3D and user-selected flat view both render`});
   }
   checks.push({width,check:`${hash}: real page renders during synthetic API outage`});
  }
  await page.goto(`${origin}/#create`);
  await page.getByRole('button',{name:/Write a post/}).click();
  await page.getByRole('heading',{name:'Share a moment'}).waitFor();
  await page.getByPlaceholder('What’s on your mind?').fill('Synthetic navigation draft');
  await page.getByRole('button',{name:'Close',exact:true}).click();
  assert.equal(new URL(page.url()).hash,'#create');
  await page.getByRole('button',{name:/Write a post/}).click();
  assert.equal(await page.getByPlaceholder('What’s on your mind?').inputValue(),'Synthetic navigation draft');
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ecovibes:navigate',{detail:'Messages'})));
  await page.getByRole('heading',{name:'Messages',exact:true}).waitFor();
  await page.goBack();
  await page.getByRole('heading',{name:'Create',exact:true}).waitFor();
  checks.push({width,check:'Create options remain, composer retains draft, browser Back restores Create'});
  await page.goto(`${origin}/#unsupported-destination`);
  await page.getByRole('heading',{name:'This destination is not available'}).waitFor();
  await page.getByRole('button',{name:'Back to Home'}).click();
  await page.getByRole('heading',{name:'Welcome to EcoVibes',exact:true}).waitFor();
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ecovibes:navigate',{detail:{private:'synthetic'}})));
  await page.getByRole('heading',{name:'This destination is not available'}).waitFor();
  assert(!(await page.locator('main').innerText()).includes('synthetic'));
  assert.deepEqual(errors,[]);
  checks.push({width,check:'Unsupported URL and invalid event recover without render crash or payload echo'});
  await context.close();
  const flat=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await flat.route('**/*',route=>new URL(route.request().url()).origin===origin&&!route.request().url().includes('/api/')?route.continue():route.abort());
  const flatPage=await flat.newPage();await flatPage.goto(`${origin}/#waste`);await flatPage.locator('[data-depth="2d"]').waitFor();assert.equal(await flatPage.locator('[data-depth="3d"]').count(),0);
  await flatPage.getByRole('button',{name:/Request a collection/}).click();await flatPage.getByRole('heading',{name:'One account. Shared services.'}).waitFor();
  checks.push({width,check:'Reduced-motion/default Data Saver flat view retains collection sign-in action'});
  await flat.close();
 }
}catch(error){failure={name:error.name,message:error.message};}
finally{
 try{await browser?.close();}catch{failure??={name:'CleanupError',message:'Browser did not close normally'};}
 finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 const report={passed:!failure,checks,failure,scope:'Real Linux Chromium built UI at desktop/narrow widths; guest/synthetic API outage only. No hosted, physical phone, role or provider acceptance.'};
 await writeFile(`${output}/checks.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));if(failure)process.exitCode=1;
}
