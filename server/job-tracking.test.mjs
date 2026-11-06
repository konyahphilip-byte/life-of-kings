// @vitest-environment node
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {afterEach,describe,expect,it} from 'vitest';
import {createJobTracking,TRACKING_SQLITE_SCHEMA,TRACKING_LIMITS} from './job-tracking.mjs';
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',C='00000000-0000-4000-8000-000000000003',J='00000000-0000-4000-8000-000000000010';
const databases=[];afterEach(()=>databases.splice(0).forEach(db=>db.close()));
function fixture(options={}){
 const db=new DatabaseSync(':memory:');databases.push(db);db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE users(id TEXT PRIMARY KEY,status TEXT);CREATE TABLE roles(user_id TEXT,role TEXT);
 CREATE TABLE jobs(id TEXT PRIMARY KEY,customer_id TEXT,assigned_provider_id TEXT,category TEXT,status TEXT);
 CREATE TABLE provider_profiles(user_id TEXT PRIMARY KEY,revision INTEGER,verification_state TEXT);
 CREATE TABLE verification_requests(user_id TEXT,target_role TEXT,business_type TEXT,profile_version INTEGER,status TEXT);
 CREATE TABLE people_friendships(low_user_id TEXT,high_user_id TEXT,low_blocked INTEGER,high_blocked INTEGER);
 CREATE TABLE audit_events(kind TEXT,details TEXT);${TRACKING_SQLITE_SCHEMA}`);
 for(const id of[A,B,C])db.prepare("INSERT INTO users VALUES(?,'active')").run(id);
 db.prepare("INSERT INTO roles VALUES(?,'provider')").run(B);db.prepare("INSERT INTO provider_profiles VALUES(?,1,'approved')").run(B);
 db.prepare("INSERT INTO verification_requests VALUES(?,'provider','Waste services provider',1,'approved')").run(B);
 db.prepare("INSERT INTO jobs VALUES(?,?,?,'Waste & Recycling','assigned')").run(J,A,B);
 let time=Date.parse('2026-10-29T21:00:00Z'),auditFails=false;
 const service=createJobTracking({q:async(s,...p)=>db.prepare(s).get(...p),run:async(s,...p)=>db.prepare(s).run(...p),transaction:async fn=>{db.exec('BEGIN');try{const r=await fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}},assert:(ok,status,code,message)=>{if(!ok)throw Object.assign(Error(message),{status,code});},now:()=>new Date(time).toISOString(),event:async(...args)=>{if(auditFails)throw Error('audit unavailable');db.prepare('INSERT INTO audit_events VALUES(?,?)').run(args[3],JSON.stringify(args[4]));},rateLimit:async()=>{},postgresMode:false,available:true,...options});
 const route=(actor=B,method='GET',suffix='',body={},query='')=>service.route({user:actor?{id:actor,status:'active'}:null},method,`/jobs/${J}/tracking${suffix}`,body,new URLSearchParams(query));
 const request=()=>({expectedOwnerId:B,requestId:randomUUID(),requestedAt:time,shareWithCustomer:true});
 const point=(sessionId,patch={})=>({expectedOwnerId:B,sessionId,sequence:1,latitude:5.6037,longitude:-0.187,accuracy:12,capturedAt:time,...patch});
 return{db,service,route,request,point,advance:ms=>{time+=ms;},auditFail:()=>{auditFails=true;}};
}
describe('job-authorized collector coordinates',()=>{
 it('has a deny-only disable switch and no duplicate stop events',async()=>{
  const disabled=fixture({disabled:true});expect(await disabled.route()).toMatchObject({state:'unavailable',canPublish:false,point:null});await expect(disabled.route(B,'POST','/start',disabled.request())).rejects.toMatchObject({status:409});
  const f=fixture(),start=f.request(),stop={expectedOwnerId:B,sessionId:start.requestId};await f.route(B,'POST','/start',start);await f.route(B,'POST','/stop',stop);await f.route(B,'POST','/stop',stop);await f.route(B,'POST','/pause',stop);
  expect((await f.route(A)).state).toBe('stopped');expect(f.db.prepare('SELECT count(*) n FROM audit_events').get().n).toBe(2);
 });
 it('only permits current participants and refuses selectors or missing schema',async()=>{
  const f=fixture();expect(await f.route()).toMatchObject({role:'collector',state:'not_started',canPublish:true,point:null});
  await expect(f.route(null)).rejects.toMatchObject({status:401});await expect(f.route(C)).rejects.toMatchObject({status:404});
  await expect(f.route(B,'GET','',{},'collectorId='+C)).rejects.toMatchObject({status:400});
  await expect(fixture({available:false}).route()).rejects.toMatchObject({status:503});
 });
 it('requires explicit sharing and a current Waste review at the current profile revision',async()=>{
  const f=fixture(),body=f.request();await expect(f.route(B,'POST','/start',{...body,shareWithCustomer:false})).rejects.toMatchObject({status:400});
  await expect(f.route(A,'POST','/start',{...body,expectedOwnerId:A})).rejects.toMatchObject({status:403});
  f.db.exec("UPDATE verification_requests SET business_type='Other'");await expect(f.route(B,'POST','/start',body)).rejects.toMatchObject({status:409});
  f.db.exec("UPDATE verification_requests SET business_type='Waste services provider';UPDATE provider_profiles SET revision=2");await expect(f.route(B,'POST','/start',body)).rejects.toMatchObject({status:409});
 });
 it('saves only the latest point, preserves accuracy, and never puts coordinates in audit',async()=>{
  const f=fixture(),start=f.request();await f.route(B,'POST','/start',start);await f.route(B,'POST','/point',f.point(start.requestId));
  f.advance(5000);await f.route(B,'POST','/point',f.point(start.requestId,{sequence:2,latitude:5.604}));
  const view=await f.route(A);expect(view).toMatchObject({ownerId:A,role:'customer',state:'live',sequence:2,point:{latitude:5.604,accuracy:12}});
  expect(f.db.prepare('SELECT count(*) n FROM job_tracking_current').get().n).toBe(1);
  expect(JSON.stringify(f.db.prepare('SELECT * FROM audit_events').all())).not.toContain('5.604');
 });
 it('honors exact retries and prevents modified, out-of-order or old-session writes',async()=>{
  const f=fixture(),start=f.request();await f.route(B,'POST','/start',start);const p=f.point(start.requestId);await f.route(B,'POST','/point',p);
  expect((await f.route(B,'POST','/point',p)).sequence).toBe(1);
  await expect(f.route(B,'POST','/point',{...p,longitude:0})).rejects.toMatchObject({status:409});
  await expect(f.route(B,'POST','/point',{...p,sequence:3})).rejects.toMatchObject({status:409});
  const next=f.request();await f.route(B,'POST','/start',next);
  await expect(f.route(B,'POST','/start',start)).rejects.toMatchObject({status:409});
  await expect(f.route(B,'POST','/stop',{expectedOwnerId:B,sessionId:start.requestId})).rejects.toMatchObject({status:409});
 });
 it.each([{latitude:91},{longitude:181},{accuracy:-1},{accuracy:1001},{latitude:'5.6'},{sequence:0},{capturedAt:1},{capturedAt:Date.parse('2026-10-29T21:01:00Z')},{altitude:100}])('rejects malformed, old or excessive samples %j',async patch=>{
  const f=fixture(),start=f.request();await f.route(B,'POST','/start',start);await expect(f.route(B,'POST','/point',f.point(start.requestId,patch))).rejects.toMatchObject({status:400});
 });
 it('marks quiet signals stale, removes coordinates at90seconds and expires the session',async()=>{
  const f=fixture(),s=f.request();await f.route(B,'POST','/start',s);await f.route(B,'POST','/point',f.point(s.requestId));
  f.advance(31_000);expect((await f.route(A)).state).toBe('stale');
  f.advance(60_000);await f.service.maintenance();expect((await f.route(A)).point).toBeNull();expect((await f.route(A)).state).toBe('stale');
  f.advance(TRACKING_LIMITS.sessionMs);await f.service.maintenance();expect((await f.route(A)).state).toBe('expired');
  await expect(f.route(B,'POST','/point',f.point(s.requestId,{sequence:2}))).rejects.toMatchObject({status:409});
 });
 it('clears points after pause and refuses a delayed start retry to resume capture',async()=>{
  const f=fixture(),s=f.request();await f.route(B,'POST','/start',s);await f.route(B,'POST','/point',f.point(s.requestId));
  await f.route(B,'POST','/pause',{expectedOwnerId:B,sessionId:s.requestId});expect((await f.route(A)).point).toBeNull();
  expect((await f.route(B,'POST','/start',s)).state).toBe('paused');
  await expect(f.route(B,'POST','/point',f.point(s.requestId,{sequence:2}))).rejects.toMatchObject({status:409});
 });
 it.each(['completed','cancelled','disputed','awaiting_customer'])('hides terminal job location for %s',async status=>{
  const f=fixture(),s=f.request();await f.route(B,'POST','/start',s);await f.route(B,'POST','/point',f.point(s.requestId));f.db.prepare('UPDATE jobs SET status=?').run(status);
  expect((await f.route(A)).point).toBeNull();expect(f.db.prepare('SELECT latitude FROM job_tracking_current').get().latitude).toBeNull();
  await expect(f.route(B,'POST','/point',f.point(s.requestId,{sequence:2}))).rejects.toMatchObject({status:409});
 });
 it('rechecks assignment, blocks, review and account state before reading coordinates',async()=>{
  for(const change of["UPDATE jobs SET assigned_provider_id='"+C+"'","UPDATE provider_profiles SET verification_state='rejected'","UPDATE provider_profiles SET revision=2","INSERT INTO people_friendships VALUES('"+A+"','"+B+"',1,0)"]){
   const f=fixture(),s=f.request();await f.route(B,'POST','/start',s);await f.route(B,'POST','/point',f.point(s.requestId));f.db.exec(change);expect((await f.route(A)).point).toBeNull();
  }
  const f=fixture();f.db.prepare("UPDATE users SET status='suspended' WHERE id=?").run(B);await expect(f.route()).rejects.toMatchObject({status:404});
 });
 it('rolls back a failed start and its idempotency record together',async()=>{
  const f=fixture();f.auditFail();await expect(f.route(B,'POST','/start',f.request())).rejects.toThrow('audit unavailable');
  expect(f.db.prepare('SELECT count(*) n FROM job_tracking_current').get().n).toBe(0);expect(f.db.prepare('SELECT count(*) n FROM job_tracking_operations').get().n).toBe(0);
 });
 it('refuses cross-account writes and overly frequent samples without changing stored data',async()=>{
  const f=fixture(),s=f.request();await f.route(B,'POST','/start',s);const p=f.point(s.requestId);await f.route(B,'POST','/point',p);
  await expect(f.route(B,'POST','/point',{...p,expectedOwnerId:A})).rejects.toMatchObject({status:403});
  f.advance(1000);await expect(f.route(B,'POST','/point',f.point(s.requestId,{sequence:2}))).rejects.toMatchObject({status:429});
  expect((await f.route(A)).sequence).toBe(1);
 });
});
