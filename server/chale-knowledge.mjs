import {createHash,randomUUID} from 'node:crypto';
import {isIP} from 'node:net';
export const KNOWLEDGE_VERSION='20261106184616_chale_knowledge_studio';
export const KNOWLEDGE_SQLITE_SCHEMA="CREATE TABLE IF NOT EXISTS knowledge_sources(\n id TEXT PRIMARY KEY,title TEXT NOT NULL,source_url TEXT NOT NULL,license TEXT NOT NULL,\n license_url TEXT NOT NULL,attribution TEXT NOT NULL,category TEXT NOT NULL,language TEXT NOT NULL,region TEXT NOT NULL,\n revision INTEGER NOT NULL CHECK(revision>=1),current_version INTEGER,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL\n);\nCREATE TABLE IF NOT EXISTS knowledge_versions(\n source_id TEXT NOT NULL REFERENCES knowledge_sources(id),version INTEGER NOT NULL CHECK(version>0 AND version<=10),\n content_hash TEXT NOT NULL,body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 20000),\n checked_at TEXT NOT NULL,expires_at TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,\n PRIMARY KEY(source_id,version),UNIQUE(source_id,content_hash,expires_at)\n);\nCREATE TABLE IF NOT EXISTS knowledge_chunks(\n source_id TEXT NOT NULL,version INTEGER NOT NULL,ordinal INTEGER NOT NULL,body TEXT NOT NULL,search_text TEXT NOT NULL,\n PRIMARY KEY(source_id,version,ordinal),FOREIGN KEY(source_id,version) REFERENCES knowledge_versions(source_id,version)\n);\nCREATE TABLE IF NOT EXISTS knowledge_events(\n id TEXT PRIMARY KEY,source_id TEXT NOT NULL REFERENCES knowledge_sources(id),version INTEGER,\n action TEXT NOT NULL CHECK(action IN ('created','revised','published','withdrawn')),\n actor_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS knowledge_live_sources ON knowledge_sources(category,language,region,current_version);\nCREATE INDEX IF NOT EXISTS knowledge_version_expiry ON knowledge_versions(expires_at);\n";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const licenses=new Set(['CC0-1.0','CC-BY-4.0','ECOVIBES-OWNED']);
const fold=value=>value.normalize('NFKC').toLowerCase();
const hash=value=>createHash('sha256').update(value).digest('hex');
const stamp=value=>value instanceof Date?value.toISOString():value;
const chunks=text=>Array.from({length:Math.ceil(text.length/1200)},(_,i)=>text.slice(i*1200,(i+1)*1200));
// Public reviewed text only. There is no URL fetch, embedding or model call here.
export function createKnowledgeService({q,all,run,transaction,assert,requireAdmin,now,enabled=false,available=false,postgresMode=false}){
 const keys=(body,allowed)=>assert(body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).every(k=>allowed.includes(k))&&allowed.every(k=>Object.hasOwn(body,k)),400,'invalid_knowledge_input','Use the Knowledge Studio fields only.');
 const text=(value,max,min=1)=>{assert(typeof value==='string'&&value.trim().length>=min&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),400,'invalid_knowledge_text','Use bounded plain text without control characters.');return value.trim().normalize('NFC');};
 const url=value=>{text(value,1000);let u;try{u=new URL(value);}catch{}assert(u&&u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&!u.port&&!isIP(u.hostname)&&/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(u.hostname)&&!/(^|\.)(localhost|local|internal|test|invalid|example)$/i.test(u.hostname),400,'invalid_source_url','Use a public HTTPS source address without account details or query parameters.');return u.href;};
 const expiry=value=>{const v=text(value,24);const ms=Date.parse(v),start=Date.parse(now());assert(Number.isFinite(ms)&&new Date(ms).toISOString()===v&&ms>start&&ms-start<=366*86400000,400,'invalid_knowledge_expiry','Choose a future UTC expiry within one year.');return v;};
 const revision=value=>assert(Number.isSafeInteger(value)&&value>=1,400,'invalid_knowledge_revision','Refresh this source before editing.');
 const guard=async ctx=>{await requireAdmin(ctx);assert(enabled&&available,503,'knowledge_unavailable','Knowledge Studio is not enabled or its reviewed migration is missing.');};
 const ident=id=>assert(typeof id==='string'&&UUID.test(id),400,'invalid_source_id','Use a valid source identifier.');
 const map=s=>({id:s.id,title:s.title,sourceUrl:s.source_url,license:s.license,licenseUrl:s.license_url,attribution:s.attribution,category:s.category,language:s.language,region:s.region,revision:Number(s.revision),publishedVersion:s.current_version===null?null:Number(s.current_version),createdAt:stamp(s.created_at)});
 async function row(id){ident(id);const s=await q('SELECT * FROM knowledge_sources WHERE id=?',id);assert(s,404,'knowledge_not_found','This knowledge source is unavailable.');return s;}
 async function lock(id,expected){revision(expected);assert((await run('UPDATE knowledge_sources SET revision=revision WHERE id=? AND revision=?',id,expected)).changes===1,409,'knowledge_changed','This source changed. Refresh before continuing.');return row(id);}
 async function addVersion(ctx,id,version,body,end){
  const time=now();await run('INSERT INTO knowledge_versions(source_id,version,content_hash,body,checked_at,expires_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)',id,version,hash(body),body,time,end,ctx.user.id,time);
  for(const [i,part] of chunks(body).entries())await run('INSERT INTO knowledge_chunks(source_id,version,ordinal,body,search_text) VALUES(?,?,?,?,?)',id,version,i,part,fold(part));
 }
 const event=(ctx,sourceId,version,action)=>run('INSERT INTO knowledge_events(id,source_id,version,action,actor_id,created_at) VALUES(?,?,?,?,?,?)',randomUUID(),sourceId,version,action,ctx.user.id,now());
 async function list(ctx,query){
  await guard(ctx);assert(query&&Object.keys(query).every(k=>k==='after'),400,'invalid_knowledge_query','Use source pagination only.');if(query.after)ident(query.after);
  const rows=await all('SELECT * FROM knowledge_sources WHERE id>? ORDER BY id LIMIT 51',query.after||'00000000-0000-0000-0000-000000000000');return {sources:rows.slice(0,50).map(map),hasMore:rows.length>50,after:rows.length>50?rows[49].id:null,automaticSync:false,semanticSearch:false};
 }
 async function read(ctx,id){
  await guard(ctx);const s=await row(id);const versions=await all('SELECT version,content_hash,checked_at,expires_at,created_at FROM knowledge_versions WHERE source_id=? ORDER BY version DESC LIMIT 20',id);
  const events=await all('SELECT id,version,action,created_at FROM knowledge_events WHERE source_id=? ORDER BY created_at DESC,id DESC LIMIT 40',id);
  return {...map(s),versions:versions.map(v=>({version:Number(v.version),contentHash:v.content_hash,checkedAt:stamp(v.checked_at),expiresAt:stamp(v.expires_at),createdAt:stamp(v.created_at)})),events:events.map(e=>({id:e.id,version:e.version===null?null:Number(e.version),action:e.action,createdAt:stamp(e.created_at)}))};
 }
 async function readVersion(ctx,id,version){
  await guard(ctx);await row(id);revision(version);const v=await q('SELECT version,body,content_hash,checked_at,expires_at FROM knowledge_versions WHERE source_id=? AND version=?',id,version);assert(v,404,'knowledge_not_found','This version is unavailable.');return {version:Number(v.version),text:v.body,contentHash:v.content_hash,checkedAt:stamp(v.checked_at),expiresAt:stamp(v.expires_at)};
 }
 async function create(ctx,input){
  await guard(ctx);keys(input,['id','title','sourceUrl','license','licenseUrl','attribution','category','language','region','text','expiresAt','publicContentConfirmed']);ident(input.id);
  const meta={title:text(input.title,180),sourceUrl:url(input.sourceUrl),license:input.license,licenseUrl:url(input.licenseUrl),attribution:text(input.attribution,500),category:text(input.category,48),language:text(input.language,24),region:text(input.region,16)};
  assert(licenses.has(meta.license)&&/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(meta.language)&&/^(GLOBAL|[A-Z]{2})$/.test(meta.region),400,'unsupported_knowledge_metadata','Choose an approved commercial-use licence, language tag and region.');
  assert(input.publicContentConfirmed===true,400,'knowledge_review_required','Confirm public reuse rights and absence of private records before saving.');const body=text(input.text,20000),end=expiry(input.expiresAt);
  return transaction(async()=>{
   // Serialize rare admin source creation so identical retries and the pilot cap agree across API workers.
   if(postgresMode)await q('SELECT pg_advisory_xact_lock(7861106)');
   const existing=await q('SELECT * FROM knowledge_sources WHERE id=?',input.id);
   if(existing){const first=await q('SELECT content_hash,expires_at FROM knowledge_versions WHERE source_id=? AND version=1',input.id);assert(Object.entries(meta).every(([k,v])=>map(existing)[k]===v)&&first.content_hash===hash(body)&&stamp(first.expires_at)===end,409,'knowledge_retry_changed','This identifier already belongs to another source.');return map(existing);}
   assert(Number((await q('SELECT count(*) n FROM knowledge_sources')).n)<20,409,'knowledge_pilot_capacity','The reviewed pilot source limit has been reached.');
   await run('INSERT INTO knowledge_sources(id,title,source_url,license,license_url,attribution,category,language,region,revision,current_version,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,1,NULL,?,?)',input.id,meta.title,meta.sourceUrl,meta.license,meta.licenseUrl,meta.attribution,meta.category,meta.language,meta.region,ctx.user.id,now());
   await addVersion(ctx,input.id,1,body,end);await event(ctx,input.id,1,'created');return map(await row(input.id));
  });
 }
 async function revise(ctx,id,input){
  await guard(ctx);keys(input,['revision','text','expiresAt','publicContentConfirmed']);ident(id);revision(input.revision);
  assert(input.publicContentConfirmed===true,400,'knowledge_review_required','Confirm this new text is licensed public content.');const body=text(input.text,20000),end=expiry(input.expiresAt);
  return transaction(async()=>{await lock(id,input.revision);const existing=await q('SELECT version FROM knowledge_versions WHERE source_id=? AND content_hash=? AND expires_at=?',id,hash(body),end);if(existing)return read(ctx,id);
   const latest=Number((await q('SELECT max(version) n FROM knowledge_versions WHERE source_id=?',id)).n);assert(latest<10,409,'knowledge_version_capacity','This pilot retains at most10 source versions; export and retention review are needed.');
   await addVersion(ctx,id,latest+1,body,end);await run('UPDATE knowledge_sources SET revision=revision+1 WHERE id=?',id);await event(ctx,id,latest+1,'revised');return read(ctx,id);
  });
 }
 async function publish(ctx,id,input){
  await guard(ctx);keys(input,['revision','version','reviewed']);ident(id);revision(input.revision);revision(input.version);assert(input.reviewed===true,400,'knowledge_review_required','Review this exact version and its licence before publishing.');
  return transaction(async()=>{const s=await lock(id,input.revision);const v=await q('SELECT version FROM knowledge_versions WHERE source_id=? AND version=? AND expires_at>?',id,input.version,now());assert(v,409,'knowledge_expired','This version is missing or expired; add reviewed current text first.');if(Number(s.current_version)===input.version)return map(s);
   await run('UPDATE knowledge_sources SET current_version=?,revision=revision+1 WHERE id=?',input.version,id);await event(ctx,id,input.version,'published');return map(await row(id));
  });
 }
 async function withdraw(ctx,id,input){
  await guard(ctx);keys(input,['revision']);ident(id);return transaction(async()=>{const s=await lock(id,input.revision);if(s.current_version===null)return map(s);await run('UPDATE knowledge_sources SET current_version=NULL,revision=revision+1 WHERE id=?',id);await event(ctx,id,s.current_version,'withdrawn');return map(await row(id));});
 }
 async function search(ctx,query){
  await guard(ctx);assert(query&&Object.keys(query).every(k=>['q','language','category','region'].includes(k)),400,'invalid_knowledge_query','Use only the supported public knowledge filters.');
  const terms=[...new Set(fold(text(query.q,200,2)).match(/[\p{L}\p{N}]{2,40}/gu)||[])].slice(0,6);assert(terms.length,400,'invalid_knowledge_query','Enter a searchable word.');
  const filters=[];for(const [key,max] of [['language',24],['category',48],['region',16]])if(query[key]){filters.push([key,text(query[key],max)]);}
  const where=terms.map(()=> 'c.search_text LIKE ?').join(' OR ');
  const rows=await all(`SELECT s.id,s.title,s.source_url,s.license,s.license_url,s.attribution,s.category,s.language,s.region,v.version,v.content_hash,v.checked_at,v.expires_at,c.ordinal,c.body,c.search_text FROM knowledge_sources s JOIN knowledge_versions v ON v.source_id=s.id AND v.version=s.current_version JOIN knowledge_chunks c ON c.source_id=v.source_id AND c.version=v.version WHERE v.expires_at>? AND (${where}) ${filters.map(([k])=>'AND s.'+k+'=?').join(' ')} ORDER BY v.checked_at DESC,s.id,c.ordinal LIMIT 201`,now(),...terms.map(t=>'%'+t+'%'),...filters.map(([,v])=>v));
  const ranked=rows.slice(0,200).map(r=>({r,score:terms.reduce((n,t)=>n+(r.search_text.includes(t)?1:0)+(fold(r.title).includes(t)?2:0),0)})).sort((a,b)=>b.score-a.score||stamp(b.r.checked_at).localeCompare(stamp(a.r.checked_at))||a.r.id.localeCompare(b.r.id)||Number(a.r.ordinal)-Number(b.r.ordinal));
  const seen=new Set(),items=[];for(const {r} of ranked){if(seen.has(r.id))continue;seen.add(r.id);items.push({sourceId:r.id,version:Number(r.version),chunk:Number(r.ordinal),title:r.title,sourceUrl:r.source_url,license:r.license,licenseUrl:r.license_url,attribution:r.attribution,category:r.category,language:r.language,region:r.region,contentHash:r.content_hash,checkedAt:stamp(r.checked_at),expiresAt:stamp(r.expires_at),excerpt:r.body});if(items.length===3)break;}
  return {mode:'keyword',items,candidatesTruncated:rows.length>200,checkedAt:now(),scope:'Reviewed public text; no private account records, automatic web search, embeddings or model inference.'};
 }
 async function route(ctx,method,path,body,query){
  if(method==='POST')assert(query.size===0,400,'invalid_knowledge_query','No account selectors are accepted.');
  if(path==='/ai/knowledge/sources'&&method==='GET')return list(ctx,Object.fromEntries(query));
  if(path==='/ai/knowledge/sources'&&method==='POST')return create(ctx,body);
  if(path==='/ai/knowledge/search'&&method==='GET')return search(ctx,Object.fromEntries(query));
  const versionMatch=path.match(/^\/ai\/knowledge\/sources\/([a-f0-9-]+)\/versions\/([1-9][0-9]?)$/i);
  if(versionMatch&&method==='GET'){assert(query.size===0,400,'invalid_knowledge_query','No account selectors are accepted.');return readVersion(ctx,versionMatch[1],Number(versionMatch[2]));}
  const match=path.match(/^\/ai\/knowledge\/sources\/([a-f0-9-]+)(?:\/(versions|publish|withdraw))?$/i);
  if(match&&method==='GET'&&!match[2]){assert(query.size===0,400,'invalid_knowledge_query','No account selectors are accepted.');return read(ctx,match[1]);}
  if(match&&method==='POST'){assert(query.size===0,400,'invalid_knowledge_query','No account selectors are accepted.');if(match[2]==='versions')return revise(ctx,match[1],body);if(match[2]==='publish')return publish(ctx,match[1],body);if(match[2]==='withdraw')return withdraw(ctx,match[1],body);}
  await guard(ctx);assert(false,404,'knowledge_route_missing','This Knowledge Studio action is unavailable.');
 }
 return {list,read,readVersion,create,revise,publish,withdraw,search,route};
}

