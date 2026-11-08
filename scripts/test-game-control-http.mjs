import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {emptyWorkspace} from '../shared/game-control.mjs';
const out=new URL('../work/ecogames-control-20261108/',import.meta.url);await mkdir(out,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'eco-control-http-')),db=join(temp,'fixture.sqlite'),checks=[];
let child,origin,logs='',failure;
async function start(disabled=false){
 origin=null;child=spawn(process.execPath,['--import','./scripts/chale-test-provider.mjs','server/index.mjs'],{cwd:new URL('../',import.meta.url),env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',PORT:'0',ECOVIBES_DB_PATH:db,AI_PROVIDER_KEY:'synthetic-chale-http-fixture',OPENAI_ENV_FILE:'',DATABASE_URL:'',SUPABASE_URL:'',CHALE_SMOKE_CAPTURE:join(temp,'unused.jsonl'),ECOVIBES_GAME_CONTROL_DISABLED:disabled?'true':'false'},stdio:['ignore','pipe','pipe','ipc']});
 child.on('message',m=>{if(m?.event==='chale-smoke-ready')origin='http://127.0.0.1:'+m.port;});child.stdout.on('data',v=>logs=(logs+v).slice(-4000));child.stderr.on('data',v=>logs=(logs+v).slice(-4000));
 const deadline=Date.now()+15000;while(!origin&&child.exitCode===null&&Date.now()<deadline)await delay(40);assert(origin,'Isolated API did not start: '+logs);
}
async function stop(){if(!child||child.exitCode!==null)return;const closed=new Promise(r=>child.once('close',r));child.kill('SIGTERM');await closed;}
async function request(path,method='GET',body,account,headers={}){
 const r=await fetch(origin+'/api/v1'+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(account?{cookie:account.cookie,'X-CSRF-Token':account.csrf}:{}),...headers},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000)});
 return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie'),cache:r.headers.get('cache-control')};
}
async function register(name){const r=await request('/auth/register','POST',{ecoId:name,displayName:name,password:'Synthetic-Test-Only-2026!'});assert.equal(r.status,200);return {id:r.body.user.id,csrf:r.body.csrfToken,cookie:r.cookie.split(';')[0]};}
const check=(condition,name)=>{assert(condition,name);checks.push(name);};
try{
 await start();check((await request('/games/control')).status===401,'Anonymous private workspace denied');
 const a=await register('control_alpha'),b=await register('control_beta');
 const w=emptyWorkspace();w.milestones=[{id:'m1',title:'Synthetic private fixture',status:'Unknown'}];
 const body={expectedOwnerId:a.id,revision:0,operationId:randomUUID(),workspace:w};
 const saved=await request('/games/control','PUT',body,a);check(saved.status===200&&saved.body.revision===1,'Actual HTTP server confirms persisted revision');
 check(saved.cache==='no-store','Private workspace response uses no-store');
 check((await request('/games/control','GET',undefined,b)).body.workspace.milestones.length===0,'Second account cannot see first account metadata');
 const retry=await request('/games/control','PUT',body,a);check(retry.status===200&&retry.body.revision===1,'Lost-response retry does not create a duplicate revision');
 check((await request('/games/control','PUT',{...body,operationId:randomUUID()},a)).status===409,'Stale concurrent save conflicts');
 check((await request('/games/control','PUT',body,b)).status===409,'Account-switch expectation cannot retarget a save');
 check((await request('/games/control?ownerId='+a.id,'GET',undefined,b)).status===400,'Account selector rejected');
 check((await request('/games/control','PUT',{...body,revision:1,operationId:randomUUID()},a,{'X-CSRF-Token':'wrong'})).status===403,'Missing or wrong CSRF cannot write');
 check((await request('/games/control','PUT',body,a,{Origin:'https://unapproved.example'})).status===403,'Cross-origin writes rejected');
 await stop();await start();
 const loaded=await request('/games/control','GET',undefined,a);check(loaded.status===200&&loaded.body.workspace.milestones[0].id==='m1','Saved workspace survives actual API restart');
 check(loaded.body.authority==='user-reported'&&loaded.body.releaseAuthorized===false,'Recorded evidence does not grant release authority');
 await stop();await start(true);
 check((await request('/games/control','GET',undefined,a)).status===503,'Deny-only feature disable works while retaining data');
}catch(e){failure=String(e);console.error(e);}
finally{await stop();await rm(temp,{recursive:true,force:true});const report={passed:!failure,checks,failure,scope:'Actual isolated SQLite API with two synthetic accounts; no hosted user or provider acceptance'};await writeFile(new URL('http.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(failure)process.exitCode=1;}
