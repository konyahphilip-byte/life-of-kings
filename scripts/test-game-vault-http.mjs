import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {emptyVault,newProject,checkpointProject,restoreCheckpoint,vaultDigest} from '../shared/game-vault.mjs';
const out=new URL('../work/ecogames-vault-20261108/',import.meta.url);await mkdir(out,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'eco-vault-http-')),db=join(temp,'fixture.sqlite'),checks=[];
let child,origin,logs='',failure;
async function start(disabled=false){
 origin=null;child=spawn(process.execPath,['--import','./scripts/chale-test-provider.mjs','server/index.mjs'],{cwd:new URL('../',import.meta.url),env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',PORT:'0',ECOVIBES_DB_PATH:db,AI_PROVIDER_KEY:'synthetic-chale-http-fixture',OPENAI_ENV_FILE:'',DATABASE_URL:'',SUPABASE_URL:'',CHALE_SMOKE_CAPTURE:join(temp,'unused.jsonl'),ECOVIBES_GAME_VAULT_DISABLED:disabled?'true':'false'},stdio:['ignore','pipe','pipe','ipc']});
 child.on('message',m=>{if(m?.event==='chale-smoke-ready')origin='http://127.0.0.1:'+m.port;});child.stdout.on('data',v=>logs+=v);child.stderr.on('data',v=>logs+=v);
 const deadline=Date.now()+15000;while(!origin&&child.exitCode===null&&Date.now()<deadline)await delay(40);assert(origin,'Isolated API did not start: '+logs.slice(-2000));
}
async function stop(){if(!child||child.exitCode!==null)return;const closed=new Promise(r=>child.once('close',r));child.kill('SIGTERM');await closed;}
async function request(path,method='GET',body,account,headers={}){
 const r=await fetch(origin+'/api/v1'+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(account?{cookie:account.cookie,'X-CSRF-Token':account.csrf}:{}),...headers},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000)});
 return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie'),cache:r.headers.get('cache-control')};
}
async function register(name){const r=await request('/auth/register','POST',{ecoId:name,displayName:name,password:'Synthetic-Test-Only-2026!'});assert.equal(r.status,200);return {id:r.body.user.id,csrf:r.body.csrfToken,cookie:r.cookie.split(';')[0]};}
const check=(condition,name)=>{assert(condition,name);checks.push(name);};
const source='Synthetic-private-vault-needle-Do-Not-Log';
try{
 await start();check((await request('/games/vault')).status===401,'Anonymous source access denied');
 const a=await register('vault_alpha'),b=await register('vault_beta');let p=newProject('Synthetic source');
 p.story='Original story';p.files=[{path:'main.gd',content:source}];let v={...emptyVault(),projects:[p]};
 const operation={expectedOwnerId:a.id,revision:0,operationId:randomUUID(),consent:'private-storage-v1',vault:v};
 const saved=await request('/games/vault','PUT',operation,a);
 check(saved.status===200&&saved.body.revision===1&&saved.body.savedRevision===1,'Real HTTP save confirms persisted revision');
 check(saved.body.sha256===await vaultDigest(v)&&saved.cache==='no-store','Canonical checksum and no-store on private response');
 check((await request('/games/vault','GET',undefined,b)).body.vault.projects.length===0,'Second account cannot retrieve first account source');
 const duplicate=await request('/games/vault','PUT',{...operation,operationId:operation.operationId.toUpperCase()},a);
 check(duplicate.status===200&&duplicate.body.revision===1,'Case-canonical operation retry does not duplicate source save');
 check((await request('/games/vault','PUT',{...operation,expectedOwnerId:a.id},b)).status===409,'Account switch cannot retarget captured source upload');
 check((await request('/games/vault?ownerId='+a.id,'GET',undefined,b)).status===400,'Private account selector rejected');
 check((await request('/games/vault','PUT',operation,a,{'X-CSRF-Token':'wrong'})).status===403,'Wrong CSRF denies source write');
 check((await request('/games/vault','PUT',operation,a,{Origin:'https://unapproved.example'})).status===403,'Unapproved origin denies source write');
 check((await request('/games/vault','PUT',{...operation,expectedOwnerId:b.id,consent:'none'},b)).status===400,'Explicit private-upload consent required');
 check((await request('/games/vault','PUT',{...operation,expectedOwnerId:b.id,vault:{...v,projects:[{...p,files:[{path:'../private.txt',content:source}]}]}},b)).status===400,'Traversal source path denied without partial upload');
 p.files[0].content=source; // The checkpoint is an explicit user-controlled copy.
 p=checkpointProject(p,'Before edit');
 v={...emptyVault(),projects:[p]};check((await request('/games/vault','PUT',{...operation,operationId:randomUUID(),revision:1,vault:v},a)).body.revision===2,'Checkpoint saved only by explicit revision write');
 const edited={...p,story:'Edited story'};v={...emptyVault(),projects:[edited]};
 check((await request('/games/vault','PUT',{...operation,operationId:randomUUID(),revision:2,vault:v},a)).body.revision===3,'Edited project saves another acknowledged revision');
 const restored=restoreCheckpoint(edited,p.checkpoints[0].id);v={...emptyVault(),projects:[restored]};
 check((await request('/games/vault','PUT',{...operation,operationId:randomUUID(),revision:3,vault:v},a)).body.revision===4,'Restoring a checkpoint is a separate durable save');
 const oldRetry=await request('/games/vault','PUT',operation,a);
 check(oldRetry.status===200&&oldRetry.body.savedRevision===1&&oldRetry.body.revision===4,'Old acknowledged retry returns current head without overwriting it');
 check((await request('/games/vault','PUT',{...operation,operationId:randomUUID()},a)).status===409,'Stale draft conflicts instead of replacing newer work');
 await stop();await start();
 const reopened=await request('/games/vault','GET',undefined,a);
 check(reopened.status===200&&reopened.body.vault.projects[0].story==='Original story'&&reopened.body.vault.projects[0].files[0].content===source,'Source and restored Story Bible survive API restart');
 const removed=await request('/games/vault','PUT',{...operation,revision:4,operationId:randomUUID(),vault:emptyVault()},a);
 check(removed.status===200&&removed.body.revision===5&&removed.body.vault.projects.length===0,'Removal confirmed by server, not local UI');
 const sqlite=new DatabaseSync(db);const row=sqlite.prepare('SELECT snapshot_json,receipts_json FROM game_vaults WHERE owner_id=?').get(a.id);sqlite.close();
 check(!JSON.stringify(row).includes(source),'Current row and operation receipts retain no removed raw source');
 check(!logs.includes(source),'Private source absent from captured API logs');
 await stop();await start(true);
 check((await request('/games/vault','GET',undefined,a)).status===503,'Deny-only feature switch disables access while retaining data');
}catch(e){failure=String(e);console.error(e);}
finally{await stop();await rm(temp,{recursive:true,force:true});const report={passed:!failure,checks,failure,scope:'Actual isolated SQLite HTTP API, synthetic accounts/source. Not hosted, physical-device or disk/backups erasure evidence.'};await writeFile(new URL('http.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(failure)process.exitCode=1;}
