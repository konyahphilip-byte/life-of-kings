import {randomUUID} from 'node:crypto';
import {KNOWLEDGE_SOURCE_CATALOG,readKnowledgeSource,sourceHash} from './chale-knowledge-sources.mjs';
export const KNOWLEDGE_SYNC_VERSION='20261107064239_chale_knowledge_sync';
export const KNOWLEDGE_SYNC_SQLITE_SCHEMA = [
 'CREATE TABLE IF NOT EXISTS knowledge_sync_jobs(provider_key TEXT PRIMARY KEY,enabled INTEGER NOT NULL CHECK(enabled IN(0,1)),approval_version TEXT NOT NULL,revision INTEGER NOT NULL,configured_by TEXT NOT NULL REFERENCES users(id),configured_at TEXT NOT NULL,next_at TEXT NOT NULL,lease_id TEXT,lease_until TEXT,last_checked TEXT,last_success TEXT,last_hash TEXT,last_remote_revision TEXT,etag TEXT,last_modified TEXT,latest_snapshot_id TEXT,imported_snapshot_id TEXT,imported_version INTEGER,last_outcome TEXT NOT NULL,failures INTEGER NOT NULL DEFAULT 0,error_code TEXT)',
 'CREATE TABLE IF NOT EXISTS knowledge_sync_snapshots(id TEXT PRIMARY KEY,provider_key TEXT NOT NULL REFERENCES knowledge_sync_jobs(provider_key),body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 20000),content_hash TEXT NOT NULL,remote_revision TEXT NOT NULL,checked_at TEXT NOT NULL,expires_at TEXT NOT NULL)',
 "CREATE TABLE IF NOT EXISTS knowledge_sync_events(id TEXT PRIMARY KEY,provider_key TEXT NOT NULL REFERENCES knowledge_sync_jobs(provider_key),action TEXT NOT NULL CHECK(action IN('configured','leased','staged','unchanged','failed','applied')),actor_id TEXT REFERENCES users(id),snapshot_id TEXT,created_at TEXT NOT NULL,error_code TEXT)",
 'CREATE INDEX IF NOT EXISTS knowledge_sync_due ON knowledge_sync_jobs(enabled,next_at,lease_until)',
 'CREATE INDEX IF NOT EXISTS knowledge_sync_expiry ON knowledge_sync_snapshots(expires_at)',
 'CREATE INDEX IF NOT EXISTS knowledge_sync_event_order ON knowledge_sync_events(provider_key,created_at,id)'
].join(';\n')+';';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const safeCodes=new Set(['unsupported_source','source_timeout','source_redirect','source_busy','source_http','source_format','source_oversized','source_network']);
export function createKnowledgeSync({q,all,run,transaction,assert,requireAdmin,now,knowledge,readSource=readKnowledgeSource,enabled=false,available=false,postgresMode=false}){
 let ticking=null;
 const catalog=key=>{const source=KNOWLEDGE_SOURCE_CATALOG.find(s=>s.key===key);assert(source,404,'sync_source_missing','This approved source is unavailable.');return source;};
 const fields=(input,names)=>assert(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).length===names.length&&names.every(k=>Object.hasOwn(input,k)),400,'invalid_sync_input','Use only the approved source controls.');
 const guard=async ctx=>{await requireAdmin(ctx);assert(enabled&&available,503,'knowledge_sync_unavailable','Automatic knowledge checks are not enabled or their reviewed migration is missing.');};
 const exclusive=work=>transaction(async()=>{if(postgresMode)await q('SELECT pg_advisory_xact_lock(7861108)');return work();});
 const event=async(key,action,actor=null,snapshot=null,code=null)=>{assert(Number((await q('SELECT count(*) n FROM knowledge_sync_events')).n)<10000,409,'sync_capacity','The update audit limit requires retention review.');await run('INSERT INTO knowledge_sync_events(id,provider_key,action,actor_id,snapshot_id,created_at,error_code) VALUES(?,?,?,?,?,?,?)',randomUUID(),key,action,actor,snapshot,now(),code);};
 const job=key=>q('SELECT * FROM knowledge_sync_jobs WHERE provider_key=?',key);
 const snapshot=id=>id?q('SELECT * FROM knowledge_sync_snapshots WHERE id=? AND expires_at>?',id,now()):null;
 const expiry=days=>new Date(Date.parse(now())+days*86400000).toISOString();
 async function status(ctx){
  await guard(ctx);const sources=[];
  for(const definition of KNOWLEDGE_SOURCE_CATALOG){
   const state=await job(definition.key),pending=state?await snapshot(state.latest_snapshot_id):null;
   sources.push({...definition,enabled:Boolean(state?.enabled&&state.approval_version===definition.approvalVersion),revision:Number(state?.revision||0),nextAt:state?.next_at||null,lastChecked:state?.last_checked||null,lastSuccess:state?.last_success||null,outcome:state?.last_outcome||'not_connected',errorCode:state?.error_code||null,importedVersion:state?.imported_version||null,
    pending:pending?{id:pending.id,text:pending.body,contentHash:pending.content_hash,remoteRevision:pending.remote_revision,checkedAt:pending.checked_at,expiresAt:pending.expires_at,applied:state.imported_snapshot_id===pending.id}:null});
  }
  return {sources,automaticPublication:false,modelRetrieval:false,scope:'Fixed public sources only; best-effort checks while the existing API is running. Changed text stays in review.'};
 }
 async function configure(ctx,key,input){
  await guard(ctx);const source=catalog(key);fields(input,['revision','enabled','approved','approvalVersion']);
  assert(Number.isSafeInteger(input.revision)&&input.revision>=0&&typeof input.enabled==='boolean'&&typeof input.approved==='boolean'&&input.approvalVersion===source.approvalVersion&&(!input.enabled||input.approved),400,'sync_approval_required','Review this exact source and its public reuse rights before enabling checks.');
  return exclusive(async()=>{const old=await job(key);assert(Number(old?.revision||0)===input.revision,409,'sync_changed','These source settings changed. Refresh first.');
   if(old)await run('UPDATE knowledge_sync_jobs SET enabled=?,approval_version=?,revision=revision+1,configured_by=?,configured_at=?,lease_id=NULL,lease_until=NULL,error_code=NULL WHERE provider_key=?',Number(input.enabled),source.approvalVersion,ctx.user.id,now(),key);
   else await run("INSERT INTO knowledge_sync_jobs(provider_key,enabled,approval_version,revision,configured_by,configured_at,next_at,last_outcome) VALUES(?,?,?,1,?,?,?,'not_checked')",key,Number(input.enabled),source.approvalVersion,ctx.user.id,now(),now());
   await event(key,'configured',ctx.user.id);return {configured:true,enabled:input.enabled,revision:input.revision+1,scope:'Public fetching only. No version is automatically published.'};
  });
 }
 async function claim(){
  if(!enabled||!available)return null;
  return exclusive(async()=>{
   await run('DELETE FROM knowledge_sync_snapshots WHERE expires_at<=?',now());
   for(const definition of KNOWLEDGE_SOURCE_CATALOG){
    const row=await job(definition.key);if(!row||!row.enabled||row.approval_version!==definition.approvalVersion||row.next_at>now()||(row.lease_until&&row.lease_until>now()))continue;
    const lease=randomUUID(),until=new Date(Date.parse(now())+30000).toISOString();
    await run('UPDATE knowledge_sync_jobs SET lease_id=?,lease_until=? WHERE provider_key=?',lease,until,definition.key);await event(definition.key,'leased');
    return {row,definition,lease,hasSnapshot:Boolean(await snapshot(row.latest_snapshot_id))};
   }return null;
  });
 }
 async function work(){
  const claimed=await claim();if(!claimed)return {checked:false};const {row,definition,lease}=claimed;
  let result,errorCode=null,retrySeconds=0;
  try{result=await readSource(definition.key,claimed.hasSnapshot?{etag:row.etag,lastModified:row.last_modified}:{});if(result.notModified&&!row.last_hash)throw Object.assign(Error('Invalid initial not-modified response'),{code:'source_format'});}
  catch(error){errorCode=safeCodes.has(error?.code)?error.code:'source_network';retrySeconds=Number.isFinite(error?.retrySeconds)?Math.max(0,Math.min(7*86400,error.retrySeconds)):0;}
  return exclusive(async()=>{
   const current=await job(definition.key);if(!current?.enabled||current.revision!==row.revision||current.lease_id!==lease||current.lease_until<=now())return {checked:false,discarded:true};
   if(errorCode){
    const failures=Math.min(current.failures+1,100),seconds=Math.max(retrySeconds,Math.min(86400,900*2**Math.min(failures-1,7)));
    await run("UPDATE knowledge_sync_jobs SET lease_id=NULL,lease_until=NULL,last_checked=?,last_outcome='failed',failures=?,error_code=?,next_at=? WHERE provider_key=?",now(),failures,errorCode,new Date(Date.parse(now())+seconds*1000).toISOString(),definition.key);
    await event(definition.key,'failed',null,null,errorCode);return {checked:true,outcome:'failed',errorCode};
   }
   const previous=await snapshot(current.latest_snapshot_id);let nextId=current.latest_snapshot_id,outcome='unchanged';
   if(!result.notModified&&(!previous||previous.content_hash!==result.contentHash)){
    assert(typeof result.body==='string'&&result.body.length>0&&result.body.length<=20000&&/^[a-f0-9]{64}$/.test(result.contentHash)&&sourceHash(result.body)===result.contentHash,502,'sync_invalid_source','The public source result was not valid.');
    assert(Number((await q('SELECT count(*) n FROM knowledge_sync_snapshots')).n)<50,409,'sync_capacity','The public update cache is full.');
    nextId=randomUUID();await run('INSERT INTO knowledge_sync_snapshots(id,provider_key,body,content_hash,remote_revision,checked_at,expires_at) VALUES(?,?,?,?,?,?,?)',nextId,definition.key,result.body,result.contentHash,result.remoteRevision,now(),expiry(7));outcome='staged';
   }
   await run('UPDATE knowledge_sync_jobs SET lease_id=NULL,lease_until=NULL,last_checked=?,last_success=?,last_hash=?,last_remote_revision=?,etag=?,last_modified=?,latest_snapshot_id=?,last_outcome=?,failures=0,error_code=NULL,next_at=? WHERE provider_key=?',now(),now(),result.contentHash||current.last_hash,result.remoteRevision||current.last_remote_revision,result.etag||null,result.lastModified||null,nextId,outcome,new Date(Date.parse(now())+definition.intervalSeconds*1000).toISOString(),definition.key);
   await event(definition.key,outcome,null,nextId);return {checked:true,outcome};
  });
 }
 function tick(){if(ticking)return ticking;ticking=work().finally(()=>{ticking=null;});return ticking;}
 async function apply(ctx,key,input){
  await guard(ctx);const definition=catalog(key);fields(input,['revision','snapshotId','reviewed']);
  assert(Number.isSafeInteger(input.revision)&&input.revision>0&&typeof input.snapshotId==='string'&&UUID.test(input.snapshotId)&&input.reviewed===true,400,'sync_review_required','Review the exact staged text before saving it as a knowledge draft.');
  const captured=await exclusive(async()=>{const row=await job(key),pending=await snapshot(input.snapshotId);assert(row?.enabled&&row.approval_version===definition.approvalVersion&&row.revision===input.revision&&row.latest_snapshot_id===input.snapshotId&&pending?.provider_key===key,409,'sync_changed','The staged source changed, expired or was paused. Refresh and review again.');assert(!row.lease_until||row.lease_until<=now(),409,'sync_busy','A source check is processing. Refresh after it finishes.');const lease=randomUUID();await run('UPDATE knowledge_sync_jobs SET lease_id=?,lease_until=? WHERE provider_key=?',lease,new Date(Date.parse(now())+30000).toISOString(),key);return {pending,lease};});
  try{
   await requireAdmin(ctx);let existing;try{existing=await knowledge.read(ctx,definition.sourceId);}catch(error){if(error.code!=='knowledge_not_found')throw error;}
   if(existing){
    assert(['title','sourceUrl','license','licenseUrl','attribution','category','language','region'].every(k=>existing[k]===definition[k]),409,'sync_source_conflict','The canonical source metadata differs. No source was overwritten.');
    await knowledge.revise(ctx,definition.sourceId,{revision:existing.revision,text:captured.pending.body,expiresAt:captured.pending.expires_at,publicContentConfirmed:true});
   }else{
    const {title,sourceUrl,license,licenseUrl,attribution,category,language,region}=definition;
    await knowledge.create(ctx,{id:definition.sourceId,title,sourceUrl,license,licenseUrl,attribution,category,language,region,text:captured.pending.body,expiresAt:captured.pending.expires_at,publicContentConfirmed:true});
   }
   const detail=await knowledge.read(ctx,definition.sourceId),version=detail.versions.find(v=>v.contentHash===captured.pending.content_hash&&v.expiresAt===captured.pending.expires_at);
   assert(version,409,'sync_changed','The draft result needs verification in the source history.');
   return await exclusive(async()=>{const current=await job(key);assert(current?.lease_id===captured.lease&&current.lease_until>now()&&current.enabled&&current.revision===input.revision,409,'sync_changed','Settings changed. A draft may have been stored; refresh the source before retrying.');await run('UPDATE knowledge_sync_jobs SET imported_snapshot_id=?,imported_version=?,lease_id=NULL,lease_until=NULL WHERE provider_key=?',input.snapshotId,version.version,key);await event(key,'applied',ctx.user.id,input.snapshotId);return {sourceId:definition.sourceId,version:version.version,savedAsDraft:true,publishedVersion:detail.publishedVersion,scope:'Draft saved. Publication remains a separate exact-version approval.'};});
  }finally{await run('UPDATE knowledge_sync_jobs SET lease_id=NULL,lease_until=NULL WHERE provider_key=? AND lease_id=?',key,captured.lease);}
 }
 async function route(ctx,method,path,body,query){
  await guard(ctx);assert(query.size===0,400,'invalid_sync_query','Source updates accept no account selectors or URLs.');
  if(path==='/ai/knowledge/sync'&&method==='GET')return status(ctx);
  if(path==='/ai/knowledge/sync/check'&&method==='POST'){fields(body,[]);return tick();}
  const match=path.match(/^\/ai\/knowledge\/sync\/([a-z0-9-]+)\/(settings|apply)$/);
  if(match&&method==='POST'){if(match[2]==='settings')return configure(ctx,match[1],body);return apply(ctx,match[1],body);}
  assert(false,404,'sync_route_missing','This source update action is unavailable.');
 }
 return {status,configure,apply,tick,route};
}

