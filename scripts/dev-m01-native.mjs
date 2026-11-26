// Owned loopback proof only. No inherited credentials, .env, hosted data or AI calls.
import { spawn } from 'node:child_process';
import { mkdir,mkdtemp,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
await mkdir(resolve(root,'work/m01-native'),{recursive:true});
const folder=await mkdtemp(resolve(root,'work/m01-native/demo-')),dbPath=resolve(folder,'test.sqlite');
let api,apiLog='',webLog='',web,stopped=false;
const common={PATH:process.execPath.slice(0,process.execPath.lastIndexOf('/'))+':/usr/bin:/bin',TMPDIR:process.env.TMPDIR||'/tmp',OPENAI_ENV_FILE:'',SUPABASE_URL:'',DATABASE_URL:''};
const child=spawn(process.execPath,['--import','./scripts/chale-test-provider.mjs','server/index.mjs'],{cwd:root,env:{...common,NODE_ENV:'test',AI_PROVIDER_KEY:'synthetic-chale-http-fixture',CHALE_SMOKE_CAPTURE:resolve(folder,'unused.jsonl'),PORT:'0',ECOVIBES_DB_PATH:dbPath,ECOVIBES_MEDIA_LOCAL_ROOT:resolve(folder,'media'),ECOVIBES_M01_ENABLED:'true',ECOVIBES_TRACKING_DISABLED:'true',ECOVIBES_PUBLIC_TRENDS_DISABLED:'true',APP_ORIGINS:'http://127.0.0.1:55189'},stdio:['ignore','pipe','pipe','ipc']});
child.stdout.on('data',b=>apiLog+=b);child.stderr.on('data',b=>apiLog+=b);child.on('message',m=>{if(m?.event==='chale-smoke-ready')api='http://127.0.0.1:'+m.port;});
async function req(actor,path,body){const r=await fetch(api+'/api/v1'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json',Origin:api}:{}),...(actor?{cookie:actor.cookie,'X-CSRF-Token':actor.csrfToken}:{})},body:body?JSON.stringify(body):undefined});const value=await r.json();if(!r.ok)throw Error(path+': '+JSON.stringify(value));return {...value,cookie:r.headers.get('set-cookie')?.split(';')[0]||actor?.cookie};}
const password='Local-M01-only-26-Nov-2026!';
try{
 for(let n=0;n<200&&!api;n++)await delay(50);if(!api)throw Error('Isolated API not ready: '+apiLog);
 const accounts={};
 for(const role of ['seller','buyer','reviewer']){
  const result=await req(null,'/auth/register',{ecoId:'m01.'+role,displayName:'M01 '+role+' · local proof',password});
  accounts[role]={ecoId:'m01.'+role,password,userId:result.user.id};
  if(role==='seller'){await req(result,'/identity/roles',{role:'seller'});const created=await req(result,'/studio/shops',{requestId:randomUUID(),name:'Life of Kings',slug:'life-of-kings'});accounts.shop=created.shop;}
 }
 const db=new DatabaseSync(dbPath);db.prepare("INSERT INTO staff_access(user_id,staff_role,created_at) VALUES(?,'trust_staff',?)").run(accounts.reviewer.userId,new Date().toISOString());db.close();
 await writeFile(resolve(folder,'demo-accounts.json'),JSON.stringify(accounts,null,2),{mode:0o600});
 web=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','55189','--strictPort'],{cwd:root,env:{...common,NODE_ENV:'development',API_PORT:new URL(api).port,VITE_M01_STUDIO:'true'},stdio:['ignore','pipe','pipe']});
 web.stdout.on('data',b=>webLog+=b);web.stderr.on('data',b=>webLog+=b);
 const manifest={scope:'Isolated persistent native proof, synthetic accounts; not production',url:'http://127.0.0.1:55189/m01',api,folder,dbPath,apiPid:child.pid,webPid:web.pid,accounts:['m01.seller','m01.buyer','m01.reviewer'],shop:accounts.shop};
 await writeFile(resolve(root,'work/m01-native/preview.json'),JSON.stringify(manifest,null,2));
 console.log(JSON.stringify(manifest,null,2));
}catch(error){console.error(error.stack);child.kill('SIGTERM');web?.kill('SIGTERM');process.exitCode=1;stopped=true;}
async function stop(){if(stopped)return;stopped=true;child.kill('SIGTERM');web?.kill('SIGTERM');await writeFile(resolve(folder,'api.log'),apiLog);await writeFile(resolve(folder,'web.log'),webLog);}
process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());
