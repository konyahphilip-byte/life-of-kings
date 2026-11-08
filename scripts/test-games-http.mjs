import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
await mkdir(new URL('../work/ecogames-20261108/',import.meta.url),{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'ecogames-http-')),checks=[];
let origin,logs='',failure;
const child=spawn(process.execPath,['--import','./scripts/chale-test-provider.mjs','server/index.mjs'],{
 cwd:new URL('../',import.meta.url),
 env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',PORT:'0',ECOVIBES_DB_PATH:join(temp,'test.sqlite'),AI_PROVIDER_KEY:'synthetic-chale-http-fixture',OPENAI_ENV_FILE:'',DATABASE_URL:'',SUPABASE_URL:'',CHALE_SMOKE_CAPTURE:join(temp,'unused.jsonl')},
 stdio:['ignore','pipe','pipe','ipc']});
child.on('message',m=>{if(m?.event==='chale-smoke-ready')origin='http://127.0.0.1:'+m.port;});
child.stdout.on('data',v=>{logs=(logs+v).slice(-6000);});child.stderr.on('data',v=>{logs=(logs+v).slice(-6000);});
async function request(path,method='GET'){const r=await fetch(origin+'/api/v1'+path,{method,signal:AbortSignal.timeout(5000)});return{status:r.status,data:await r.json(),cache:r.headers.get('cache-control')};}
async function check(name,fn){await fn();checks.push({name,passed:true});}
try{
 const deadline=Date.now()+15000;while(!origin&&child.exitCode===null&&Date.now()<deadline)await delay(40);
 assert(origin,'Isolated API did not start: '+logs);
 await check('anonymous catalog returns seven source-controlled projects and no releases',async()=>{
  const r=await request('/games');assert.equal(r.status,200);assert.equal(r.data.source,'ecovibes-roadmap');assert.equal(r.data.games.length,7);
  for(const g of r.data.games){assert.equal(g.playable,false);assert.equal(g.downloadBytes,null);assert.equal(g.releaseVersion,null);assert.equal('entryUrl' in g,false);}
  assert.equal(r.cache,'no-store');
 });
 await check('server search/category filters are authoritative',async()=>{
  const r=await request('/games?category=Racing&q=accra');assert.equal(r.status,200);assert.deepEqual(r.data.games.map(g=>g.id),['rumble-rush']);
  assert.deepEqual((await request('/games?q=nonexistent')).data.games,[]);
 });
 for(const query of ['ownerId=someone','q=a&q=b','category=Casino','q='+ 'x'.repeat(81)])
  await check('reject unsupported query '+query.slice(0,24),async()=>assert.equal((await request('/games?'+query)).status,400));
 await check('catalog cannot be edited or used to launch/upload a game',async()=>{
  for(const [path,method] of [['/games','POST'],['/games/rumble-rush/launch','POST'],['/games/upload','POST']])assert.equal((await request(path,method)).status,401);
 });
 await check('private inbox remains protected',async()=>assert.equal((await request('/connect/messages')).status,401));
 await check('catalog limiter bounds repeated requests',async()=>{
  let status=200;for(let n=0;n<31&&status!==429;n++)status=(await request('/games')).status;
  assert.equal(status,429);
 });
}catch(error){failure=error;console.error(error);}
finally{
 child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('close',resolve);});await rm(temp,{recursive:true,force:true});
 const report={passed:!failure,checks,failure:failure?String(failure):null,scope:'isolated SQLite HTTP API; no hosted accounts or providers'};
 await writeFile(new URL('../work/ecogames-20261108/http.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));if(failure)process.exitCode=1;
}
