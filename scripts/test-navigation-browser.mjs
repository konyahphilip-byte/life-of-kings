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
// Component-only captures hide unrelated fixed chrome; original whole-app captures remain.
const panelCaptureStyle='.topbar,.mobile-nav,.sidekick-launch{visibility:hidden!important}';
async function settleCapture(page){
 // Exercise existing below-fold lazy images, then finish finite entrance effects.
 const height=await page.evaluate(()=>document.documentElement.scrollHeight);
 for(let top=0;top<height;top+=700){await page.evaluate(y=>scrollTo(0,y),top);await page.waitForTimeout(60);}
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled([...document.images].map(img=>img.decode()));for(const animation of document.getAnimations()){if(animation.effect?.getTiming().iterations!==Infinity)try{animation.finish();}catch{}}scrollTo({top:0,behavior:'instant'});});
 await page.waitForTimeout(100);
}
async function verifyChaleHeader(page){
 const launcher=page.locator('.topbar .sidekick-launch');
 await launcher.waitFor();
 const geometry=await launcher.evaluate(element=>{
  const r=element.getBoundingClientRect(),h=element.closest('.topbar').getBoundingClientRect();
  const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  return {position:getComputedStyle(element).position,width:r.width,height:r.height,inHeader:r.left>=h.left&&r.right<=h.right&&r.top>=h.top&&r.bottom<=h.bottom,
   hitsOtherButton:[...element.closest('.topbar').querySelectorAll('button')].some(other=>other!==element&&overlap(r,other.getBoundingClientRect()))};
 });
 assert.equal(geometry.position,'static','Shortcut must occupy layout space, never float over page content');
 assert(geometry.width>=44&&geometry.height>=44,'Shortcut touch target');
 assert(geometry.inHeader&&!geometry.hitsOtherButton,'Header shortcut collides with other controls');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Shortcut causes horizontal overflow');
}
try{
 browser=await chromium.launch();
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'no-preference',serviceWorkers:'block'});
  await context.addInitScript(()=>{if(!localStorage.getItem('ecovibes:v1'))localStorage.setItem('ecovibes:v1',JSON.stringify({saver:'standard'}));});
  await context.routeWebSocket('**/*',socket=>socket.close());
  const page=await context.newPage(),errors=[];let happeningRequests=0;
  page.on('pageerror',()=>errors.push('page_error'));
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin!==origin)return route.abort();
   if(url.pathname==='/api/v1/discover/happening'){
    happeningRequests++;
    const date=new Date().toISOString(),expiresAt=new Date(Date.now()+599000).toISOString();
    return route.fulfill({contentType:'application/json',body:JSON.stringify({asOf:date,sections:[{id:'searches',source:'Google Trends',label:'Trending searches in Ghana',sourceUrl:'https://trends.google.com/trending?geo=GH',status:'available',checkedAt:date,updatedAt:date,expiresAt,copyright:'',items:[{title:'Accra’s weekend art markets',subtitle:'',url:'https://trends.google.com/trends/explore?geo=GH&q=topic',date}]},{id:'music',source:'Apple Music',label:'Apple Music Ghana Top Songs',sourceUrl:'https://rss.marketingtools.apple.com/api/v2/gh/music/most-played/10/songs.json',status:'available',checkedAt:date,updatedAt:date,expiresAt,copyright:'Copyright © 2026 Apple Inc. All rights reserved.',items:[{title:'A new sound for the weekend',subtitle:'Demo artist',url:'https://music.apple.com/gh/album/song/123?i=456',date}]}],news:[{id:'ghana-news',source:'Google Trends',label:'News behind Ghana’s searches',sourceUrl:'https://trends.google.com/trending?geo=GH',status:'available',checkedAt:date,updatedAt:date,expiresAt,items:[{title:'Young creators are turning old fabric into something new',url:'https://myjoyonline.com/synthetic-news',publisher:'MyJoyOnline',date,dateKind:'trend'}]},{id:'world-news',source:'UN Geneva',label:'UN world briefings',sourceUrl:'https://www.ungeneva.org/en/news-media/press-items-list/rss.xml',status:'available',checkedAt:date,updatedAt:date,expiresAt,items:[{title:'A closer look at the ideas shaping our cities',url:'https://www.ungeneva.org/en/news-media/press-briefing/2026/11/synthetic',publisher:'UN Geneva',date,dateKind:'published'}]}]})});
   }
   if(url.pathname.startsWith('/api/v1/'))return route.fulfill({status:url.pathname.endsWith('/auth/me')?200:503,contentType:'application/json',body:JSON.stringify(url.pathname.endsWith('/auth/me')?{user:null,csrfToken:null}:{error:{code:'synthetic_outage',message:'Service temporarily unavailable'}})});
   return route.continue();
  });
  for(const [hash,title] of [['home','Welcome to EcoVibes'],['messages','Messages'],['calls','Calls & Live'],['waste','Waste, put to better use.'],['settings','Settings']]){
   await page.goto(`${origin}/#${hash}`);
   await page.getByRole('heading',{name:title,exact:true}).waitFor();
   assert.equal(await page.locator('.screen-recovery[role="alert"]').count(),0);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${hash}: horizontal overflow at ${width}`);
   if(hash!=='settings')await verifyChaleHeader(page);
   if(hash==='home'){
    const posts=await page.locator('.post-card').evaluateAll(elements=>elements.filter(e=>e.querySelector('.post-art')).map(e=>{
     const text=e.querySelector('.post-text').getBoundingClientRect(),art=e.querySelector('.post-art').getBoundingClientRect(),actions=e.querySelector('.post-actions').getBoundingClientRect();
     return {textBottom:text.bottom,artTop:art.top,artBottom:art.bottom,actionsTop:actions.top,position:getComputedStyle(e.querySelector('.post-art')).position};
    }));
    assert(posts.length>=2&&posts.every(p=>p.position==='relative'&&p.textBottom<=p.artTop&&p.artBottom<=p.actionsTop),`Post artwork overlaps its text or actions: ${JSON.stringify(posts)}`);
    checks.push({width,check:'Post artwork stays between its own text and actions; Explore decoration cannot escape into the feed'});
   }
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
  await page.goto(`${origin}/#home`);
  await page.getByRole('link',{name:'A new sound for the weekend Demo artist',exact:true}).waitFor();
  await page.getByRole('link',{name:'Accra’s weekend art markets',exact:true}).waitFor();
  assert(!await page.getByText('2.4k conversations',{exact:true}).count());
  await settleCapture(page);
  await page.locator('.happening-card').screenshot({path:`${output}/happening-discovery-light-${width}.png`,style:panelCaptureStyle});
  await page.locator('.app').evaluate(element=>element.classList.add('theme-dark'));
  const colors=await page.locator('.happening-status').evaluate(element=>({text:getComputedStyle(element).color,bg:getComputedStyle(element.closest('.happening-card')).backgroundColor}));
  const luminance=value=>{const rgb=value.match(/[0-9.]+/g).slice(0,3).map(Number).map(n=>{const v=n/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
  const a=luminance(colors.text),b=luminance(colors.bg);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,'Feed status contrast');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await settleCapture(page);
  await page.locator('.happening-card').screenshot({path:`${output}/happening-${width}.png`});
  await page.locator('.happening-card').screenshot({path:`${output}/happening-component-${width}.png`,style:panelCaptureStyle});
  checks.push({width,check:'Automatic attributable trends/music/news render with no fabricated counts, dark-theme contrast and no overflow'});
  const beforeFilter=happeningRequests;
  await page.getByRole('button',{name:'News',exact:true}).click();
  await page.getByRole('link',{name:'Young creators are turning old fabric into something new',exact:true}).waitFor();
  await page.getByRole('link',{name:'A closer look at the ideas shaping our cities',exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Accra’s weekend art markets',exact:true}).count(),0);
  assert.equal(await page.getByRole('link',{name:'Young creators are turning old fabric into something new',exact:true}).getAttribute('href'),'https://myjoyonline.com/synthetic-news');
  assert.equal(happeningRequests,beforeFilter);
  await page.locator('.happening-card').screenshot({path:`${output}/happening-news-${width}.png`});
  await page.locator('.happening-card').screenshot({path:`${output}/happening-news-component-${width}.png`,style:panelCaptureStyle});
  checks.push({width,check:'News filters locally, with publisher links and distinct trend/publication dates'});
  await context.setOffline(true);await page.getByRole('status').filter({hasText:'You’re offline'}).waitFor();
  await context.setOffline(false);await page.getByRole('status').filter({hasText:'Updates automatically'}).waitFor();
  await page.getByRole('button',{name:'The mix',exact:true}).click();
  checks.push({width,check:'Offline status and online recovery retain source data without manual reload'});
  await page.locator('.happening-card h3').evaluate(element=>element.scrollIntoView({block:'center'}));
  const clearFeed=await page.evaluate(()=>{
   const a=document.querySelector('.sidekick-launch').getBoundingClientRect(),b=document.querySelector('.happening-card h3').getBoundingClientRect();
   return a.bottom<=b.top||a.top>=b.bottom||a.right<=b.left||a.left>=b.right;
  });
  assert(clearFeed,'Chale shortcut covers the Happening now heading');
  await page.screenshot({path:`${output}/chale-header-feed-${width}.png`,fullPage:false});
  checks.push({width,check:'Header shortcut keeps the visible feed heading and header controls unobstructed'});
  await page.goto(`${origin}/#settings`);
  await page.getByLabel('Chale shortcut').selectOption('labelled');
  await page.goto(`${origin}/#home`);await verifyChaleHeader(page);
  if(width===390){
   await page.setViewportSize({width:320,height:844});await verifyChaleHeader(page);
   await page.screenshot({path:`${output}/chale-header-320.png`,fullPage:false});
   checks.push({width:320,check:'Label preference remains compact on a small phone without covering header controls'});
   await page.setViewportSize({width,height:900});
  }
  await page.goto(`${origin}/#settings`);
  await page.getByLabel('Chale shortcut').selectOption('hidden');
  assert.equal(await page.locator('.sidekick-launch:visible').count(),0);
  const restore=page.getByRole('button',{name:'Open Chale AI',exact:true});
  await restore.click();await page.getByRole('dialog',{name:'Chale AI'}).waitFor();
  assert.equal(await page.locator('.topbar [role="dialog"]').count(),0,'Chat must not be clipped by its header host');
  await page.getByRole('button',{name:'Close Chale AI',exact:true}).click();
  assert(await restore.evaluate(element=>document.activeElement===element),'Return focus to Settings opener');
  await page.getByLabel('Chale shortcut').selectOption('compact');
  checks.push({width,check:'Hidden shortcut reopens from Settings; panel stays outside header and returns focus'});
  if(width===390){
   await page.setViewportSize({width:844,height:180});
   await restore.click();
   const panel=page.getByRole('dialog',{name:'Chale AI'});
   const box=await panel.boundingBox();assert(box&&box.y>=0&&box.y+box.height<=180,`Short-screen chat exceeds viewport: ${JSON.stringify(box)}`);
   const thread=page.getByRole('log',{name:'Conversation with Chale AI'});await thread.focus();await thread.press('End');
   await page.getByRole('textbox',{name:'Ask Chale AI'}).scrollIntoViewIfNeeded();
   await page.getByRole('button',{name:'Close Chale AI',exact:true}).click();
   checks.push({width:844,height:180,check:'Short-screen chat can reach its input and close without being clipped'});
   await page.setViewportSize({width,height:900});
  }
  await page.goto(`${origin}/#home`);await verifyChaleHeader(page);
  if(width===390){const buttons=page.locator('.mobile-nav button');assert.deepEqual(await buttons.allTextContents(),['Home','Explore','Messages','Create','Calls & Live','Profile','EcoVibes ID']);const box=await buttons.nth(3).boundingBox();assert(box&&Math.abs(box.x+box.width/2-width/2)<2);checks.push({width,check:'Create is fourth and visually centred among seven mobile destinations'});}
  await page.goto(`${origin}/#account`);
  await page.getByLabel('What would you like to try first? (optional)').waitFor();
  assert.equal(await page.getByLabel('What would you like to try first? (optional)').getAttribute('required'),null);
  await page.getByLabel('What would you like to try first? (optional)').selectOption('none');
  checks.push({width,check:'Signup offers an optional personal/None purpose without business activation'});
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
