import {createHash} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const TRACKING_VERSION='20261029210000_job_tracking';
export const TRACKING_LIMITS=Object.freeze({sessionMs:30*60_000,staleMs:30_000,retentionMs:90_000,minPointMs:3000,maxAgeMs:30_000,maxFutureMs:15_000,maxAccuracy:1000});
export const TRACKING_SQLITE_SCHEMA=`
CREATE TABLE IF NOT EXISTS job_tracking_current(
 job_id TEXT PRIMARY KEY REFERENCES jobs(id),session_id TEXT NOT NULL UNIQUE,customer_id TEXT NOT NULL REFERENCES users(id),collector_id TEXT NOT NULL REFERENCES users(id),provider_revision INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('active','paused','stopped','revoked','expired')),started_at TEXT NOT NULL,expires_at TEXT NOT NULL,
 sequence INTEGER NOT NULL DEFAULT 0 CHECK(sequence>=0),latitude REAL,longitude REAL,accuracy REAL,captured_at TEXT,received_at TEXT,point_hash TEXT,
 CHECK(latitude IS NULL OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND accuracy BETWEEN 0 AND 1000)),
 CHECK((latitude IS NULL AND longitude IS NULL AND accuracy IS NULL AND captured_at IS NULL AND point_hash IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND accuracy IS NOT NULL AND captured_at IS NOT NULL AND point_hash IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS job_tracking_operations(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES jobs(id),collector_id TEXT NOT NULL REFERENCES users(id),request_hash TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS job_tracking_expiry ON job_tracking_current(expires_at);
CREATE INDEX IF NOT EXISTS job_tracking_operations_expiry ON job_tracking_operations(created_at);`;
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const timestamp=value=>value instanceof Date?value.getTime():Date.parse(value);
const clearPoint='latitude=NULL,longitude=NULL,accuracy=NULL,captured_at=NULL,point_hash=NULL';
export function createJobTracking({q,run,transaction,assert,now,event,rateLimit,postgresMode,available=false,disabled=false}){
 const millis=()=>Date.parse(now());
 const shape=(body,keys)=>body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).length===keys.length&&Object.keys(body).every(k=>keys.includes(k));
 async function lockJob(actor,jobId){
  // NO KEY UPDATE serializes profile approval/account suspension while remaining
  // compatible with FK KEY SHARE taken by existing job notification writes.
  const peek=await q('SELECT customer_id,assigned_provider_id FROM jobs WHERE id=?',jobId);
  assert(peek&&(actor===peek.customer_id||actor===peek.assigned_provider_id),404,'tracking_unavailable','This collection location is unavailable.');
  for(const userId of [...new Set([peek.customer_id,peek.assigned_provider_id].filter(Boolean))].sort()){
   const user=await q(`SELECT id,status FROM users WHERE id=?${postgresMode?' FOR NO KEY UPDATE':''}`,userId);
   assert(user?.status==='active',404,'tracking_unavailable','This collection location is unavailable.');
  }
  const job=await q(`SELECT * FROM jobs WHERE id=?${postgresMode?' FOR UPDATE':''}`,jobId);
  assert(job&&job.category==='Waste & Recycling'&&(actor===job.customer_id||actor===job.assigned_provider_id),404,'tracking_unavailable','This collection location is unavailable.');
  assert(job.customer_id===peek.customer_id&&job.assigned_provider_id===peek.assigned_provider_id,409,'assignment_changed','This collection assignment changed. Refresh it.');
  const profile=job.assigned_provider_id?await q(`SELECT p.revision FROM provider_profiles p JOIN users u ON u.id=p.user_id
    WHERE p.user_id=? AND p.verification_state='approved' AND u.status='active'
    AND EXISTS(SELECT 1 FROM roles r WHERE r.user_id=p.user_id AND r.role='provider')
    AND EXISTS(SELECT 1 FROM verification_requests v WHERE v.user_id=p.user_id AND v.target_role='provider' AND v.business_type='Waste services provider' AND v.profile_version=p.revision AND v.status='approved')`,job.assigned_provider_id):null;
  const blocked=job.assigned_provider_id?await q('SELECT 1 ok FROM people_friendships WHERE ((low_user_id=? AND high_user_id=?) OR (high_user_id=? AND low_user_id=?)) AND (low_blocked=1 OR high_blocked=1)',job.customer_id,job.assigned_provider_id,job.customer_id,job.assigned_provider_id):null;
  return{job,role:actor===job.customer_id?'customer':'collector',profile,eligible:Boolean(profile&&!blocked&&['assigned','in_progress'].includes(job.status)&&!disabled)};
 }
 async function current(jobId){return q(`SELECT * FROM job_tracking_current WHERE job_id=?${postgresMode?' FOR UPDATE':''}`,jobId);}
 async function revoke(jobId){if(available)await run(`UPDATE job_tracking_current SET status='revoked',${clearPoint} WHERE job_id=?`,jobId);}
 async function view(actor,authority,row){
  const {job,role,eligible,profile}=authority,at=millis();
  if(row&&(!eligible||row.customer_id!==job.customer_id||row.collector_id!==job.assigned_provider_id||Number(row.provider_revision)!==Number(profile?.revision))){await revoke(job.id);row={...row,status:'revoked',latitude:null};}
  if(row&&timestamp(row.expires_at)<=at&&row.status==='active'){await run(`UPDATE job_tracking_current SET status='expired',${clearPoint} WHERE job_id=?`,job.id);row={...row,status:'expired',latitude:null};}
  const age=row?.received_at?Math.max(0,at-timestamp(row.received_at)):null;
  if(row&&age!==null&&age>=TRACKING_LIMITS.retentionMs&&row.latitude!==null){await run(`UPDATE job_tracking_current SET ${clearPoint} WHERE job_id=?`,job.id);row={...row,latitude:null};}
  const ended={completed:'completed',cancelled:'cancelled',disputed:'disputed',awaiting_customer:'finished'}[job.status];
  const state=ended||(disabled?'unavailable':!eligible?'not_authorized':!row?'not_started':row.status!=='active'?row.status:age===null?'waiting':age>=TRACKING_LIMITS.staleMs?'stale':'live');
  const point=state==='live'||state==='stale'?row?.latitude!==null&&row?.latitude!==undefined?{latitude:Number(row.latitude),longitude:Number(row.longitude),accuracy:Number(row.accuracy),capturedAt:row.captured_at,receivedAt:row.received_at}:null:null;
  return{ownerId:actor,jobId:job.id,role,state,canPublish:role==='collector'&&eligible,sessionId:row?.session_id||null,expiresAt:row?.expires_at||null,sequence:row?Number(row.sequence):0,lastUpdateAt:row?.received_at||null,point,serverTime:now(),staleAfterMs:TRACKING_LIMITS.staleMs,locationRetentionMs:TRACKING_LIMITS.retentionMs};
 }
 async function maintenance(){
  if(!available)return;
  const stamp=now(),cutoff=new Date(Date.parse(stamp)-TRACKING_LIMITS.retentionMs).toISOString();
  await transaction(async()=>{
   await run(`UPDATE job_tracking_current SET status='expired',${clearPoint} WHERE status='active' AND expires_at<=?`,stamp);
   await run(`UPDATE job_tracking_current SET ${clearPoint} WHERE received_at<=? AND latitude IS NOT NULL`,cutoff);
   await run('DELETE FROM job_tracking_operations WHERE created_at<=?',new Date(Date.parse(stamp)-86400_000).toISOString());
  });
 }
 async function route(ctx,method,path,body,query){
  assert(ctx.user?.status==='active',401,'sign_in_required','Sign in to use collection location.');
  const match=path.match(/^\/jobs\/([0-9a-f-]{36})\/tracking(?:\/(start|point|pause|stop))?$/i);
  assert(match&&UUID.test(match[1]),404,'tracking_unavailable','This collection location is unavailable.');
  assert(query.size===0,400,'invalid_tracking_query','Use this collection without account selectors.');
  assert(available,503,'tracking_setup_required','Collection location is not connected yet.');
  await rateLimit(`tracking:${ctx.user.id}`,120,60_000);
  const jobId=match[1].toLowerCase(),action=match[2],actor=ctx.user.id;
  assert((method==='GET'&&!action)||(method==='POST'&&action),404,'tracking_unavailable','This collection location is unavailable.');
  if(method==='POST')assert(body?.expectedOwnerId===actor,403,'account_changed','Your sign-in changed. Reopen this collection.');
  return transaction(async()=>{
   const authority=await lockJob(actor,jobId);let row=await current(jobId);
   if(method==='GET')return view(actor,authority,row);
   assert(authority.role==='collector',403,'collector_required','Only the assigned reviewed collector can publish location.');
   if(action==='start'){
    assert(shape(body,['expectedOwnerId','requestId','requestedAt','shareWithCustomer'])&&UUID.test(body.requestId)&&body.shareWithCustomer===true&&Number.isSafeInteger(body.requestedAt),400,'tracking_consent_required','Choose to share location for this collection before starting.');
    assert(authority.eligible,409,'tracking_not_permitted','This assignment or Waste verification no longer permits tracking.');
    const hash=fingerprint([jobId,actor,body.requestedAt,true]);const operation=await q('SELECT * FROM job_tracking_operations WHERE id=?',body.requestId);
    if(operation){assert(operation.job_id===jobId&&operation.collector_id===actor&&operation.request_hash===hash,409,'tracking_retry_changed','This retry belongs to another sharing request.');assert(row?.session_id===body.requestId,409,'tracking_session_changed','This sharing request is no longer current.');return view(actor,authority,row);}
    assert(Math.abs(millis()-body.requestedAt)<=60_000,400,'tracking_request_expired','This request expired. Check your device clock and start sharing again.');
    await rateLimit(`tracking-start:${actor}`,4,60_000);
    const stamp=now(),expiry=new Date(Date.parse(stamp)+TRACKING_LIMITS.sessionMs).toISOString();
    await run('INSERT INTO job_tracking_operations(id,job_id,collector_id,request_hash,created_at) VALUES(?,?,?,?,?)',body.requestId,jobId,actor,hash,stamp);
    await run(`INSERT INTO job_tracking_current(job_id,session_id,customer_id,collector_id,provider_revision,status,started_at,expires_at) VALUES(?,?,?,?,?,'active',?,?) ON CONFLICT(job_id) DO UPDATE SET session_id=excluded.session_id,customer_id=excluded.customer_id,collector_id=excluded.collector_id,provider_revision=excluded.provider_revision,status='active',started_at=excluded.started_at,expires_at=excluded.expires_at,sequence=0,received_at=NULL,${clearPoint}`,jobId,body.requestId,authority.job.customer_id,actor,Number(authority.profile.revision),stamp,expiry);
    await event(actor,'job',jobId,'LOCATION_SHARING_STARTED',{});return view(actor,authority,await current(jobId));
   }
   assert(row&&body.sessionId===row.session_id&&UUID.test(body.sessionId),409,'tracking_session_changed','Location sharing changed. Refresh this collection.');
   if(action==='pause'||action==='stop'){
    assert(shape(body,['expectedOwnerId','sessionId']),400,'invalid_tracking_action','Use the location sharing controls.');
    if(row.status!=='active'&&!(row.status==='paused'&&action==='stop'))return view(actor,authority,row);
    await run(`UPDATE job_tracking_current SET status=?,${clearPoint} WHERE job_id=?`,action==='pause'?'paused':'stopped',jobId);
    await event(actor,'job',jobId,'LOCATION_SHARING_STOPPED',{});return view(actor,authority,await current(jobId));
   }
   assert(shape(body,['expectedOwnerId','sessionId','sequence','latitude','longitude','accuracy','capturedAt']),400,'invalid_location','Use a fresh device location without extra fields.');
   assert(authority.eligible&&row.status==='active'&&row.customer_id===authority.job.customer_id&&row.collector_id===actor&&Number(row.provider_revision)===Number(authority.profile?.revision)&&timestamp(row.expires_at)>millis(),409,'tracking_closed','Location sharing is closed or expired.');
   const values=[body.latitude,body.longitude,body.accuracy];
   assert(values.every(v=>typeof v==='number'&&Number.isFinite(v))&&Math.abs(body.latitude)<=90&&Math.abs(body.longitude)<=180&&body.accuracy>=0&&body.accuracy<=TRACKING_LIMITS.maxAccuracy&&Number.isSafeInteger(body.capturedAt)&&Number.isSafeInteger(body.sequence)&&body.sequence>0,400,'invalid_location','A valid device position and reported accuracy are required.');
   const hash=fingerprint([body.sequence,...values,body.capturedAt]);
   if(body.sequence===Number(row.sequence)){assert(row.point_hash===hash,409,'location_retry_changed','A previous location cannot be changed.');return view(actor,authority,row);}
   assert(body.sequence===Number(row.sequence)+1&&(!row.captured_at||body.capturedAt>timestamp(row.captured_at)),409,'location_out_of_order','This location update is no longer current.');
   assert(millis()-body.capturedAt<=TRACKING_LIMITS.maxAgeMs&&body.capturedAt-millis()<=TRACKING_LIMITS.maxFutureMs,400,'location_expired','A fresh device position is required. Check the device clock.');
   assert(!row.received_at||millis()-timestamp(row.received_at)>=TRACKING_LIMITS.minPointMs,429,'location_too_frequent','Location updates are arriving too quickly.');
   const changed=await run("UPDATE job_tracking_current SET sequence=?,latitude=?,longitude=?,accuracy=?,captured_at=?,received_at=?,point_hash=? WHERE job_id=? AND session_id=? AND status='active' AND expires_at>? AND sequence=?",body.sequence,...values,new Date(body.capturedAt).toISOString(),now(),hash,jobId,body.sessionId,now(),Number(row.sequence));
   assert(changed.changes===1,409,'tracking_closed','Location sharing is closed or expired.');
   return view(actor,authority,await current(jobId));
  });
 }
 return{route,revoke,maintenance};
}
