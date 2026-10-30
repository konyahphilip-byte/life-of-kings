import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
const temp=await mkdtemp(resolve(tmpdir(),'ecovibes-public-trends-'));let origin,exited=false,failure=null;const checks=[];
// Test-only process: no .env, secrets, hosted data, AI, paid or public-provider requests.
const child=spawn(process.execPath,['--import','./scripts/chale-test-provider.mjs','server/index.mjs'],{cwd:new URL('../',import.meta.url).pathname,env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',AI_PROVIDER_KEY:'synthetic-chale-http-fixture',PORT:'0',ECOVIBES_DB_PATH:resolve(temp,'test.sqlite'),OPENAI_ENV_FILE:'',SUPABASE_URL:'',DATABASE_URL:'',ECOVIBES_PUBLIC_TRENDS_DISABLED:'true',CHALE_SMOKE_CAPTURE:resolve(temp,'unused.jsonl')},stdio:['ignore','ignore','ignore','ipc']});
child.on('message',m=>{if(m?.event==='chale-smoke-ready'&&m.port)origin=`http://127.0.0.1:${m.port}`;});child.on('exit',()=>{exited=true;});
async function request(query=''){const r=await fetch(`${origin}/api/v1/discover/happening${query}`,{signal:AbortSignal.timeout(5000)});return {status:r.status,cache:r.headers.get('cache-control'),cookie:r.headers.get('set-cookie'),data:await r.json()};}
try{
 const deadline=Date.now()+15000;while(!origin&&!exited&&Date.now()<deadline)await delay(40);assert(origin,'Owned isolated API did not start');
 const result=await request();assert.equal(result.status,200);assert.equal(result.cache,'no-store');assert.equal(result.cookie,null);checks.push('anonymous public GET/no-store/no session cookie');
 assert.deepEqual(result.data.sections.map(s=>s.status),['disabled','disabled']);assert(result.data.sections.every(s=>s.items.length===0));checks.push('deny-only feature switch never invents entries');
 for(const query of ['?geo=US','?query=synthetic-private','?userId=forged']){const r=await request(query);assert.equal(r.status,400);assert(!JSON.stringify(r.data).includes(query.slice(1)));checks.push('rejects non-fixed public parameters');}
 for(let n=0;n<5;n++)assert.equal((await request()).status,200);assert.equal((await request()).status,429);checks.push('persistent endpoint rate limit rejects seventh request');
}catch(error){failure={name:error.name,message:error.message};}
finally{child.kill('SIGTERM');for(let i=0;i<100&&!exited;i++)await delay(20);if(!exited)child.kill('SIGKILL');await rm(temp,{recursive:true,force:true});}
const report={passed:!failure,checks,failure,scope:'Actual isolated HTTP handler/SQLite; no external provider, hosted or real-account acceptance'};
if(process.env.TRENDS_HTTP_REPORT)await writeFile(process.env.TRENDS_HTTP_REPORT,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(failure)process.exitCode=1;
