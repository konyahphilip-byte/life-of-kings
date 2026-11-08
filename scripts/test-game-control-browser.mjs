import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import {emptyWorkspace} from '../shared/game-control.mjs';
const output=new URL('../work/ecogames-control-20261108/browser/',import.meta.url);await mkdir(output,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'eco-control-browser-')),checks=[];
let server,browser,origin,logs='',failure;
try{
 server=spawn(process.execPath,['--import','./scripts/chale-test-provider.mjs','server/index.mjs'],{cwd:new URL('../',import.meta.url),env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',PORT:'0',ECOVIBES_DB_PATH:join(temp,'fixture.sqlite'),ECOVIBES_SERVE_WEB:'true',AI_PROVIDER_KEY:'synthetic-chale-http-fixture',OPENAI_ENV_FILE:'',DATABASE_URL:'',SUPABASE_URL:'',CHALE_SMOKE_CAPTURE:join(temp,'unused.jsonl')},stdio:['ignore','pipe','pipe','ipc']});
 server.on('message',m=>{if(m?.event==='chale-smoke-ready')origin='http://127.0.0.1:'+m.port;});server.stdout.on('data',v=>logs=(logs+v).slice(-2000));server.stderr.on('data',v=>logs=(logs+v).slice(-2000));
 const deadline=Date.now()+15000;while(!origin&&server.exitCode===null&&Date.now()<deadline)await delay(40);assert(origin,'Isolated API startup failed: '+logs);
 browser=await chromium.launch(process.platform==='darwin'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{});
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const register=await context.request.post(origin+'/api/v1/auth/register',{data:{ecoId:'control_browser_'+width,displayName:'Synthetic QA '+width,password:'Synthetic-Test-Only-2026!'}});assert.equal(register.status(),200);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/#gaming');await page.getByRole('navigation',{name:'Games navigation'}).getByRole('button',{name:'Control Hub',exact:true}).click();
  const hub=page.getByRole('region',{name:'Games Control Hub'});await hub.getByRole('button',{name:'Save record',exact:true}).waitFor();
  await hub.getByLabel('Title',{exact:true}).fill('Synthetic browser milestone '+width);await hub.getByLabel('Responsible owner').fill('QA fixture');
  await hub.getByRole('button',{name:'Save record',exact:true}).click();await hub.getByText('Workspace saved by the server.',{exact:true}).waitFor();
  await page.reload();await page.getByRole('navigation',{name:'Games navigation'}).getByRole('button',{name:'Control Hub',exact:true}).click();await hub.getByRole('heading',{name:'Synthetic browser milestone '+width}).waitFor();
  checks.push({width,check:'Actual browser and API save/reload durability',passed:true});
  await hub.getByLabel('Title',{exact:true}).fill('Interrupted draft '+width);
  await context.setOffline(true);await hub.getByRole('button',{name:'Save record',exact:true}).click();await hub.getByRole('alert').filter({hasText:'draft remains'}).waitFor();assert.equal(await hub.getByLabel('Title',{exact:true}).inputValue(),'Interrupted draft '+width);
  await context.setOffline(false);await hub.getByRole('button',{name:'Save record',exact:true}).click();await hub.getByText('Workspace saved by the server.',{exact:true}).waitFor();
  checks.push({width,check:'Offline save preserves draft; online retry gets server acknowledgement',passed:true});
  await hub.getByText('Bring in your separate Control Hub records',{exact:true}).click();
  const imported={...emptyWorkspace(),milestones:[{id:'legacy-browser-'+width,title:'Synthetic exported cloud record '+width,status:'Unknown'}]};
  await hub.getByLabel('Or paste exported JSON').fill(JSON.stringify(imported));await hub.getByRole('button',{name:'Preview import',exact:true}).click();
  assert(await hub.getByRole('button',{name:'Import to my workspace'}).isDisabled());await hub.getByRole('checkbox').check();await hub.getByRole('button',{name:'Import to my workspace'}).click();await hub.getByRole('heading',{name:'Synthetic exported cloud record '+width}).waitFor();
  checks.push({width,check:'Legacy export preview, separate consent and atomic server merge',passed:true});
  await hub.getByRole('button',{name:'Device matrix',exact:true}).click();assert.equal(await hub.getByRole('button',{name:'Untested',exact:true}).count(),60);await hub.getByLabel('Evidence project').selectOption('rumble-rush-2');assert.equal(await hub.getByRole('button',{name:'Untested',exact:true}).count(),60);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow at '+width);
  await hub.screenshot({path:fileURLToPath(new URL('matrix-'+width+'.png',output))});await hub.getByRole('button',{name:'Workspace',exact:true}).click();
  await hub.screenshot({path:fileURLToPath(new URL('workspace-'+width+'.png',output))});
  checks.push({width,check:'Separate Rumble projects, untested matrix and no page overflow',passed:true});
  const other=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});await other.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const registered=await other.request.post(origin+'/api/v1/auth/register',{data:{ecoId:'control_other_'+width,displayName:'Other synthetic QA',password:'Synthetic-Test-Only-2026!'}});assert.equal(registered.status(),200);
  const otherPage=await other.newPage();await otherPage.goto(origin+'/#gaming');await otherPage.getByRole('navigation',{name:'Games navigation'}).getByRole('button',{name:'Control Hub',exact:true}).click();
  const otherHub=otherPage.getByRole('region',{name:'Games Control Hub'});await otherHub.getByRole('button',{name:'Save record',exact:true}).waitFor();assert.equal(await otherHub.getByText('0 saved records',{exact:true}).count(),1);assert.equal(await otherHub.getByRole('heading',{name:'Synthetic browser milestone '+width}).count(),0);
  assert.deepEqual(errors,[]);checks.push({width,check:'Second actual local account sees an empty isolated workspace; no browser page errors',passed:true});
  await other.close();await context.close();
 }
}catch(e){failure=String(e);console.error(e);}
finally{
 await browser?.close();if(server&&server.exitCode===null){const closed=new Promise(r=>server.once('close',r));server.kill('SIGTERM');await closed;}
 await rm(temp,{recursive:true,force:true});await writeFile(new URL('report.json',output),JSON.stringify({passed:!failure,checks,failure,scope:'Built app in installed desktop Chrome at mobile/desktop viewports; actual local API and synthetic accounts. Not physical devices, hosted accounts or cloud-user-data migration.'},null,2));
 console.log(JSON.stringify({passed:!failure,checks,failure}));if(failure)process.exitCode=1;
}
