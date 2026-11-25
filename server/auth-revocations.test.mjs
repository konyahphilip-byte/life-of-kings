// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { AUTH_REVOCATIONS_SQLITE_SCHEMA, createAuthRevocations, extractVerifiedAuthContext } from './auth-revocations.mjs';

const databases=[];
afterEach(()=>{for(const db of databases.splice(0))db.close();});
const userId=randomUUID(), sessionId=randomUUID();
const proof=(time=900,sid=sessionId)=>({sessionId:sid,primaryAuthAt:time,issuedAt:time,expiresAt:time+3600});
function fixture(){
 const db=new DatabaseSync(':memory:');databases.push(db);
 db.exec('CREATE TABLE users(id TEXT PRIMARY KEY);CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT);');
 db.exec(AUTH_REVOCATIONS_SQLITE_SCHEMA);db.prepare('INSERT INTO users VALUES(?)').run(userId);
 let clock=1000;
 const service=createAuthRevocations({q:async(s,...p)=>db.prepare(s).get(...p),run:async(s,...p)=>db.prepare(s).run(...p),postgresMode:false,nowSeconds:()=>clock});
 return{db,service,setClock:value=>{clock=value;},session:()=>db.prepare('INSERT INTO sessions VALUES(?,?)').run(randomUUID(),userId)};
}
const token=claims=>`synthetic.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.unsigned`;
describe('verified claim extraction (only after external signature verification)',()=>{
 const claims={sub:userId,session_id:sessionId,iat:950,exp:2000,amr:[{method:'password',timestamp:900},{method:'token_refresh',timestamp:950}]};
 it('uses primary authentication, never refresh or token issue time',()=>{expect(extractVerifiedAuthContext(token(claims),userId,1000)).toEqual({sessionId,primaryAuthAt:900,issuedAt:950,expiresAt:2000});});
 it('does not treat missing, refresh-only or unknown AMR as fresh authentication',()=>{for(const amr of [undefined,[],[{method:'token_refresh',timestamp:950}],[{method:'future_method',timestamp:950}]])expect(extractVerifiedAuthContext(token({...claims,amr}),userId,1000).primaryAuthAt).toBe(null);});
 it('rejects wrong subject, malformed IDs, expired/future/inconsistent times and malformed primary proof',()=>{
  for(const patch of [{sub:randomUUID()},{session_id:'bad'},{exp:1000},{iat:1061},{iat:2001},{amr:[{method:'password',timestamp:951}]},{amr:[{method:'password',timestamp:'900'}]}])expect(()=>extractVerifiedAuthContext(token({...claims,...patch}),userId,1000)).toThrow();
 });
});
describe('app-owned recovery admission policy',()=>{
 it('blocks old and refresh-minted proof but allows a later new primary session',async()=>{
  const f=fixture();await f.service.admit(userId,proof());f.session();
  await f.service.revoke(userId,proof(),randomUUID());
  expect(f.db.prepare('SELECT count(*) n FROM sessions').get().n).toBe(0);
  await expect(f.service.admit(userId,proof())).rejects.toMatchObject({code:'fresh_signin_required'});
  f.setClock(1200);
  await expect(f.service.admit(userId,{...proof(),issuedAt:1190})).rejects.toMatchObject({code:'fresh_signin_required'});
  await expect(f.service.admit(userId,{...proof(),primaryAuthAt:null,sessionId:randomUUID()})).rejects.toMatchObject({code:'fresh_signin_required'});
  await f.service.admit(userId,proof(1100,randomUUID()));
 });
 it('cannot use the revoked session ID even with newer primary claims',async()=>{
  const f=fixture();await f.service.revoke(userId,proof(),randomUUID());f.setClock(1200);
  await expect(f.service.admit(userId,proof(1100))).rejects.toMatchObject({code:'fresh_signin_required'});
 });
 it('retries the original operation without deleting a later fresh session or advancing the boundary',async()=>{
  const f=fixture(),operation=randomUUID();const first=await f.service.revoke(userId,proof(),operation);
  f.setClock(1200);await f.service.admit(userId,proof(1100,randomUUID()));f.session();
  expect(await f.service.revoke(userId,proof(),operation)).toEqual({...first,replayed:true});
  expect(f.db.prepare('SELECT count(*) n FROM sessions').get().n).toBe(1);
  expect(f.db.prepare('SELECT auth_after FROM identity_auth_state').get().auth_after).toBe(1060);
  await expect(f.service.revoke(userId,proof(),randomUUID())).rejects.toMatchObject({code:'fresh_signin_required'});
  expect(f.db.prepare('SELECT count(*) n FROM sessions').get().n).toBe(1);
 });
 it('binds operation retries to owner and original provider session',async()=>{
  const f=fixture(),operation=randomUUID();await f.service.revoke(userId,proof(),operation);f.setClock(1200);
  await expect(f.service.revoke(userId,proof(1100,randomUUID()),operation)).rejects.toMatchObject({code:'revocation_operation_conflict'});
  await expect(f.service.revoke(userId,proof(),'not-a-uuid')).rejects.toMatchObject({status:400});
 });
 it('uses a conservative clock boundary and never accepts equality',async()=>{
  const f=fixture();await f.service.revoke(userId,proof(),randomUUID());f.setClock(1200);
  await expect(f.service.admit(userId,proof(1060,randomUUID()))).rejects.toMatchObject({code:'fresh_signin_required'});
  await f.service.admit(userId,proof(1061,randomUUID()));
 });
 it('preserves established admission before revocation but fails closed afterward without proof',async()=>{
  const f=fixture();await f.service.admit(userId,null);await f.service.revoke(userId,proof(),randomUUID());
  await expect(f.service.admit(userId,null)).rejects.toMatchObject({code:'fresh_signin_required'});
 });
});
