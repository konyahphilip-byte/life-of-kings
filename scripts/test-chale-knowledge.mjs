import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
const root=fileURLToPath(new URL('../',import.meta.url)),temp=await mkdtemp(join(tmpdir(),'ev-knowledge-')),dbPath=join(temp,'test.sqlite');
let child,origin,logs='',failure;const checks=[];
async function start(enabled=true){let exited=false;origin=null;child=spawn(process.execPath,['--import','./scripts/chale-test-provider.mjs','server/index.mjs'],{cwd:root,env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',PORT:'0',ECOVIBES_DB_PATH:dbPath,OPENAI_ENV_FILE:'',SUPABASE_URL:'',DATABASE_URL:'',CHALE_KNOWLEDGE_ENABLED:String(enabled),AI_PROVIDER_KEY:'synthetic-chale-http-fixture',CHALE_SMOKE_CAPTURE:join(temp,'capture.jsonl')},stdio:['ignore','pipe','pipe','ipc']});child.on('message',m=>{if(m?.event==='chale-smoke-ready'&&m.port)origin='http://127.0.0.1:'+m.port;});child.stdout.on('data',v=>{logs=(logs+v).slice(-4000);});child.stderr.on('data',v=>{logs=(logs+v).slice(-4000);});child.on('exit',()=>{exited=true;});const end=Date.now()+15000;while(!origin&&!exited&&Date.now()<end)await delay(40);assert(origin,'Isolated API startup failed');}
async function stop(){if(!child||child.exitCode!==null)return;const done=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await done;}
async function request(path,{account,method='GET',body,csrf=true,foreign=false}={}){const r=await fetch(origin+'/api/v1'+path,{method,headers:{Origin:foreign?'https://untrusted.example':origin,...(account?{Cookie:account.cookie}:{}),...(account&&csrf?{'X-CSRF-Token':account.csrf}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0],cache:r.headers.get('cache-control')};}
const ok=async(path,opts)=>{const r=await request(path,opts);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
const check=async(name,work)=>{await work();checks.push(name);};
try{
 await start();
 const register=async name=>{const r=await request('/auth/register',{method:'POST',body:{ecoId:'knowledge.'+name,displayName:name,password:'Synthetic-only-password-376!'}});assert.equal(r.status,200);return {id:r.data.user.id,csrf:r.data.csrfToken,cookie:r.cookie};};
 const a=await register('admin'),b=await register('reader'),support=await register('support');
 const db=new DatabaseSync(dbPath);db.prepare("INSERT INTO staff_access VALUES(?,'admin',?)").run(a.id,new Date().toISOString());db.prepare("INSERT INTO staff_access VALUES(?,'support_staff',?)").run(support.id,new Date().toISOString());db.close();
 const base='/ai/knowledge',source=base+'/sources',id=randomUUID(),expiry=new Date(Date.now()+86400000).toISOString();
 const input={id,title:'Synthetic Ghana recycling guidance',sourceUrl:'https://example.org/guidance',license:'CC0-1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',attribution:'Synthetic test content; no factual integration claim',category:'recycling',language:'en',region:'GH',text:'Separate clean bottles before collection.',expiresAt:expiry,publicContentConfirmed:true};
 await check('Guest and two non-admin account types cannot access Studio or search',async()=>{for(const account of [undefined,b,support])for(const path of [source,base+'/search?q=bottles']){const r=await request(path,{account});assert.equal(r.status,account?403:401);assert.equal(r.cache,'no-store');}});
 await check('Admin source list begins empty; sync and semantic capabilities are honest',async()=>{const r=await ok(source,{account:a});assert.deepEqual(r.sources,[]);assert.equal(r.automaticSync,false);assert.equal(r.semanticSearch,false);});
 await check('CSRF and cross-origin writes fail',async()=>{for(const options of [{csrf:false},{foreign:true}])assert.equal((await request(source,{account:a,method:'POST',body:input,...options})).status,403);});
 await check('Unsupported licences and private-classification attestation fail before writes',async()=>{for(const patch of [{license:'CC-BY-NC-4.0'},{publicContentConfirmed:false},{ownerId:b.id},{sourceUrl:'https://localhost/private'}])assert.equal((await request(source,{account:a,method:'POST',body:{...input,...patch}})).status,400);assert.equal((await ok(source,{account:a})).sources.length,0);});
 await check('Save and identical retry create one durable unpublished source',async()=>{for(let i=0;i<2;i++)assert.equal((await ok(source,{account:a,method:'POST',body:input})).revision,1);assert.equal((await ok(source,{account:a})).sources.length,1);assert.equal((await ok(base+'/search?q=bottles',{account:a})).items.length,0);});
 await check('Exact version review returns original text to admin only',async()=>{assert.equal((await ok(source+'/'+id+'/versions/1',{account:a})).text,input.text);assert.equal((await request(source+'/'+id+'/versions/1',{account:b})).status,403);});
 await check('Publication needs explicit version review; result is linked and versioned',async()=>{assert.equal((await request(source+'/'+id+'/publish',{account:a,method:'POST',body:{revision:1,version:1,reviewed:false}})).status,400);await ok(source+'/'+id+'/publish',{account:a,method:'POST',body:{revision:1,version:1,reviewed:true}});const r=await ok(base+'/search?q=bottles',{account:a});assert.equal(r.items[0].version,1);assert.equal(r.items[0].sourceUrl,input.sourceUrl);assert.equal(r.items[0].excerpt,input.text);assert(!JSON.stringify(r).includes(a.id));});
 await check('Account selectors and unknown mutation fields fail',async()=>{assert.equal((await request(base+'/search?q=bottles&userId='+b.id,{account:a})).status,400);assert.equal((await request(source+'/'+id+'/withdraw?ownerId='+b.id,{account:a,method:'POST',body:{revision:2}})).status,400);});
 await check('New versions stay unpublished and stale edits fail',async()=>{await ok(source+'/'+id+'/versions',{account:a,method:'POST',body:{revision:2,text:'Collect dry metal separately.',expiresAt:expiry,publicContentConfirmed:true}});assert.equal((await request(source+'/'+id+'/withdraw',{account:a,method:'POST',body:{revision:2}})).status,409);assert.equal((await ok(base+'/search?q=bottles',{account:a})).items[0].version,1);});
 await check('Publish replacement and reviewed rollback retain original history',async()=>{await ok(source+'/'+id+'/publish',{account:a,method:'POST',body:{revision:3,version:2,reviewed:true}});assert.equal((await ok(base+'/search?q=bottles',{account:a})).items.length,0);await ok(source+'/'+id+'/publish',{account:a,method:'POST',body:{revision:4,version:1,reviewed:true}});assert.equal((await ok(base+'/search?q=bottles',{account:a})).items[0].version,1);});
 await stop();await start();
 await check('Restart retains source/version/publication',async()=>{assert.equal((await ok(source+'/'+id,{account:a})).publishedVersion,1);});
 await check('Withdrawal immediately removes search results',async()=>{await ok(source+'/'+id+'/withdraw',{account:a,method:'POST',body:{revision:5}});assert.equal((await ok(base+'/search?q=bottles',{account:a})).items.length,0);});
 await stop();await start(false);
 await check('Operator disable fails closed without changing saved data',async()=>{assert.equal((await request(source,{account:a})).status,503);});
 await check('No knowledge text or query appears in server logs',async()=>{assert(!logs.includes(input.text));assert(!logs.includes('q=bottles'));});
}catch(e){failure={name:e.name,message:e.message};}
finally{await stop();await rm(temp,{recursive:true,force:true});}
const result={passed:!failure,checks,failure:failure||null,scope:'Actual isolated HTTP and SQLite; synthetic admin/member/support accounts. No hosted records, provider inference or real-admin acceptance.'};
if(process.env.CHALE_KNOWLEDGE_REPORT)await writeFile(process.env.CHALE_KNOWLEDGE_REPORT,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(failure)process.exitCode=1;

