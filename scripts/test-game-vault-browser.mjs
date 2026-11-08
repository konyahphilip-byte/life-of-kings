import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import {readBackup,emptyVault,newProject} from '../shared/game-vault.mjs';
const output=new URL('../work/ecogames-vault-20261108/browser/',import.meta.url);await mkdir(output,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'eco-vault-browser-')),checks=[];
let server,browser,origin,logs='',failure,diagnosticPage;
const check=(condition,name,width)=>{assert(condition,name);checks.push({width,check:name,passed:true});};
try{
 server=spawn(process.execPath,['--import','./scripts/chale-test-provider.mjs','server/index.mjs'],{cwd:new URL('../',import.meta.url),env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',PORT:'0',ECOVIBES_DB_PATH:join(temp,'fixture.sqlite'),ECOVIBES_SERVE_WEB:'true',AI_PROVIDER_KEY:'synthetic-chale-http-fixture',OPENAI_ENV_FILE:'',DATABASE_URL:'',SUPABASE_URL:'',CHALE_SMOKE_CAPTURE:join(temp,'unused.jsonl')},stdio:['ignore','pipe','pipe','ipc']});
 server.on('message',m=>{if(m?.event==='chale-smoke-ready')origin='http://127.0.0.1:'+m.port;});server.stdout.on('data',v=>logs=(logs+v).slice(-3000));server.stderr.on('data',v=>logs=(logs+v).slice(-3000));
 const deadline=Date.now()+15000;while(!origin&&server.exitCode===null&&Date.now()<deadline)await delay(40);assert(origin,'Isolated API startup failed: '+logs);
 browser=await chromium.launch(process.platform==='darwin'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{});
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block',acceptDownloads:true});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const registration=await context.request.post(origin+'/api/v1/auth/register',{data:{ecoId:'vault_browser_'+width,displayName:'Synthetic QA '+width,password:'Synthetic-Test-Only-2026!'}});assert.equal(registration.status(),200);
  const account=await registration.json(),page=await context.newPage(),errors=[];diagnosticPage=page;page.on('pageerror',e=>errors.push(e.message));
  let writes=0;page.on('request',r=>{if(r.method()==='PUT'&&r.url().endsWith('/games/vault'))writes++;});
  const hub=page.getByRole('region',{name:'Game Vault and Studio'}),nav=page.getByRole('navigation',{name:'Games navigation'});
  const open=async()=>{await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ecovibes:navigate',{detail:'Gaming'})));await nav.getByRole('button',{name:'Vault & Studio',exact:true}).click();await hub.getByRole('button',{name:'Create project',exact:true}).waitFor();};
  const save=async()=>{await hub.getByRole('checkbox').check();await hub.getByRole('button',{name:'Save project',exact:true}).click();await hub.getByText('Project Vault saved by the server.',{exact:true}).waitFor();};
  await page.goto(origin+'/#gaming');await open();await hub.getByRole('button',{name:'Create project',exact:true}).click();
  await hub.getByLabel('Project title',{exact:true}).fill('Synthetic circuit '+width);await hub.getByLabel('Story Bible',{exact:true}).fill('Original six-scene circuit story');
  await hub.getByLabel('Choose text source files').setInputFiles({name:'scene.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg onload="window.__vault_executed=true"></svg>')});
  await hub.getByLabel('Source: scene.svg',{exact:true}).waitFor();check(writes===0&&await hub.getByRole('button',{name:'Save project',exact:true}).isDisabled(),'Picker reads only selected source locally; upload needs separate consent',width);
  await save();check(writes===1,'Server-confirmed private project save',width);
  await page.reload();await open();await hub.getByRole('complementary',{name:'Saved game projects'}).getByRole('button').click();
  assert.equal(await hub.getByLabel('Story Bible',{exact:true}).inputValue(),'Original six-scene circuit story');
  check((await hub.getByLabel('Source: scene.svg',{exact:true}).inputValue()).includes('<svg')&&!await page.evaluate(()=>window.__vault_executed),'Actual source reopens after reload without executing uploaded SVG',width);
  await hub.getByLabel('Checkpoint label').fill('Before change');await hub.getByRole('button',{name:'Prepare checkpoint'}).click();await save();
  await hub.getByLabel('Story Bible',{exact:true}).fill('Unsaved on this open app');
  await nav.getByRole('button',{name:'Discover',exact:true}).click();await nav.getByRole('button',{name:'Vault & Studio',exact:true}).click();
  await hub.getByLabel('Story Bible',{exact:true}).waitFor();assert.equal(await hub.getByLabel('Story Bible',{exact:true}).inputValue(),'Unsaved on this open app');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ecovibes:navigate',{detail:'Profile'})));await open();
  check(await hub.getByLabel('Story Bible',{exact:true}).inputValue()==='Unsaved on this open app','Unsaved source/Story Bible resume across Games tabs and actual App routes',width);
  await context.setOffline(true);await hub.getByRole('checkbox').check();await hub.getByRole('button',{name:'Save project',exact:true}).click();await hub.getByRole('alert').filter({hasText:'draft remains'}).waitFor();
  check(await hub.getByLabel('Story Bible',{exact:true}).inputValue()==='Unsaved on this open app','Offline failure keeps draft and shows no success',width);
  await context.setOffline(false);await hub.getByRole('button',{name:'Save project',exact:true}).click();await hub.getByText('Project Vault saved by the server.',{exact:true}).waitFor();
  await hub.getByRole('button',{name:'Preview checkpoint Before change',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Checkpoint preview'});
  await dialog.getByRole('button',{name:'Load checkpoint draft',exact:true}).waitFor();check(await dialog.getByRole('button',{name:'Load checkpoint draft'}).evaluate(e=>e===document.activeElement),'Checkpoint confirmation receives keyboard focus',width);
  await page.keyboard.press('Shift+Tab');assert(await dialog.getByRole('button',{name:'Keep current work'}).evaluate(e=>e===document.activeElement));await page.keyboard.press('Escape');
  await hub.getByRole('button',{name:'Preview checkpoint Before change',exact:true}).click();const beforeRestore=writes;await dialog.getByRole('button',{name:'Load checkpoint draft'}).click();
  check(writes===beforeRestore&&await hub.getByLabel('Story Bible',{exact:true}).inputValue()==='Original six-scene circuit story','Checkpoint restoration prepares a draft and requires separate save',width);await save();
  const downloadPromise=page.waitForEvent('download');await hub.getByRole('button',{name:'Export Vault backup',exact:true}).click();const download=await downloadPromise,backup=await readFile(await download.path(),'utf8'),decoded=await readBackup(backup);
  check(decoded.projects[0].files[0].path==='scene.svg','Downloaded backup passes actual SHA-256 verification',width);
  const titleRect=await hub.getByLabel('Project title',{exact:true}).boundingBox(),engineRect=await hub.getByLabel('Engine',{exact:true}).boundingBox();check(width>700?engineRect.x>=titleRect.x+titleRect.width:engineRect.y>=titleRect.y+titleRect.height,'Title and engine controls do not overlap',width);check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Active source editor has no horizontal page overflow',width);await hub.screenshot({path:fileURLToPath(new URL('studio-'+width+'.png',output))});
  await hub.getByRole('button',{name:'Remove project from Vault'}).click();await page.getByRole('button',{name:'Confirm removal'}).click();await hub.getByText('No projects saved. Create one to start.',{exact:true}).waitFor();
  check(await hub.getByRole('button',{name:'Create project',exact:true}).evaluate(e=>e===document.activeElement),'Acknowledged removal restores useful focus',width);
  const beforeImport=writes;await hub.getByLabel('Choose Vault backup').setInputFiles({name:'ecogames-vault.json',mimeType:'application/json',buffer:Buffer.from(backup)});await hub.getByLabel('Vault import preview').waitFor();
  check(writes===beforeImport&&await hub.getByRole('button',{name:'Import verified backup'}).isDisabled(),'Backup selection previews locally without upload',width);
  await hub.getByRole('checkbox').check();await hub.getByRole('button',{name:'Import verified backup'}).click();await hub.getByText('Project Vault saved by the server.',{exact:true}).waitFor();
  await hub.getByRole('complementary',{name:'Saved game projects'}).getByRole('button').click();check(await hub.getByLabel('Story Bible',{exact:true}).inputValue()==='Original six-scene circuit story','Explicit backup import restores durable project',width);
  // A different device saves after this editor starts. The original draft must not be silently rebased.
  await hub.getByLabel('Story Bible',{exact:true}).fill('Keep conflicted private draft');
  const currentResponse=await context.request.get(origin+'/api/v1/games/vault'),head=await currentResponse.json();const otherProject=newProject('Other device '+width);
  const remote=await context.request.put(origin+'/api/v1/games/vault',{headers:{'X-CSRF-Token':account.csrfToken},data:{expectedOwnerId:account.user.id,revision:head.revision,operationId:randomUUID(),consent:'private-storage-v1',vault:{...emptyVault(),projects:[otherProject]}}});assert.equal(remote.status(),200);
  await nav.getByRole('button',{name:'Discover',exact:true}).click();await nav.getByRole('button',{name:'Vault & Studio',exact:true}).click();await hub.getByLabel('Story Bible',{exact:true}).waitFor();
  await hub.getByRole('checkbox').check();await hub.getByRole('button',{name:'Save project',exact:true}).click();await hub.getByRole('alert').filter({hasText:'newer Vault'}).waitFor();
  const exportDraftPromise=page.waitForEvent('download');await hub.getByRole('button',{name:'Export current draft',exact:true}).click();const draftDownload=await exportDraftPromise;check((await readBackup(await readFile(await draftDownload.path(),'utf8'))).projects.some(p=>p.story==='Keep conflicted private draft'),'Conflicted source can be exported without overwriting newer device work',width);
  await hub.getByRole('button',{name:'Reload saved projects'}).click();await page.getByRole('dialog',{name:'Discard draft and reload'}).getByRole('button',{name:'Discard draft and reload',exact:true}).click();await hub.getByRole('complementary',{name:'Saved game projects'}).getByText('Other device '+width,{exact:true}).waitFor();check(await hub.getByLabel('Story Bible',{exact:true}).count()===0,'Explicit discard-and-reload recovers a conflict',width);
  const other=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});await other.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());const registered=await other.request.post(origin+'/api/v1/auth/register',{data:{ecoId:'vault_other_'+width,displayName:'Other synthetic QA',password:'Synthetic-Test-Only-2026!'}});assert.equal(registered.status(),200);
  const otherPage=await other.newPage();await otherPage.goto(origin+'/#gaming');await otherPage.getByRole('navigation',{name:'Games navigation'}).getByRole('button',{name:'Vault & Studio',exact:true}).click();await otherPage.getByText('No projects saved. Create one to start.',{exact:true}).waitFor();
  await hub.getByRole('button',{name:'Create project',exact:true}).click();await hub.getByLabel('Story Bible',{exact:true}).fill('Private account A memory');await context.addCookies(await other.cookies());await page.evaluate(()=>window.dispatchEvent(new Event('ecovibes:identity_changed')));await page.getByText('Other synthetic QA',{exact:true}).first().waitFor({state:'attached'});await open();await hub.getByText('No projects saved. Create one to start.',{exact:true}).waitFor();
  check(await hub.getByLabel('Story Bible',{exact:true}).count()===0&&await hub.getByText('Other device '+width,{exact:true}).count()===0,'Second account and same-browser account switching cannot see source or dirty memory',width);
  await writeFile(new URL('layout-'+width+'.json',output),JSON.stringify(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(e=>e.right>innerWidth+1&&e.width>0).slice(-20)})),null,2));check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow',width);assert.deepEqual(errors,[]);checks.push({width,check:'No browser page errors',passed:true});
  await other.close();await context.close();
 }
}catch(e){failure=String(e);console.error(e);if(diagnosticPage){await diagnosticPage.screenshot({path:fileURLToPath(new URL('failure.png',output))}).catch(()=>{});await writeFile(new URL('diagnostic.json',output),JSON.stringify(await diagnosticPage.evaluate(()=>({url:location.hash,alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent),fields:[...document.querySelectorAll('textarea')].map(e=>({label:e.parentElement.textContent.slice(0,80),valueLength:e.value.length})),files:[...document.querySelectorAll('.eg-vault nav button')].map(e=>e.textContent)})),null,2));}}
finally{
 await browser?.close();if(server&&server.exitCode===null){const closed=new Promise(r=>server.once('close',r));server.kill('SIGTERM');await closed;}
 await rm(temp,{recursive:true,force:true});await writeFile(new URL('report.json',output),JSON.stringify({passed:!failure,checks,failure,scope:'Built app in installed desktop Chrome at mobile/desktop viewports; actual local API and synthetic accounts/source. Not physical device/system permission prompts, hosted accounts or provider backup restoration.'},null,2));
 console.log(JSON.stringify({passed:!failure,checks,failure}));if(failure)process.exitCode=1;
}
