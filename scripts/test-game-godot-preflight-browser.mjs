import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import {emptyVault} from '../shared/game-vault.mjs';
import {godotInspectionFixture} from './test-game-godot-preflight.mjs';
const output=new URL('../work/ecogames-godot-preflight-20261109/browser/',import.meta.url);await mkdir(output,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'eco-godot-inspector-browser-')),checks=[];let server,browser,origin,logs='',failure,diagnosticPage;
const check=(value,name,width)=>{assert(value,name);checks.push({width,check:name,passed:true});};
try{
 server=spawn(process.execPath,['--import','./scripts/chale-test-provider.mjs','server/index.mjs'],{cwd:new URL('../',import.meta.url),env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',PORT:'0',ECOVIBES_DB_PATH:join(temp,'fixture.sqlite'),ECOVIBES_SERVE_WEB:'true',AI_PROVIDER_KEY:'synthetic-chale-http-fixture',OPENAI_ENV_FILE:'',DATABASE_URL:'',SUPABASE_URL:'',CHALE_SMOKE_CAPTURE:join(temp,'unused.jsonl')},stdio:['ignore','pipe','pipe','ipc']});
 server.on('message',m=>{if(m?.event==='chale-smoke-ready')origin='http://127.0.0.1:'+m.port;});server.stdout.on('data',v=>logs=(logs+v).slice(-3000));server.stderr.on('data',v=>logs=(logs+v).slice(-3000));
 const deadline=Date.now()+15000;while(!origin&&server.exitCode===null&&Date.now()<deadline)await delay(40);assert(origin,'Local API startup failed: '+logs);
 browser=await chromium.launch(process.platform==='darwin'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{});
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const registered=await context.request.post(origin+'/api/v1/auth/register',{data:{ecoId:'godot_inspect_'+width,displayName:'Synthetic Godot QA '+width,password:'Synthetic-Test-Only-2026!'}});assert.equal(registered.status(),200);const account=await registered.json(),project=godotInspectionFixture();
  const save=await context.request.put(origin+'/api/v1/games/vault',{headers:{'X-CSRF-Token':account.csrfToken},data:{expectedOwnerId:account.user.id,revision:0,operationId:randomUUID(),consent:'private-storage-v1',vault:{...emptyVault(),projects:[project]}}});assert.equal(save.status(),200);
  const page=await context.newPage();diagnosticPage=page;let writes=0,ai=0;const errors=[],mutations=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(['POST','PUT','PATCH','DELETE'].includes(r.method())){const path=new URL(r.url()).pathname;if(path==='/api/v1/people/presence'){assert.equal(r.postData(),'{}','Presence must never contain source');}else{writes++;mutations.push({method:r.method(),path});}if(path.includes('/ai/')||path.includes('/chale'))ai++;}});
  const hub=page.getByRole('region',{name:'Game Vault and Studio'}),nav=page.getByRole('navigation',{name:'Games navigation'}),inspector=hub.getByRole('region',{name:'Godot source inspector'});
  const open=async()=>{await nav.getByRole('button',{name:'Vault & Studio',exact:true}).click();await hub.getByRole('button',{name:'Create project',exact:true}).waitFor();};
  await page.goto(origin+'/#gaming');await open();await hub.getByRole('complementary',{name:'Saved game projects'}).getByRole('button').click();
  check(await inspector.getByText('Supported references checked',{exact:true}).count()===0&&writes===0,'Opening the Studio never starts inspection or transmits source: '+JSON.stringify(mutations),width);
  await context.setOffline(true);await inspector.getByRole('button',{name:'Inspect Godot source',exact:true}).click();await inspector.getByRole('heading',{name:'Supported references checked',exact:true}).waitFor();
  check(await inspector.getByRole('heading',{name:'Supported references checked',exact:true}).evaluate(e=>e===document.activeElement),'Offline static inspection completes and focuses the result heading',width);
  check((await inspector.innerText()).includes('not Godot execution')&&(await inspector.innerText()).includes('No files were changed')&&writes===0&&ai===0,'Static results never claim engine execution, editing, upload or AI processing',width);
  await inspector.getByText(/Dependency graph/).click();check(await inspector.getByText('materials/blue.tres',{exact:true}).count()>0,'The actual inspector exposes nested scene/script/resource graph edges',width);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Inspector and graph have no horizontal page overflow',width);
  await inspector.screenshot({path:fileURLToPath(new URL('inspector-'+width+'.png',output))});await context.setOffline(false);
  const before=await (await context.request.get(origin+'/api/v1/games/vault')).json();assert.deepEqual(before.vault.projects[0].files,project.files.slice().sort((a,b)=>a.path<b.path?-1:1));check(before.revision===1&&writes===0,'Inspection leaves exact durable source and server revision unchanged',width);
  await hub.getByRole('navigation',{name:'Project source files'}).getByRole('button',{name:'scripts/main.gd',exact:true}).click();await hub.getByLabel('Source: scripts/main.gd',{exact:true}).fill(project.files[2].content+'var lost=load("res://lost.gd")\nvar photo=load("res://assets/photo.png")\n');
  check(await inspector.getByText('Supported references checked',{exact:true}).count()===0,'Editing a draft invalidates its old inspection result immediately',width);
  await inspector.getByRole('button',{name:'Inspect Godot source',exact:true}).click();await inspector.getByRole('heading',{name:'Source repairs needed',exact:true}).waitFor();
  check((await inspector.innerText()).includes('referenced source file is not in this project')&&(await inspector.innerText()).includes('No binary asset was imported'),'Missing source and binary assets receive honest beginner repair guidance',width);
  await inspector.screenshot({path:fileURLToPath(new URL('issues-'+width+'.png',output))});check(writes===0&&ai===0,'Inspecting an unsaved failing draft does not save or send it anywhere',width);
  await page.evaluate(()=>{
   const find=text=>[...document.querySelectorAll('button')].find(e=>e.textContent===text);
   const observer=new MutationObserver(()=>{const cancel=find('Cancel inspection');if(cancel){observer.disconnect();cancel.click();}});observer.observe(document.body,{childList:true,subtree:true});find('Inspect Godot source').click();
  });await inspector.getByRole('status').filter({hasText:'Inspection cancelled'}).waitFor();check(await inspector.getByRole('button',{name:'Inspect Godot source',exact:true}).evaluate(e=>e===document.activeElement),'Actual browser cancellation stops inspection and restores stable focus',width);
  const other=await browser.newContext({serviceWorkers:'block'});const second=await other.request.post(origin+'/api/v1/auth/register',{data:{ecoId:'godot_other_'+width,displayName:'Other Godot QA '+width,password:'Synthetic-Test-Only-2026!'}});assert.equal(second.status(),200);
  await context.addCookies(await other.cookies());await page.evaluate(()=>window.dispatchEvent(new Event('ecovibes:identity_changed')));await page.getByText('Other Godot QA '+width,{exact:true}).first().waitFor({state:'attached'});await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ecovibes:navigate',{detail:'Gaming'})));await open();await hub.getByText('No projects saved. Create one to start.',{exact:true}).waitFor();
  check(await inspector.count()===0&&await hub.getByText('Source repairs needed',{exact:true}).count()===0&&writes===0&&ai===0,'Account B never sees account A source, dependency graph or report',width);
  assert.deepEqual(errors,[]);check(true,'No browser page errors',width);await other.close();await context.close();
 }
}catch(e){failure=String(e);console.error(e);if(diagnosticPage)await diagnosticPage.screenshot({path:fileURLToPath(new URL('failure.png',output))}).catch(()=>{});}
finally{
 await browser?.close();if(server&&server.exitCode===null){const closed=new Promise(r=>server.once('close',r));server.kill('SIGTERM');await closed;}await rm(temp,{recursive:true,force:true});
 await writeFile(new URL('report.json',output),JSON.stringify({passed:!failure,checks,failure,scope:'Built app/desktop Chrome390+1440/isolated local API/synthetic accounts and trusted source fixtures; static checks only, not native engine execution, hosted or physical-device acceptance.'},null,2));console.log(JSON.stringify({passed:!failure,checks,failure}));if(failure)process.exitCode=1;
}
