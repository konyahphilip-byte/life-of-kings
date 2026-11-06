// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { afterEach,describe,expect,it } from 'vitest';
import { createDirectMessages,DIRECT_MESSAGES_SQLITE_SCHEMA } from './direct-messages.mjs';
import { FRIENDS_SQLITE_SCHEMA } from './people-friends.mjs';
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',C='00000000-0000-4000-8000-000000000003';
const databases=[];afterEach(()=>databases.splice(0).forEach(db=>db.close()));
function fixture({available=true,receiptsAvailable=true}={}){
 const db=new DatabaseSync(':memory:');databases.push(db);db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE users(id TEXT PRIMARY KEY,eco_id TEXT,display_name TEXT,status TEXT);${FRIENDS_SQLITE_SCHEMA}${DIRECT_MESSAGES_SQLITE_SCHEMA}`);
 for(const [id,name]of[[A,'Alpha'],[B,'Beta'],[C,'Gamma']])db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,name.toLowerCase(),name,'active');
 db.prepare("INSERT INTO people_friendships(low_user_id,high_user_id,requester_id,status,revision,requested_at,updated_at)VALUES(?,?,?,'accepted',2,?,?)").run(A,B,A,'2026-10-27T07:00:00Z','2026-10-27T07:00:00Z');
 const audits=[],limits=new Map(),notices=[];let failedAudit=false;
 const service=createDirectMessages({q:async(s,...p)=>db.prepare(s).get(...p),all:async(s,...p)=>db.prepare(s).all(...p),run:async(s,...p)=>db.prepare(s).run(...p),transaction:async work=>{db.exec('BEGIN');try{const r=await work();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}},assert:(ok,status,code,message)=>{if(!ok)throw Object.assign(Error(message),{status,code});},now:()=>new Date().toISOString(),id:randomUUID,event:async(...args)=>{if(failedAudit)throw Error('audit failed');audits.push(args);},rateLimit:async(key,max)=>{const n=(limits.get(key)||0)+1;limits.set(key,n);if(n>max)throw Object.assign(Error('Limited'),{status:429});},notify:async(...args)=>{notices.push(args);},postgresMode:false,available,receiptsAvailable});
 const route=(actor,method='GET',target=B,body={},query='')=>service.route({user:actor?{id:actor,status:'active'}:null},method,`/connect/messages${target?`/${target}`:''}`,body,new URLSearchParams(query));
 const send=(body='Hello',options={})=>route(A,'POST',B,{body,revision:2,clientId:randomUUID(),...options});
 return{db,route,send,audits,notices,failAudit:()=>{failedAudit=true;}};
}
describe('private friend messages',()=>{
 it('emits one content-free saved alert per immutable send and does not notify on retries',async()=>{
  const f=fixture(),clientId=randomUUID();await f.send('PRIVATE TEXT',{clientId});await f.send('PRIVATE TEXT',{clientId});
  expect(f.notices).toHaveLength(1);expect(f.notices[0]).toEqual([B,'direct_message','New message','You have a new private message.','direct_message',A]);
  expect(JSON.stringify(f.notices)).not.toContain('PRIVATE TEXT');
 });
 it('fails receipt admission closed before migration while preserving text access',async()=>{
  const f=fixture({receiptsAvailable:false});const sent=await f.send();expect((await f.route(A)).receiptsEnabled).toBe(false);
  await expect(f.route(B,'POST',`${A}/receipts`,{revision:2,messageIds:[sent.message.id]})).rejects.toMatchObject({status:503});
 });
 it('requires a recipient acknowledgement before showing delivery and keeps it immutable',async()=>{
  const f=fixture();const sent=await f.send();
  expect((await f.route(A)).messages[0].deliveredAt).toBeNull();
  await f.route(B,'GET',A); // Fetching alone is not a device acknowledgement.
  expect((await f.route(A)).messages[0].deliveredAt).toBeNull();
  const ack=()=>f.route(B,'POST',`${A}/receipts`,{revision:2,messageIds:[sent.message.id]});
  await ack();const first=(await f.route(A)).messages[0].deliveredAt;
  expect(typeof first).toBe('string');await ack();expect((await f.route(A)).messages[0].deliveredAt).toBe(first);
 });
 it('rejects sender, third-party, forged-batch and stale-revision delivery claims',async()=>{
  const f=fixture();const sent=await f.send();const receipt={revision:2,messageIds:[sent.message.id]};
  await expect(f.route(A,'POST',`${B}/receipts`,receipt)).rejects.toMatchObject({status:404});
  await expect(f.route(C,'POST',`${A}/receipts`,receipt)).rejects.toMatchObject({status:404});
  await expect(f.route(B,'POST',`${A}/receipts`,{...receipt,messageIds:[sent.message.id,randomUUID()]})).rejects.toMatchObject({status:404});
  expect((await f.route(A)).messages[0].deliveredAt).toBeNull();
  await expect(f.route(B,'POST',`${A}/receipts`,{...receipt,revision:1})).rejects.toMatchObject({status:409});
  f.db.exec('UPDATE people_friendships SET high_blocked=1');
  await expect(f.route(B,'POST',`${A}/receipts`,receipt)).rejects.toMatchObject({status:404});
 });
 it('stores text in the current accepted relationship and hides it from a third account',async()=>{const f=fixture();const r=await f.send();expect(r.message.senderId).toBe(A);expect((await f.route(B,'GET',A)).messages[0].body).toBe('Hello');await expect(f.route(C)).rejects.toMatchObject({status:404});expect(await f.route(C,'GET',null)).toEqual({ownerId:C,friends:[],truncated:false});});
 it('refuses old consent revisions, blocked and inactive accounts',async()=>{const f=fixture();await expect(f.send('stale',{revision:1})).rejects.toMatchObject({status:409});f.db.exec('UPDATE people_friendships SET high_blocked=1');await expect(f.send()).rejects.toMatchObject({status:404});f.db.exec('UPDATE people_friendships SET high_blocked=0');f.db.prepare("UPDATE users SET status='suspended' WHERE id=?").run(A);await expect(f.route(A)).rejects.toMatchObject({status:404});});
 it('does not restore old messages when the relationship is reaccepted',async()=>{const f=fixture();await f.send('Old consent');f.db.exec('UPDATE people_friendships SET revision=6');expect((await f.route(A)).messages).toEqual([]);await expect(f.send('retry',{revision:2})).rejects.toMatchObject({status:409});await f.send('New consent',{revision:6});expect((await f.route(A)).messages.map(m=>m.body)).toEqual(['New consent']);});
 it('keeps client retries immutable and prevents cross-recipient retry-key reuse',async()=>{const f=fixture(),clientId=randomUUID();const first=await f.send('same',{clientId});expect((await f.send('same',{clientId})).message.id).toBe(first.message.id);await expect(f.send('different',{clientId})).rejects.toMatchObject({status:409});expect(f.db.prepare('SELECT count(*) n FROM connect_direct_messages').get().n).toBe(1);});
 it('pages strictly before the cursor with no gaps or duplicate rows',async()=>{const f=fixture();const insert=f.db.prepare('INSERT INTO connect_direct_messages(id,low_user_id,high_user_id,friendship_revision,sender_id,client_id,body,created_at) VALUES(?,?,?,?,?,?,?,?)');for(let n=1;n<=101;n++)insert.run(randomUUID(),A,B,2,A,randomUUID(),`Message ${n}`,'2026-10-27T07:00:00Z');const latest=await f.route(A);expect(latest.messages.map(m=>m.body)).toEqual(Array.from({length:50},(_,i)=>`Message ${i+52}`));expect(latest.hasOlder).toBe(true);const older=await f.route(A,'GET',B,{},`before=${latest.beforeCursor}`);expect(older.messages[0].body).toBe('Message 2');expect(older.messages.at(-1).body).toBe('Message 51');const first=await f.route(A,'GET',B,{},`before=${older.beforeCursor}`);expect(first.messages.map(m=>m.body)).toEqual(['Message 1']);expect(first.hasOlder).toBe(false);});
 it('rejects forged selectors and malformed cursors',async()=>{const f=fixture();for(const query of ['actor=x','before=-1','before=1&before=2','before=99999999999999999999','before=0','before=abc'])await expect(f.route(A,'GET',B,{},query)).rejects.toMatchObject({status:400});await expect(f.send('Hello',{actor:C})).rejects.toMatchObject({status:400});});
 it('rolls back message persistence if its metadata audit fails',async()=>{const f=fixture();f.failAudit();await expect(f.send()).rejects.toThrow('audit failed');expect(f.db.prepare('SELECT count(*) n FROM connect_direct_messages').get().n).toBe(0);});
 it('does not send message contents into the audit event',async()=>{const f=fixture();await f.send('PRIVATE MESSAGE CONTENT');expect(JSON.stringify(f.audits)).not.toContain('PRIVATE MESSAGE CONTENT');});
 it('rate limits sending and never persists a limited message',async()=>{const f=fixture();for(let n=0;n<20;n++)await f.send();await expect(f.send()).rejects.toMatchObject({status:429});expect(f.db.prepare('SELECT count(*) n FROM connect_direct_messages').get().n).toBe(20);});
 it('fails closed when the schema is unavailable and denies anonymous access first',async()=>{const f=fixture({available:false});await expect(f.route(A)).rejects.toMatchObject({status:503});await expect(f.route(null)).rejects.toMatchObject({status:401});});
 it('finds an accepted friend beyond 50 rows without exposing an unrelated account',async()=>{
  const f=fixture();f.db.exec("UPDATE people_friendships SET updated_at='2000-01-01T00:00:00Z'");
  for(let n=0;n<51;n++){
   const peer=randomUUID(),[low,high]=[A,peer].sort();f.db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(peer,`friend.${n}`,`Friend ${n}`,'active');
   f.db.prepare("INSERT INTO people_friendships(low_user_id,high_user_id,requester_id,status,revision,requested_at,updated_at)VALUES(?,?,?,'accepted',2,?,?)").run(low,high,A,'2026-10-27T07:00:00Z','2026-10-27T07:00:00Z');
  }
  const roster=await f.route(A,'GET',null);expect(roster.ownerId).toBe(A);expect(roster.truncated).toBe(true);expect(roster.friends.some(p=>p.id===B)).toBe(false);
  const found=await f.route(A,'GET',null,{},'ecoId=%40BETA');expect(found.friends.map(p=>p.id)).toEqual([B]);expect(found.truncated).toBe(false);
  expect((await f.route(C,'GET',null,{},'ecoId=beta')).friends).toEqual([]);
  for(const query of ['ecoId=ab','ecoId=beta&actor=forged','ecoId=beta&ecoId=gamma'])await expect(f.route(A,'GET',null,{},query)).rejects.toMatchObject({status:400});
 });
});
