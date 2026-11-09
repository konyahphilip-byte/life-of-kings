import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import {emptyVault} from '../shared/game-vault.mjs';
import {fixtureProject,verifyExtractedArchive} from './test-game-project-export.mjs';
const output=new URL('../work/ecogames-project-export-20261108/browser/',import.meta.url);await mkdir(output,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'eco-project-export-browser-')),checks=[];
let server,browser,origin,logs='',failure,diagnosticPage;
const check=(condition,name,width)=>{assert(condition,name);checks.push({width,check:name,passed:true});};
try{
 server=spawn(process.execPath,['--import','./scripts/chale-test-provider.mjs','server/index.mjs'],{cwd:new URL('../',import.meta.url),env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',PORT:'0',ECOVIBES_DB_PATH:join(temp,'fixture.sqlite'),ECOVIBES_SERVE_WEB:'true',AI_PROVIDER_KEY:'synthetic-chale-http-fixture',OPENAI_ENV_FILE:'',DATABASE_URL:'',SUPABASE_URL:'',CHALE_SMOKE_CAPTURE:join(temp,'unused.jsonl')},stdio:['ignore','pipe','pipe','ipc']});
 server.on('message',m=>{if(m?.event==='chale-smoke-ready')origin='http://127.0.0.1:'+m.port;});server.stdout.on('data',v=>logs=(logs+v).slice(-3000));server.stderr.on('data',v=>logs=(logs+v).slice(-3000));
 const deadline=Date.now()+15000;while(!origin&&server.exitCode===null&&Date.now()<deadline)await delay(40);assert(origin,'Isolated API startup failed: '+logs);
 browser=await chromium.launch(process.platform==='darwin'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{});
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block',acceptDownloads:true});await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const registered=await context.request.post(origin+'/api/v1/auth/register',{data:{ecoId:'project_export_'+width,displayName:'Synthetic export QA '+width,password:'Synthetic-Test-Only-2026!'}});assert.equal(registered.status(),200);const account=await registered.json(),project=fixtureProject();
  const saved=await context.request.put(origin+'/api/v1/games/vault',{headers:{'X-CSRF-Token':account.csrfToken},data:{expectedOwnerId:account.user.id,revision:0,operationId:randomUUID(),consent:'private-storage-v1',vault:{...emptyVault(),projects:[project]}}});assert.equal(saved.status(),200);
  const page=await context.newPage();diagnosticPage=page;const errors=[];page.on('pageerror',e=>errors.push(e.message));let writes=0,downloads=0;page.on('request',r=>{if(r.method()==='PUT'&&r.url().endsWith('/games/vault'))writes++;});page.on('download',()=>downloads++);
  const hub=page.getByRole('region',{name:'Game Vault and Studio'}),nav=page.getByRole('navigation',{name:'Games navigation'});
  const open=async()=>{await nav.getByRole('button',{name:'Vault & Studio',exact:true}).click();await hub.getByRole('button',{name:'Create project',exact:true}).waitFor();};
  await page.goto(origin+'/#gaming');await open();await hub.getByRole('complementary',{name:'Saved game projects'}).getByRole('button').click();
  const getZip=async(name,expected,tag)=>{
   const pending=page.waitForEvent('download');await hub.getByRole('button',{name,exact:true}).click();const download=await pending;assert.equal(download.suggestedFilename(),'ecogames-'+project.id+'.zip');const bytes=await readFile(await download.path());await verifyExtractedArchive(bytes,expected,join(temp,'download-'+width+'-'+tag));assert.equal(await download.failure(),null);
  };
  await getZip('Export project source ZIP',project,'saved');check(writes===0,'Saved project downloads as a standard ZIP with exact nested source and bytes, without a server write',width);
  await hub.getByRole('navigation',{name:'Project source files'}).getByRole('button',{name:'scripts/main.gd',exact:true}).click();
  const edited=project.files.find(f=>f.path==='scripts/main.gd').content+'# Unsaved export only\n';await hub.getByLabel('Source: scripts/main.gd',{exact:true}).fill(edited);
  await context.setOffline(true);await getZip('Export draft source ZIP',{...project,files:project.files.map(f=>f.path==='scripts/main.gd'?{...f,content:edited}:f)},'draft');await context.setOffline(false);
  const current=await (await context.request.get(origin+'/api/v1/games/vault')).json();check(writes===0&&current.revision===1&&current.vault.projects[0].files.find(f=>f.path==='scripts/main.gd').content===project.files.find(f=>f.path==='scripts/main.gd').content,'Offline draft export includes unsaved edits and leaves the saved Vault unchanged',width);
  check(await hub.getByRole('button',{name:'Export draft source ZIP'}).isEnabled()&&await hub.getByRole('checkbox').isChecked()===false,'Export keeps the draft dirty and does not consent to upload',width);
  await hub.getByRole('region',{name:'Local project export'}).screenshot({path:fileURLToPath(new URL('export-'+width+'.png',output))});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Source export has no horizontal page overflow',width);
  await hub.getByLabel('New file path').fill('CON.gd');await hub.getByRole('button',{name:'Add empty text file'}).click();await hub.getByRole('button',{name:'Export draft source ZIP'}).click();await hub.getByRole('alert').filter({hasText:'portable'}).waitFor();check(downloads===2&&writes===0&&await hub.getByLabel('Source: CON.gd',{exact:true}).count()===1,'Unsafe export fails visibly, starts no download and preserves the draft',width);
  const other=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});const second=await other.request.post(origin+'/api/v1/auth/register',{data:{ecoId:'export_other_'+width,displayName:'Other synthetic export QA',password:'Synthetic-Test-Only-2026!'}});assert.equal(second.status(),200);
  await context.addCookies(await other.cookies());await page.evaluate(()=>window.dispatchEvent(new Event('ecovibes:identity_changed')));await page.getByText('Other synthetic export QA',{exact:true}).first().waitFor({state:'attached'});
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ecovibes:navigate',{detail:'Gaming'})));await open();await hub.getByText('No projects saved. Create one to start.',{exact:true}).waitFor();check(await hub.getByRole('button',{name:/source ZIP/}).count()===0&&await hub.getByLabel('Source: CON.gd',{exact:true}).count()===0,'Switching accounts removes the previous project and its export controls',width);
  assert.deepEqual(errors,[]);check(true,'No browser page errors',width);await other.close();await context.close();
 }
}catch(e){failure=String(e);console.error(e);if(diagnosticPage)await diagnosticPage.screenshot({path:fileURLToPath(new URL('failure.png',output))}).catch(()=>{});}
finally{
 await browser?.close();if(server&&server.exitCode===null){const closed=new Promise(r=>server.once('close',r));server.kill('SIGTERM');await closed;}
 await rm(temp,{recursive:true,force:true});await writeFile(new URL('report.json',output),JSON.stringify({passed:!failure,checks,failure,scope:'Built app in installed desktop Chrome at390/1440px, isolated local API and synthetic accounts; independent ZIP extraction. Not physical phones, hosted source, native engine opening or creator builds.'},null,2));console.log(JSON.stringify({passed:!failure,checks,failure}));if(failure)process.exitCode=1;
}
