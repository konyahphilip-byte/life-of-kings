import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createWebHandler} from '../server/web.mjs';
import {queryGames} from '../server/games.mjs';
const output=new URL('../work/ecogames-20261108/browser/',import.meta.url);
await mkdir(output,{recursive:true});
const serve=await createWebHandler(fileURLToPath(new URL('../dist',import.meta.url)));
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/v1/games'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(queryGames(url.searchParams)));return;}
 if(!await serve(req,res)){res.writeHead(503,{'Content-Type':'application/json'});res.end('{}');}
}catch{res.writeHead(500);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,checks=[];
let browser,failure;
try{
 browser=await chromium.launch(process.platform==='darwin'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{});
 for(const width of [320,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(()=>localStorage.setItem('ecovibes:v1',JSON.stringify({saver:'standard'})));
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/#gaming');await page.getByRole('heading',{name:'Word Sprint',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Horizontal overflow '+width);
  const art=page.locator('.ecogames-art');await art.evaluate(image=>image.decode());assert(await art.evaluate(image=>image.naturalWidth>0));
  assert.equal(await page.locator('.ecogames iframe,.ecogames canvas,.ecogames video').count(),0);
  const nav=page.getByRole('navigation',{name:'Games navigation'});
  await nav.getByRole('button',{name:'Saved projects',exact:true}).click();
  await page.getByRole('heading',{name:'Your next discovery starts here'}).waitFor();
  await page.getByRole('button',{name:'Explore projects',exact:true}).click();
  await page.getByRole('button',{name:'Save Word Sprint',exact:true}).click();
  await nav.getByRole('button',{name:'Saved projects',exact:true}).click();
  await page.getByRole('heading',{name:'Word Sprint',exact:true}).waitFor();
  await page.reload();await page.getByRole('heading',{name:'Word Sprint',exact:true}).waitFor();
  await nav.getByRole('button',{name:'Saved projects',exact:true}).click();
  assert.equal(await page.locator('.eg-project').count(),1);
  await page.getByRole('button',{name:'View project: Word Sprint',exact:true}).click();
  const detail=page.getByRole('region',{name:'Word Sprint details'});await detail.waitFor();
  assert(await detail.evaluate(element=>document.activeElement===element),'Details must receive keyboard focus');
  await detail.getByRole('button',{name:'Close details'}).click();
  assert(await page.getByRole('button',{name:'View project: Word Sprint'}).evaluate(element=>element===document.activeElement));
  await nav.getByRole('button',{name:'Discover',exact:true}).click();
  await page.getByRole('searchbox',{name:'Search game projects'}).fill('nothing here');
  await page.getByRole('heading',{name:'No matching projects'}).waitFor();
  await page.getByRole('button',{name:'Clear filters'}).click();
  await page.getByRole('button',{name:'Puzzle',exact:true}).click();
  assert.equal(await page.locator('.eg-project').count(),1);
  await page.getByRole('button',{name:'All',exact:true}).click();
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:fileURLToPath(new URL('hub-'+width+'.png',output))});
  await page.locator('.ecogames').screenshot({path:fileURLToPath(new URL('games-'+width+'.png',output))});
  await nav.getByRole('button',{name:'Creator guide'}).click();
  await page.getByRole('button',{name:'Open Chale AI',exact:true}).click();
  await page.getByRole('dialog',{name:'Chale AI',exact:true}).waitFor();
  await page.getByRole('button',{name:'Close Chale AI',exact:true}).click();
  assert.deepEqual(errors,[]);
  checks.push({width,passed:true,checks:'no overflow, decoded original artwork, navigation, save/reload, detail/focus return, filter/reset, existing Chale opens, no page errors'});
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await context.addInitScript(()=>localStorage.setItem('ecovibes:v1',JSON.stringify({saver:'extreme'})));
 let artRequests=0;const page=await context.newPage();page.on('request',r=>{if(r.url().endsWith('accra-skyway.svg'))artRequests++;});
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await page.goto(origin+'/#gaming');await page.getByRole('heading',{name:'Word Sprint',exact:true}).waitFor();
 assert.equal(artRequests,0);assert.equal(await page.locator('.ecogames-art').count(),0);
 await context.setOffline(true);await page.getByText(/You’re offline. Loaded project details/).waitFor();
 await page.getByRole('button',{name:'Save Word Sprint',exact:true}).click();
 await page.getByRole('button',{name:'Remove Word Sprint from saved',exact:true}).waitFor();
 checks.push({width:390,passed:true,checks:'Extreme saver no artwork request; offline loaded catalog and explicit device-local save work'});
 await context.close();
}catch(error){failure=error;console.error(error);}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));
 await writeFile(new URL('report.json',output),JSON.stringify({passed:!failure,checks,failure:failure?String(failure):null,scope:'built app, installed Chrome on macOS, synthetic API outage for unrelated modules; not hosted/device/controller acceptance'},null,2));
 if(failure)process.exitCode=1;else console.log(JSON.stringify({passed:true,checks}));}
