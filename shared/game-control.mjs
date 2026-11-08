// Shared boundary for manual workspace records. Evidence links never grant release authority.
export const COLLECTIONS=['milestones','tests','builds','compatibility','submissions','changes'];
export const PLATFORMS=['iOS / iPadOS','Android','macOS','Windows','Web'];
export const MAX_WORKSPACE_BYTES=128000;
const fields=new Set(['id','title','group','status','owner','nextAction','description','confidence','provenance','evidence','lastChecked','dependency','blocker','notes','device','buildVersion','caseId','compatId','version','platform','channel','commit','artifact','deployment','creatorName','packageUrl','rights','action','details','actor','at','refId','type','createdAt','updatedAt','projectId']);
const links=new Set(['evidence','artifact','deployment','packageUrl']);
const proof=new Set(['Verified','Ready for release','Pass','Approved','Published','Deployed']);
export const STATUSES=['Unknown','Locally built but unverified','Blocked','Needs retest','Verified','Ready for release','Untested','Pass','Fail','Not started','Testing','Failed','Deployed','Rolled back','Draft','Submitted','In review','Changes requested','Approved','Published','Rejected','Archived','Under review','Sandbox testing'];
const statuses=new Set(STATUSES);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const bad=message=>{throw new Error(message);};
export function emptyWorkspace(){return {schema:'ecovibes-games-control-hub-v1',...Object.fromEntries(COLLECTIONS.map(k=>[k,[]]))};}
export function safeEvidenceURL(value){
 try{const u=new URL(value);return typeof value==='string'&&u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!!u.hostname;}catch{return false;}
}
export function normalizeWorkspace(value){
 if(typeof value==='string'){if(new TextEncoder().encode(value).length>MAX_WORKSPACE_BYTES)bad('Workspace exceeds 128 KB.');try{value=JSON.parse(value);}catch{bad('Import must contain valid JSON.');}}
 if(!object(value)||value.schema!=='ecovibes-games-control-hub-v1'||Object.keys(value).some(k=>!['schema','exportedAt','provenance',...COLLECTIONS].includes(k)))bad('Choose an EcoVibes Control Hub export without account or approval fields.');
 const result=emptyWorkspace();let count=0;
 for(const kind of COLLECTIONS){
  const list=value[kind]??[];if(!Array.isArray(list))bad(kind+' must be a record list.');
  const ids=new Set();
  result[kind]=list.map(raw=>{
   if(++count>100)bad('This pilot supports 100 records per workspace.');
   if(!object(raw)||Object.keys(raw).some(k=>!fields.has(k)))bad('Record contains unsupported fields.');
   const r={};
   for(const k of Object.keys(raw).sort()){
    if(typeof raw[k]!=='string'||raw[k].length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(raw[k]))bad('Record fields must be plain text up to 2000 characters.');
    r[k]=raw[k].trim();
    if(links.has(k)&&r[k]&&!safeEvidenceURL(r[k]))bad('Evidence must use HTTPS without a password or query credentials.');
   }
   if(!/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/.test(r.id??'')||ids.has(r.id))bad('Each record needs a unique stable ID.');ids.add(r.id);
   if(kind!=='changes'&&!statuses.has(r.status))bad('Choose a supported evidence status.');
   if(![r.title,r.version,r.caseId,r.action].some(v=>typeof v==='string'&&v.length>0))bad('Record needs a title, build version, test case or change title.');
   if(r.lastChecked&&(!/^\d{4}-\d{2}-\d{2}T/.test(r.lastChecked)||!Number.isFinite(Date.parse(r.lastChecked))))bad('Last checked must be an ISO timestamp.');
   if(proof.has(r.status)){
    if(!safeEvidenceURL(r.evidence)||!r.owner||r.owner==='Unassigned'||!r.lastChecked)bad('Claimed results require an evidence URL, named owner and timestamp.');
    if(kind==='tests'&&(!r.device||!r.buildVersion))bad('A passing test needs its actual device and build ID.');
   }
   return r;
  });
 }
 if(new TextEncoder().encode(JSON.stringify(result)).length>MAX_WORKSPACE_BYTES)bad('Workspace exceeds 128 KB.');
 return result;
}
export function mergeImport(current,incoming){
 const a=normalizeWorkspace(current),b=normalizeWorkspace(incoming),result=emptyWorkspace();
 for(const kind of COLLECTIONS){
  const map=new Map(a[kind].map(r=>[r.id,r]));
  for(const record of b[kind]){
   if(map.has(record.id)&&JSON.stringify(map.get(record.id))!==JSON.stringify(record))bad('Import conflict for '+record.id+'. Existing records were not changed.');
   map.set(record.id,record);
  }
  result[kind]=[...map.values()];
 }
 return normalizeWorkspace(result);
}
export function advisoryGate(input,platforms=PLATFORMS,clock=Date.now()){
 const w=normalizeWorkspace(input),failures=[];
 const evidenced=r=>proof.has(r.status)&&safeEvidenceURL(r.evidence)&&r.owner&&r.owner!=='Unassigned'&&Number.isFinite(Date.parse(r.lastChecked))&&Date.parse(r.lastChecked)<=clock+300000&&clock-Date.parse(r.lastChecked)<=30*86400000;
 if(!w.milestones.length||w.milestones.some(r=>!['Verified','Ready for release'].includes(r.status)||!evidenced(r)))failures.push('Milestone evidence is missing, stale or incomplete.');
 for(const platform of platforms){
  const builds=w.builds.filter(r=>r.platform===platform&&['Ready for release','Deployed'].includes(r.status)&&r.version&&evidenced(r));
  const matching=builds.some(build=>Array.from({length:12},(_,i)=>'A'+String(i+1).padStart(2,'0')).every(caseId=>w.tests.some(t=>t.caseId===caseId&&t.platform===platform&&t.buildVersion===build.version&&(t.projectId??'legacy')===(build.projectId??'legacy')&&t.status==='Pass'&&t.device&&evidenced(t))));
  if(!matching)failures.push(platform+': twelve current device checks must reference one evidenced release build.');
 }
 return {ready:failures.length===0,failures,authority:'advisory-only'};
}

// The backup is the canonical bounded payload: no pretty-print or envelope growth.
export function serializeWorkspace(value){return JSON.stringify(normalizeWorkspace(value));}
