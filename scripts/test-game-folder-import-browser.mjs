import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import {fixtureProject,verifyExtractedArchive} from './test-game-project-export.mjs';
const output=new URL('../work/ecogames-folder-import-20261109/browser/',import.meta.url);await mkdir(output,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'eco-folder-import-browser-')),checks=[];
let server,browser,origin,logs='',failure,diagnosticPage;
const check=(condition,name,width)=>{assert(condition,name);checks.push({width,check:name,passed:true});};
try{
 const fixture=fixtureProject(),folder=join(temp,'My Ghana Game 🌍');
 for(const f of [...fixture.files,{path:'.env',content:'SYNTHETIC DO NOT READ'},{path:'.godot/cache.txt',content:'cache'},{path:'node_modules/dependency.js',content:'generated'},{path:'assets/image.png',content:'synthetic binary excluded'}]){const p=join(folder,f.path);await mkdir(dirname(p),{recursive:true});await writeFile(p,f.content);}
 const deniedFolder=join(temp,'Denied fixture');await mkdir(deniedFolder);await writeFile(join(deniedFolder,'denied.gd'),'private synthetic source\n');
 const pendingFolder=join(temp,'Pending fixture');await mkdir(pendingFolder);await writeFile(join(pendingFolder,'pending.gd'),'late source\n');await writeFile(join(pendingFolder,'z-next.gd'),'never read\n');
 server=spawn(process.execPath,['--import','./scripts/chale-test-provider.mjs','server/index.mjs'],{cwd:new URL('../',import.meta.url),env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',PORT:'0',ECOVIBES_DB_PATH:join(temp,'fixture.sqlite'),ECOVIBES_SERVE_WEB:'true',AI_PROVIDER_KEY:'synthetic-chale-http-fixture',OPENAI_ENV_FILE:'',DATABASE_URL:'',SUPABASE_URL:'',CHALE_SMOKE_CAPTURE:join(temp,'unused.jsonl')},stdio:['ignore','pipe','pipe','ipc']});
 server.on('message',m=>{if(m?.event==='chale-smoke-ready')origin='http://127.0.0.1:'+m.port;});server.stdout.on('data',v=>logs=(logs+v).slice(-3000));server.stderr.on('data',v=>logs=(logs+v).slice(-3000));
 const deadline=Date.now()+15000;while(!origin&&server.exitCode===null&&Date.now()<deadline)await delay(40);assert(origin,'Isolated API startup failed: '+logs);
 browser=await chromium.launch(process.platform==='darwin'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{});
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block',acceptDownloads:true});await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await context.addInitScript(()=>{
   const original=File.prototype.arrayBuffer;window.__folderReads=[];
   File.prototype.arrayBuffer=function(){window.__folderReads.push(this.webkitRelativePath);if(this.name==='denied.gd')return Promise.reject(new DOMException('Synthetic private OS detail','NotAllowedError'));if(this.name==='pending.gd')return new Promise(resolve=>{window.__finishFolderRead=()=>original.call(this).then(resolve);});return original.call(this);};
  });
  const registered=await context.request.post(origin+'/api/v1/auth/register',{data:{ecoId:'folder_import_'+width,displayName:'Synthetic folder QA '+width,password:'Synthetic-Test-Only-2026!'}});assert.equal(registered.status(),200);
  const page=await context.newPage();diagnosticPage=page;const errors=[];page.on('pageerror',e=>errors.push(e.message));let writes=0;page.on('request',r=>{if(r.method()==='PUT'&&r.url().endsWith('/games/vault'))writes++;});
  const hub=page.getByRole('region',{name:'Game Vault and Studio'}),nav=page.getByRole('navigation',{name:'Games navigation'}),preview=hub.getByRole('region',{name:'Folder source preview'});
  const open=async()=>{await nav.getByRole('button',{name:'Vault & Studio',exact:true}).click();await hub.getByRole('button',{name:'Create project',exact:true}).waitFor();};
  const select=async(dir=folder)=>{await hub.getByLabel('Choose source folder',{exact:true}).setInputFiles(dir);await preview.waitFor();};
  const reads=()=>page.evaluate(()=>window.__folderReads);
  await page.goto(origin+'/#gaming');await open();await hub.getByRole('button',{name:'Create project',exact:true}).click();await hub.getByLabel('Project title',{exact:true}).fill('Imported Ghana fixture');
  await select();check((await reads()).length===0&&await preview.getByRole('checkbox').count()===5&&await preview.getByRole('checkbox',{checked:true}).count()===0&&writes===0,'Real folder selection previews metadata with no content reads, selected checkboxes or uploads',width);
  check((await preview.innerText()).includes('4 hidden, cache or non-source items skipped')&&!(await preview.innerText()).includes('SYNTHETIC DO NOT READ'),'Hidden, dependency/cache and binary entries are excluded from the source preview',width);
  check(await hub.getByRole('button',{name:'Save project',exact:true}).isDisabled()&&await hub.getByRole('button',{name:'Export draft source ZIP',exact:true}).isDisabled(),'Pending preview cannot be mistaken for saved or exported source',width);
  await preview.screenshot({path:fileURLToPath(new URL('preview-'+width+'.png',output))});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Folder preview fits the page without horizontal overflow',width);
  await preview.getByRole('button',{name:'Cancel folder preview',exact:true}).click();check(await hub.getByLabel('Choose source folder',{exact:true}).evaluate(e=>e===document.activeElement),'Cancelling preview restores keyboard focus to the folder picker',width);check(await preview.count()===0&&(await reads()).length===0&&writes===0,'Cancelling a preview reads and uploads nothing',width);
  await select();await preview.getByRole('checkbox',{name:/scripts\/main.gd/}).check();await context.setOffline(true);await preview.getByRole('button',{name:'Read selected source into draft',exact:true}).click();await hub.getByLabel('Source: scripts/main.gd',{exact:true}).waitFor();await context.setOffline(false);
  check((await reads()).length===1&&(await reads())[0].endsWith('/scripts/main.gd')&&writes===0&&!await hub.getByRole('checkbox',{name:/^Store this Story Bible/}).isChecked(),'Reading one explicitly chosen source file works offline and does not consent to upload',width);
  const beforeCollision=(await reads()).length;await select();await preview.getByRole('button',{name:'Select eligible source',exact:true}).click();await preview.getByRole('button',{name:'Read selected source into draft',exact:true}).click();await hub.getByRole('alert').filter({hasText:/unique|directory|collision/i}).waitFor();
  check((await reads()).length===beforeCollision&&await hub.getByLabel('Source: scripts/main.gd',{exact:true}).count()===1&&writes===0,'Path collision fails before content reads and preserves existing source',width);
  await preview.getByRole('button',{name:'Cancel folder preview',exact:true}).click();await hub.getByRole('button',{name:'Remove selected file from draft',exact:true}).click();
  await select();await preview.getByRole('button',{name:'Select eligible source',exact:true}).click();await preview.getByRole('button',{name:'Read selected source into draft',exact:true}).click();await hub.getByRole('status').filter({hasText:'5 selected source files added'}).waitFor();check(await hub.getByLabel('Source: notes/empty.txt',{exact:true}).evaluate(e=>e===document.activeElement),'Completed import restores keyboard focus to the selected source editor',width);
  const expected=fixture.files.slice().sort((a,b)=>a.path<b.path?-1:1);check(writes===0&&await hub.getByRole('navigation',{name:'Project source files'}).getByRole('button').count()===5,'All five nested source files enter the local draft atomically',width);
  const pending=page.waitForEvent('download');await hub.getByRole('button',{name:'Export draft source ZIP',exact:true}).click();const download=await pending;const id=download.suggestedFilename().slice(9,-4);assert.match(id,/^[0-9a-f-]{36}$/);await verifyExtractedArchive(await readFile(await download.path()),{...fixture,id},join(temp,'imported-'+width));check(await download.failure()===null&&writes===0,'Imported source re-exports with exact nested paths, BOM, CRLF, emoji and empty-file bytes',width);
  await hub.getByRole('checkbox',{name:/^Store this Story Bible/}).check();await hub.getByRole('button',{name:'Save project',exact:true}).click();await hub.getByRole('status').filter({hasText:'Project Vault saved by the server.'}).waitFor();
  const stored=await (await context.request.get(origin+'/api/v1/games/vault')).json();assert.deepEqual(stored.vault.projects[0].files,expected);check(writes===1&&stored.revision===1,'Separate private-storage consent and server acknowledgement persist exactly the selected source',width);
  await page.reload();await open();await hub.getByRole('complementary',{name:'Saved game projects'}).getByRole('button').click();check(await hub.getByRole('navigation',{name:'Project source files'}).getByRole('button').count()===5,'Server-saved imported folders reopen after a full browser reload',width);
  await select(deniedFolder);await preview.getByRole('button',{name:'Select eligible source',exact:true}).click();await preview.getByRole('button',{name:'Read selected source into draft',exact:true}).click();await hub.getByRole('alert').filter({hasText:'could not be read'}).waitFor();check(!(await hub.getByRole('alert').innerText()).includes('private OS detail')&&await hub.getByLabel('Source: denied.gd',{exact:true}).count()===0&&writes===1,'Revoked local read access gives a safe error without partial source or a false save',width);
  await preview.getByRole('button',{name:'Cancel folder preview',exact:true}).click();
  await select(pendingFolder);await preview.getByRole('button',{name:'Select eligible source',exact:true}).click();await preview.getByRole('button',{name:'Read selected source into draft',exact:true}).click();await page.waitForFunction(()=>typeof window.__finishFolderRead==='function');await hub.getByRole('button',{name:'Cancel file read',exact:true}).click();await page.evaluate(()=>window.__finishFolderRead());await hub.getByRole('alert').filter({hasText:'cancelled'}).waitFor();
  check(!(await reads()).some(p=>p.endsWith('/z-next.gd'))&&await hub.getByLabel('Source: pending.gd',{exact:true}).count()===0&&writes===1,'Cancelling an in-flight read ignores its late result and never reads the next file',width);
  await select(pendingFolder);await preview.getByRole('button',{name:'Select eligible source',exact:true}).click();await preview.getByRole('button',{name:'Read selected source into draft',exact:true}).click();await page.waitForFunction(()=>window.__folderReads.filter(p=>p.endsWith('/pending.gd')).length===2);
  const other=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});const second=await other.request.post(origin+'/api/v1/auth/register',{data:{ecoId:'folder_other_'+width,displayName:'Other folder QA '+width,password:'Synthetic-Test-Only-2026!'}});assert.equal(second.status(),200);
  await context.addCookies(await other.cookies());await page.evaluate(()=>window.dispatchEvent(new Event('ecovibes:identity_changed')));await page.getByText('Other folder QA '+width,{exact:true}).first().waitFor({state:'attached'});await page.evaluate(()=>window.__finishFolderRead());
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ecovibes:navigate',{detail:'Gaming'})));await open();await hub.getByText('No projects saved. Create one to start.',{exact:true}).waitFor();check(await preview.count()===0&&await hub.getByLabel('Source: pending.gd',{exact:true}).count()===0&&writes===1,'A late read from account A cannot populate account B or issue a save',width);
  assert.deepEqual(errors,[]);check(true,'No browser page errors',width);await other.close();await context.close();
 }
}catch(e){failure=String(e);console.error(e);if(diagnosticPage)await diagnosticPage.screenshot({path:fileURLToPath(new URL('failure.png',output))}).catch(()=>{});}
finally{
 await browser?.close();if(server&&server.exitCode===null){const closed=new Promise(r=>server.once('close',r));server.kill('SIGTERM');await closed;}
 await rm(temp,{recursive:true,force:true});await writeFile(new URL('report.json',output),JSON.stringify({passed:!failure,checks,failure,scope:'Built app in installed desktop Chrome at390/1440px, real synthetic folder files, isolated local API and accounts, independent ZIP extraction. Not a human-operated OS picker, physical phones, hosted source or creator-game execution.'},null,2));console.log(JSON.stringify({passed:!failure,checks,failure}));if(failure)process.exitCode=1;
}
