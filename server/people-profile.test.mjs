// @vitest-environment node
import {DatabaseSync} from 'node:sqlite';
import {afterEach,describe,expect,it} from 'vitest';
import {createPeopleProfile,PROFILE_SQLITE_SCHEMA} from './people-profile.mjs';
import {FRIENDS_SQLITE_SCHEMA} from './people-friends.mjs';
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',C='00000000-0000-4000-8000-000000000003';
const PHOTO='00000000-0000-4000-8000-000000000010',COVER='00000000-0000-4000-8000-000000000011',OTHER='00000000-0000-4000-8000-000000000012',VIDEO='00000000-0000-4000-8000-000000000013';
const databases=[];afterEach(()=>databases.splice(0).forEach(db=>db.close()));
function fixture(available=true){
 const db=new DatabaseSync(':memory:');databases.push(db);db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE users(id TEXT PRIMARY KEY,eco_id TEXT,display_name TEXT,status TEXT);CREATE TABLE media_assets(id TEXT PRIMARY KEY,owner_id TEXT,mime_type TEXT);CREATE TABLE people_follows(user_id TEXT,target_user_id TEXT,PRIMARY KEY(user_id,target_user_id));${FRIENDS_SQLITE_SCHEMA}${PROFILE_SQLITE_SCHEMA}`);
 for(const [id,name]of[[A,'Alpha'],[B,'Beta'],[C,'Gamma']])db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,name.toLowerCase(),name,'active');
 for(const [id,owner,mime]of[[PHOTO,A,'image/jpeg'],[COVER,A,'image/png'],[OTHER,B,'image/webp'],[VIDEO,A,'video/mp4']])db.prepare('INSERT INTO media_assets VALUES(?,?,?)').run(id,owner,mime);
 db.prepare("INSERT INTO people_friendships(low_user_id,high_user_id,requester_id,status,revision,requested_at,updated_at) VALUES(?,?,?,'accepted',2,?,?)").run(A,B,A,'2026-10-28T00:00:00Z','2026-10-28T00:00:00Z');
 db.prepare('INSERT INTO people_follows VALUES(?,?)').run(C,A);db.prepare('INSERT INTO people_follows VALUES(?,?)').run(A,B);
 let failAudit=false;const events=[];
 const service=createPeopleProfile({q:async(s,...p)=>db.prepare(s).get(...p),run:async(s,...p)=>db.prepare(s).run(...p),transaction:async work=>{db.exec('BEGIN');try{const result=await work();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}},assert:(v,status,code,message)=>{if(!v)throw Object.assign(Error(message),{status,code});},now:()=>new Date().toISOString(),event:async(...args)=>{if(failAudit)throw Error('audit failed');events.push(args);},rateLimit:async()=>{},postgresMode:false,available});
 const route=(actor=A,method='GET',target='me',body={},query='')=>service.route({user:actor?{id:actor,status:'active'}:null},method,`/people/profiles/${target}`,body,new URLSearchParams(query));
 return{db,route,events,failAudit:()=>{failAudit=true;}};
}
describe('owned profile media and relationship counts',()=>{
 it('derives synced counts from active saved relationships, not previews or roster limits',async()=>{
  const f=fixture();expect((await f.route()).counts).toEqual({friends:1,followers:1,following:1});
  f.db.exec('UPDATE people_friendships SET high_blocked=1');expect((await f.route()).counts).toEqual({friends:0,followers:1,following:0});
  f.db.prepare("UPDATE users SET status='suspended' WHERE id=?").run(C);expect((await f.route()).counts.followers).toBe(0);
 });
 it('persists owned avatar and cover and makes exact retries idempotent',async()=>{
  const f=fixture();const body={expectedOwnerId:A,avatarAssetId:PHOTO,bannerAssetId:COVER,revision:0};const saved=await f.route(A,'POST','me',body);
  expect(saved.ownerId).toBe(A);expect(saved.avatarAssetId).toBe(PHOTO);expect(saved.bannerAssetId).toBe(COVER);expect(saved.revision).toBe(1);
  expect((await f.route(A,'POST','me',body)).revision).toBe(1);expect(f.events).toHaveLength(1);expect((await f.route()).avatarAssetId).toBe(PHOTO);
  await expect(f.route(A,'POST','me',{...body,bannerAssetId:null})).rejects.toMatchObject({status:409});
 });
 it('rejects other owners, videos, forged fields, selectors and anonymous callers',async()=>{
  const f=fixture();const body={expectedOwnerId:A,avatarAssetId:PHOTO,bannerAssetId:null,revision:0};
  await expect(f.route(null)).rejects.toMatchObject({status:401});await expect(f.route(A,'GET','me',{},'userId='+B)).rejects.toMatchObject({status:400});
  await expect(f.route(B,'POST','me',body)).rejects.toMatchObject({status:403});
  await expect(f.route(A,'POST',B,body)).rejects.toMatchObject({status:404});
  await expect(f.route(A,'POST','me',{...body,avatarAssetId:OTHER})).rejects.toMatchObject({status:404});
  await expect(f.route(A,'POST','me',{...body,avatarAssetId:VIDEO})).rejects.toMatchObject({status:400});
  await expect(f.route(A,'POST','me',{...body,ownerId:B})).rejects.toMatchObject({status:400});
 });
 it('restricts member profile images by current blocks and never exposes unpublished assets',async()=>{
  const f=fixture();await f.route(A,'POST','me',{expectedOwnerId:A,avatarAssetId:PHOTO,bannerAssetId:null,revision:0});
  expect((await f.route(B,'GET',A+'/media/avatar')).mediaAsset.id).toBe(PHOTO);
  await expect(f.route(B,'GET',A+'/media/banner')).rejects.toMatchObject({status:404});
  f.db.exec('UPDATE people_friendships SET high_blocked=1');await expect(f.route(B,'GET',A)).rejects.toMatchObject({status:404});
  await expect(f.route(B,'GET',A+'/media/avatar')).rejects.toMatchObject({status:404});
 });
 it('keeps counts available but disables media writes before migration',async()=>{
  const f=fixture(false);const result=await f.route();expect(result.mediaEnabled).toBe(false);expect(result.counts.friends).toBe(1);
  await expect(f.route(A,'POST','me',{expectedOwnerId:A,avatarAssetId:PHOTO,bannerAssetId:null,revision:0})).rejects.toMatchObject({status:503});
 });
 it('rolls back profile changes when their audit cannot commit',async()=>{
  const f=fixture();f.failAudit();await expect(f.route(A,'POST','me',{expectedOwnerId:A,avatarAssetId:PHOTO,bannerAssetId:null,revision:0})).rejects.toThrow('audit failed');
  expect((await f.route()).revision).toBe(0);expect((await f.route()).avatarAssetId).toBeNull();
 });
});
