import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createWebHandler} from '../server/web.mjs';

// Built UI and synthetic replies only; no provider, account or media permission.
const output='artifacts/navigation';
await mkdir(output,{recursive:true});
const serve=await createWebHandler(new URL('../dist',import.meta.url).pathname);
const server=createServer(async(req,res)=>{try{if(!await serve(req,res)){res.writeHead(503);res.end('{}');}}catch{res.writeHead(500);res.end();}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin='http://127.0.0.1:'+server.address().port,checks=[];
let browser,failure;
try{
 browser=await chromium.launch();
 for(const [width,height] of [[390,844],[320,740],[1280,900]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(()=>localStorage.setItem('ecovibes:chale-ui:v1',JSON.stringify({launcher:'compact',edge:'right',showCharacter:false})));
  await context.routeWebSocket('**/*',socket=>socket.close());
  let replies=0,releaseReply,unexpectedWrites=0;
  let ready;const replyReady=new Promise(resolve=>{ready=resolve;});
  await context.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!==origin)return route.abort();
   if(url.pathname==='/api/v1/ai/status')return route.fulfill({contentType:'application/json',body:JSON.stringify({configured:true,dailyRequests:40,guestDailyRequests:40})});
   if(url.pathname==='/api/v1/ai/chat'){
    const number=++replies;
    const reply=()=>route.fulfill({contentType:'application/json',body:JSON.stringify({text:'Reply '+number+': Choose a small goal, make time for it and check your progress. Start with what you already have, and adjust the plan as you learn.',source:'model',items:[],guides:[],drafts:[]})});
    if(number===4){releaseReply=reply;ready();return;}
    return reply();
   }
   if(url.pathname.startsWith('/api/v1/')){
    if(!['GET','HEAD'].includes(request.method()))unexpectedWrites++;
    return route.fulfill({status:url.pathname.endsWith('/auth/me')?200:503,contentType:'application/json',body:JSON.stringify(url.pathname.endsWith('/auth/me')?{user:null,csrfToken:null}:{error:{message:'Synthetic outage'}})});
   }
   return route.continue();
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',()=>errors.push('page_error'));
  await page.goto(origin+'/#home');
  await page.getByRole('button',{name:'Ask Chale AI',exact:true}).click();
  const panel=page.getByRole('dialog',{name:'Chale AI'}),thread=page.getByRole('log',{name:'Conversation with Chale AI'}),input=page.getByRole('textbox',{name:'Ask Chale AI'});
  await panel.waitFor();
  if(width<=780)assert.equal(await page.locator('.mobile-nav').isVisible(),false,'Mobile app navigation stays out of the conversation');
  const geometry=await panel.evaluate(element=>{
   const panel=element.getBoundingClientRect(),thread=element.querySelector('.sidekick-thread').getBoundingClientRect(),head=element.querySelector('.sidekick-head').getBoundingClientRect();
   return {panelHeight:panel.height,threadHeight:thread.height,headHeight:head.height,panelScroll:element.scrollHeight,panelClient:element.clientHeight,overflow:getComputedStyle(element).overflowY};
  });
  assert(geometry.threadHeight/geometry.panelHeight>=.7,'Conversation must own at least70% of the ordinary panel: '+JSON.stringify(geometry));
  assert(geometry.headHeight<=60&&geometry.overflow==='hidden','Compact fixed chrome with independent conversation scrolling');
  assert.equal(await page.locator('.sidekick-context').count(),0);
  assert.equal(await page.getByRole('region',{name:'About replies & learning'}).count(),0);
  checks.push({width,height,check:'At least70% of chat belongs to messages, with no character banner or expanded disclosure by default',geometry});
  for(let i=1;i<=3;i++){
   await input.fill('Help me plan a simple week '+i);
   await page.getByRole('button',{name:'Send question'}).click();
   await page.getByText('Reply '+i+':',{exact:false}).waitFor();
  }
  await input.fill('Help me plan a simple week4');
  await page.getByRole('button',{name:'Send question'}).click();
  let timer;try{await Promise.race([replyReady,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Reply fixture not reached')),10000);})]);}finally{clearTimeout(timer);}
  await thread.evaluate(element=>{element.scrollTop=0;element.dispatchEvent(new Event('scroll',{bubbles:true}));});
  await releaseReply();
  await page.getByText('Reply 4:',{exact:false}).waitFor();
  await page.evaluate(()=>new Promise(requestAnimationFrame));
  assert(await thread.evaluate(element=>element.scrollTop<2),'Incoming reply must not jump away from older messages');
  assert(await thread.evaluate(element=>element.scrollHeight>element.clientHeight),'Real long history scrolls inside its own thread');
  const before=await thread.boundingBox();
  await input.fill('Keep this unfinished question');
  const info=page.getByRole('button',{name:'About replies & learning',exact:true});
  await info.click();
  const sheet=page.getByRole('region',{name:'About replies & learning'});
  await sheet.waitFor();
  assert(await sheet.evaluate(element=>document.activeElement===element),'Information receives keyboard focus');
  assert(await sheet.innerText().then(text=>text.includes('40 requests per day')),'Allowance and processing disclosure remain available');
  const after=await page.locator('.sidekick-thread').boundingBox();
  assert.equal(after.height,before.height,'Information must not squeeze the conversation');
  await page.screenshot({path:output+'/chale-info-'+width+'.png'});
  await page.getByRole('button',{name:'Back to conversation'}).click();
  assert.equal(await input.inputValue(),'Keep this unfinished question');
  assert(await info.evaluate(element=>document.activeElement===element),'Back restores information-button focus');
  assert(await thread.evaluate(element=>element.scrollTop<2),'Information preserves history position');
  await input.fill('');
  await thread.evaluate(element=>{element.scrollTop=element.scrollHeight;});
  await page.screenshot({path:output+'/chale-conversation-'+width+'.png'});
  assert(await input.evaluate(element=>Number.parseFloat(getComputedStyle(element).fontSize)>=16),'Readable input avoids mobile focus zoom');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow');
  checks.push({width,height,check:'Four real rendered reply turns, stable earlier-history position, optional focused information, retained draft, readable composer and character-off chat'});
  await info.click();await page.keyboard.press('Escape');
  await panel.waitFor();assert.equal(await sheet.count(),0);
  await page.keyboard.press('Escape');assert.equal(await panel.count(),0);
  if(width<=780)assert.equal(await page.locator('.mobile-nav').isVisible(),true,'Closing chat restores mobile navigation');
  checks.push({width,height,check:'Escape dismisses details before closing chat'});
  if(width===390){
   await page.setViewportSize({width:844,height:180});
   await page.getByRole('button',{name:'Ask Chale AI',exact:true}).click();
   const box=await panel.boundingBox(),threadBox=await thread.boundingBox(),inputBox=await input.boundingBox();
   assert(box&&box.y>=0&&box.y+box.height<=180,'Short viewport contains panel');
   assert(threadBox&&threadBox.height>=40&&inputBox&&inputBox.y>=box.y&&inputBox.y+inputBox.height<=box.y+box.height,'History and composer remain reachable in short viewport');
   await page.screenshot({path:output+'/chale-conversation-short.png'});
   await page.getByRole('button',{name:'Close Chale AI',exact:true}).click();
   checks.push({width:844,height:180,check:'Short keyboard-like viewport retains visible history, input and44px close control'});
  }
  assert.equal(unexpectedWrites,0,'Layout and information cannot perform other mutations');
  assert.deepEqual(errors,[]);
  await context.close();
 }
}catch(error){failure={name:error.name,message:error.message};}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
const result={passed:!failure,checks,failure:failure||null,scope:'Actual built Chromium UI, synthetic replies and guest/API fixtures. Not hosted, physical phone, real keyboard, private account or model acceptance.'};
await writeFile(output+'/chale-conversation-checks.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));if(failure)process.exitCode=1;

