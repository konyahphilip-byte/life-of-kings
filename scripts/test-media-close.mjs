// Actual EcoVibes API and SDK transport; synthetic local provider, no real media.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
let providerAccepts=false,providerCalls=0,child,db,failure=null;const checks=[];
const directory=await mkdtemp(join(tmpdir(),'ecovibes-media-close-'));
const provider=createServer((req,res)=>{if(req.url!=='/twirp/livekit.RoomService/DeleteRoom'){res.writeHead(404);res.end();return;}providerCalls++;req.resume();res.writeHead(providerAccepts?200:403,{'content-type':'application/json'});res.end(JSON.stringify(providerAccepts?{}:{code:'permission_denied',msg:'Synthetic provider refusal'}));});
await new Promise(r=>provider.listen(0,'127.0.0.1',r));const providerOrigin=`http://127.0.0.1:${provider.address().port}`;
let origin;const allowedOrigin='http://127.0.0.1',database=join(directory,'synthetic.sqlite');
async function request(path,account,method='GET',body,headers={}){const r=await fetch(origin+'/api/v1'+path,{method,signal:AbortSignal.timeout(5000),headers:{Origin:allowedOrigin,'Content-Type':'application/json',...(account?{Cookie:account.cookie,'X-CSRF-Token':account.csrf}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function signup(ecoId){const r=await request('/auth/register',null,'POST',{ecoId,displayName:ecoId,password:'Synthetic-media-close-password-123'});assert.equal(r.status,200);return{id:r.body.user.id,cookie:r.cookie,csrf:r.body.csrfToken};}
function check(condition,name){assert(condition,name);checks.push(name);}
try{
 child=spawn(process.execPath,['--import','./scripts/chale-test-provider.mjs','server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',PORT:'0',ECOVIBES_DB_PATH:database,APP_ORIGINS:allowedOrigin,DATABASE_URL:'',SUPABASE_URL:'',OPENAI_ENV_FILE:'',ECOVIBES_SERVE_WEB:'false',AI_PROVIDER_KEY:'synthetic-chale-http-fixture',CHALE_SMOKE_CAPTURE:join(directory,'unused.jsonl'),LIVEKIT_URL:providerOrigin,LIVEKIT_API_KEY:'synthetic-local-key',LIVEKIT_API_SECRET:'synthetic-only-secret-never-used-elsewhere'},stdio:['ignore','ignore','ignore','ipc']});
 child.on('message',m=>{if(m?.event==='chale-smoke-ready'&&Number.isInteger(m.port)&&m.port>0&&m.port<=65535)origin=`http://127.0.0.1:${m.port}`;});
 let ready=false;for(let n=0;n<60;n++){if(child.exitCode!==null)throw Error('Isolated API exited');if(origin)try{ready=(await request('/health')).status===200;}catch{}if(ready)break;await delay(100);}assert(ready&&origin,'Owned isolated API did not start');check(true,'Owned child IPC confirms listener before any account writes');
 const host=await signup('media_close_host'),stranger=await signup('media_close_other');db=new DatabaseSync(database);
 const id=randomUUID(),room='ev-'+id,stamp=new Date().toISOString();
 db.prepare("INSERT INTO media_sessions(id,room_name,creator_id,mode,title,visibility,status,created_at) VALUES(?,?,?,'live','Synthetic room only','public','active',?)").run(id,room,host.id,stamp);
 const path='/media/sessions/'+id+'/end';
 check((await request('/media/status')).body.privateCallsConfigured===false,'Configured media credentials do not enable private calling');
 check((await request(path,null,'POST',{})).status===401,'Anonymous ending denied');
 check((await request(path,stranger,'POST',{})).status===403,'Unrelated account ending denied');
 check((await request(path,host,'POST',{}, {'X-CSRF-Token':'wrong'})).status===403,'Wrong CSRF ending denied');
 check(providerCalls===0,'Rejected actions never reach the media provider');
 const refused=await request(path,host,'POST',{});
 check(refused.status===503&&refused.body.error?.code==='media_end_unconfirmed','Provider refusal must not claim the room ended');
 check(db.prepare('SELECT status FROM media_sessions WHERE id=?').get(id).status==='active','Unconfirmed ending preserves a retryable room record');
 check(db.prepare("SELECT count(*) n FROM audit_logs WHERE action='MEDIA_SESSION_ENDED' AND target_id=?").get(id).n===0,'Unconfirmed ending creates no success audit');
 providerAccepts=true;const confirmed=await request(path,host,'POST',{});
 check(confirmed.status===200&&confirmed.body.status==='ended','Only acknowledged deletion reports an ended room');
 check(db.prepare('SELECT status,ended_at FROM media_sessions WHERE id=?').get(id).ended_at!==null,'Acknowledged ending persists its timestamp');
 check(db.prepare("SELECT count(*) n FROM audit_logs WHERE action='MEDIA_SESSION_ENDED' AND target_id=?").get(id).n===1,'Acknowledged ending records one success audit');
 check((await request('/media/sessions/'+id+'/join',host,'POST',{})).status===404,'Ended room refuses new application join tokens');
 check((await request(path,host,'POST',{})).status===404,'Closed room cannot be ended again through a stale action');
 check(providerCalls===2,'Failed close can be retried once without unauthorized extra provider calls');
}catch(error){failure=error.stack||String(error);process.exitCode=1;}
finally{
 db?.close();if(child&&child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await Promise.race([done,delay(2000)]);if(child.exitCode===null){child.kill('SIGKILL');await done;}}
 provider.closeAllConnections();await new Promise(r=>provider.close(r));await rm(directory,{recursive:true,force:true});
 const paths=['server/index.mjs','scripts/test-media-close.mjs'];const sourceHashes=Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex')])));
 const report={at:new Date().toISOString(),success:!failure,checks,failure,sourceHashes,scope:'Local real API + SDK HTTP, synthetic provider and accounts. No actual LiveKit server, physical media, hosted source change or production activation.'};
 if(process.env.MEDIA_CLOSE_REPORT)await writeFile(process.env.MEDIA_CLOSE_REPORT,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
