// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { createPeopleFriends } from './people-friends.mjs';

const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002', C='00000000-0000-4000-8000-000000000003';
const databases=[];
afterEach(()=>{ for(const db of databases.splice(0))db.close(); });
function fixture(){
 const db=new DatabaseSync(':memory:');databases.push(db);
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE users(id TEXT PRIMARY KEY,eco_id TEXT,display_name TEXT,status TEXT);
 CREATE TABLE people_friendships(low_user_id TEXT REFERENCES users(id),high_user_id TEXT REFERENCES users(id),requester_id TEXT REFERENCES users(id),status TEXT NOT NULL DEFAULT 'none',revision INTEGER NOT NULL DEFAULT 0,low_blocked INTEGER NOT NULL DEFAULT 0,high_blocked INTEGER NOT NULL DEFAULT 0,requested_at TEXT,updated_at TEXT NOT NULL,PRIMARY KEY(low_user_id,high_user_id));
 CREATE TABLE notices(user_id TEXT,type TEXT,title TEXT,body TEXT,target_type TEXT,target_id TEXT);
 CREATE TABLE events(actor_id TEXT,aggregate_type TEXT,aggregate_id TEXT,event_type TEXT,details TEXT);`);
 for(const [id,name] of [[A,'alpha'],[B,'beta'],[C,'gamma']])db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,name,name,'active');
 let clock=Date.parse('2026-10-26T23:00:00Z'), failNotice=false;
 const limits=new Map();
 const deps={q:async(sql,...p)=>db.prepare(sql).get(...p),all:async(sql,...p)=>db.prepare(sql).all(...p),run:async(sql,...p)=>db.prepare(sql).run(...p),
 transaction:async(work)=>{db.exec('BEGIN');try{const result=await work();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}},
 assert:(condition,status,code,message)=>{if(!condition)throw Object.assign(Error(message),{status,code});},now:()=>new Date(clock).toISOString(),postgresMode:false,
 rateLimit:async(key,max)=>{const count=(limits.get(key)||0)+1;limits.set(key,count);if(count>max)throw Object.assign(Error('Rate limit'),{status:429});},
 notify:async(...p)=>{if(failNotice)throw Error('notice failure');db.prepare('INSERT INTO notices VALUES(?,?,?,?,?,?)').run(...p);},
 event:async(actor,aggregate,id,type,details)=>db.prepare('INSERT INTO events VALUES(?,?,?,?,?)').run(actor,aggregate,id,type,JSON.stringify(details))};
 const service=createPeopleFriends(deps);
 return {db,service,advance:ms=>{clock+=ms;},failNotice:()=>{failNotice=true;}};
}
const change=async(s,actor,target,action,revision)=>(await s.act(actor,target,{action,revision}));
describe('consensual friends',()=>{
 it('saves a request, shows it to its recipient, and only becomes friends after acceptance',async()=>{
  const {service:s,db}=fixture();
  expect((await change(s,A,B,'request',0)).state).toBe('outgoing');
  expect((await s.get(B,A)).state).toBe('incoming');
  expect((await s.list(B)).incoming.map(x=>x.eco_id)).toEqual(['alpha']);
  expect((await s.list(C)).incoming).toEqual([]);
  expect((await s.list(A)).friends).toEqual([]);
  expect((await change(s,B,A,'accept',1)).state).toBe('friends');
  expect((await s.get(A,B)).state).toBe('friends');
  expect((await s.list(A)).friends.map(x=>x.eco_id)).toEqual(['beta']);
  expect(db.prepare('SELECT count(*) n FROM notices').get().n).toBe(2);
 });
 it('rejects sender acceptance, self requests, inactive users and unknown IDs',async()=>{
  const {service:s,db}=fixture();await change(s,A,B,'request',0);
  await expect(change(s,A,B,'accept',1)).rejects.toMatchObject({status:409});
  await expect(change(s,A,A,'request',0)).rejects.toMatchObject({status:404});
  db.prepare("UPDATE users SET status='suspended' WHERE id=?").run(B);
  await expect(change(s,A,B,'request',1)).rejects.toMatchObject({status:404});
  await expect(s.get(A,'00000000-0000-4000-8000-000000000099')).rejects.toMatchObject({status:404});
 });
 it('requires an unchanged revision and never auto-accepts crossed requests',async()=>{
  const {service:s}=fixture();await change(s,A,B,'request',0);
  await expect(change(s,B,A,'request',0)).rejects.toMatchObject({status:409});
  await expect(change(s,B,A,'request',1)).rejects.toMatchObject({status:409});
  expect((await s.get(A,B)).state).toBe('outgoing');
 });
 it('declines privately and prevents immediate repeat requests',async()=>{
  const {service:s,db,advance}=fixture();await change(s,A,B,'request',0);await change(s,B,A,'decline',1);
  expect((await s.list(B)).incoming).toEqual([]);
  expect((await s.get(A,B)).actions).not.toContain('request');
  await expect(change(s,A,B,'request',2)).rejects.toMatchObject({status:429});
  expect(db.prepare('SELECT count(*) n FROM notices').get().n).toBe(1);
  advance(24*60*60_000+1);
  expect((await change(s,A,B,'request',2)).state).toBe('outgoing');
 });
 it('lets a sender cancel and either friend remove the relationship',async()=>{
  const {service:s,advance}=fixture();await change(s,A,B,'request',0);await change(s,A,B,'cancel',1);
  expect((await s.list(B)).incoming).toEqual([]);advance(24*60*60_000+1);
  await change(s,A,B,'request',2);await change(s,B,A,'accept',3);await change(s,A,B,'remove',4);
  expect((await s.list(A)).friends).toEqual([]);expect((await s.list(B)).friends).toEqual([]);
 });
 it('expires requests after seven days and refuses late acceptance',async()=>{
  const {service:s,advance}=fixture();await change(s,A,B,'request',0);advance(7*24*60*60_000);
  expect((await s.list(B)).incoming).toEqual([]);await expect(change(s,B,A,'accept',1)).rejects.toMatchObject({status:409});
 });
 it('blocks further requests in both directions and never restores friendship on unblock',async()=>{
  const {service:s}=fixture();await change(s,A,B,'request',0);await change(s,B,A,'accept',1);await change(s,B,A,'block',2);
  expect((await s.get(B,A)).state).toBe('blocked');expect((await s.get(A,B)).state).toBe('unavailable');
  await expect(change(s,A,B,'request',3)).rejects.toMatchObject({status:404});
  await change(s,B,A,'unblock',3);expect((await s.get(A,B)).state).not.toBe('friends');
 });
 it('keeps independent blocks: one person cannot undo the other block',async()=>{
  const {service:s}=fixture();await change(s,A,B,'block',0);await change(s,B,A,'block',1);
  await change(s,A,B,'unblock',2);expect((await s.get(A,B)).state).toBe('unavailable');
  expect((await s.list(B)).blocked.map(x=>x.eco_id)).toEqual(['alpha']);
 });
 it('rejects forged actors/fields and malformed revisions before writing',async()=>{
  const {service:s,db}=fixture();
  for(const body of [{action:'request',revision:0,userId:C},{action:'accept',revision:-1},{action:'request',revision:'0'},{action:'invent',revision:0}])await expect(s.act(A,B,body)).rejects.toMatchObject({status:400});
  expect(db.prepare('SELECT count(*) n FROM people_friendships').get().n).toBe(0);
 });
 it('rolls back the request if its notification cannot be committed',async()=>{
  const {service:s,db,failNotice}=fixture();failNotice();await expect(change(s,A,B,'request',0)).rejects.toThrow('notice failure');
  expect(db.prepare('SELECT count(*) n FROM people_friendships').get().n).toBe(0);
 });
 it('rate limits repeated request actions',async()=>{
  const {service:s}=fixture();let limited=false;
  for(let n=0;n<25;n++){try{await change(s,A,B,'request',0);}catch(e){if(e.status===429)limited=true;}}
  expect(limited).toBe(true);
 });
 it('returns only the caller relationship and public peer fields',async()=>{
  const {service:s}=fixture();await change(s,A,B,'request',0);
  expect((await s.list(C)).incoming).toEqual([]);
  const entry=(await s.list(B)).incoming[0];
  expect(Object.keys(entry).sort()).toEqual(['actions','display_name','eco_id','id','revision','state'].sort());
 });
});
