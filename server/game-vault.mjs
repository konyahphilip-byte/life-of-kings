import {createHash} from 'node:crypto';
import {emptyVault,normalizeVault} from '../shared/game-vault.mjs';
export const GAME_VAULT_VERSION='20261108210000_game_vault';
export const GAME_VAULT_SQLITE_SCHEMA='CREATE TABLE IF NOT EXISTS game_vaults(owner_id TEXT PRIMARY KEY REFERENCES users(id),revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 1000000),snapshot_json TEXT NOT NULL,payload_hash TEXT NOT NULL,receipts_json TEXT NOT NULL,updated_at TEXT NOT NULL);';
const fault=(status,code,message)=>{throw Object.assign(new Error(message),{status,code});};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest=json=>createHash('sha256').update(json).digest('hex');
const decode=v=>typeof v==='string'?JSON.parse(v):v;
export function createGameVault({q,run,now,rateLimit,available=false}){
 async function current(owner){return q('SELECT revision,snapshot_json,payload_hash,receipts_json,updated_at FROM game_vaults WHERE owner_id=?',owner);}
 function response(row,owner,savedRevision){
  let vault;try{vault=row?normalizeVault(decode(row.snapshot_json)):emptyVault();}catch{fault(500,'vault_integrity','Saved project data could not be verified. Keep your backup and report the error.');}
  const sha256=digest(JSON.stringify(vault));if(row&&sha256!==row.payload_hash)fault(500,'vault_integrity','Saved project integrity check failed. No empty replacement was created.');
  return {ownerId:owner,revision:row?.revision??0,vault,sha256,updatedAt:row?.updated_at??null,...(savedRevision!==undefined?{savedRevision}:{})};
 }
 function receipts(row){try{const value=row?decode(row.receipts_json):[];if(!Array.isArray(value)||value.length>50)throw Error();return value;}catch{fault(500,'vault_integrity','Save receipts could not be verified.');}}
 return {async route(ctx,method,body,query){
  if(!ctx.user)fault(401,'sign_in_required','Sign in before opening your project Vault.');
  if(ctx.user.status!=='active')fault(403,'account_unavailable','This account is unavailable.');
  if(!available)fault(503,'game_vault_unavailable','The project Vault is awaiting its reviewed database release.');
  if([...query.keys()].length)fault(400,'invalid_vault_query','The Vault does not accept account selectors.');
  const owner=ctx.user.id;await rateLimit('game-vault:'+ (method==='GET'?'read:':'write:')+owner,method==='GET'?30:10,60000);
  if(method==='GET')return response(await current(owner),owner);
  if(method!=='PUT')fault(405,'method_not_allowed','Use the project save action.');
  if(!body||Object.keys(body).sort().join(',')!=='consent,expectedOwnerId,operationId,revision,vault'||!uuid.test(body.operationId??'')||!Number.isSafeInteger(body.revision)||body.revision<0||body.revision>1000000||body.consent!=='private-storage-v1')fault(400,'invalid_vault_save','Save requires private-storage consent, a current revision and an operation ID.');
  if(body.expectedOwnerId!==owner)fault(409,'account_changed','Your account changed. Reopen your own Vault.');
  let vault;try{vault=normalizeVault(body.vault);}catch(e){fault(400,'invalid_vault',e.message);}
  const json=JSON.stringify(vault),hash=digest(json),operationId=body.operationId.toLowerCase();
  function replay(row){const r=receipts(row).find(r=>r.operationId===operationId);if(!r)return null;if(r.hash!==hash||r.base!==body.revision)fault(409,'operation_conflict','That save ID belongs to a different project change.');return response(row,owner,r.base+1);}
  const row=await current(owner),retry=replay(row);if(retry)return {...retry,replayed:true};
  if((row?.revision??0)!==body.revision)fault(409,'vault_conflict','A newer Vault exists. Export your current draft before reloading.');
  if(body.revision>=1000000)fault(429,'vault_limit','The pilot revision limit has been reached. Export your work.');
  const next=body.revision+1,at=now(),journal=JSON.stringify([...receipts(row).slice(-49),{operationId,base:body.revision,hash}]);
  try{
   const result=row?await run('UPDATE game_vaults SET revision=?,snapshot_json=?,payload_hash=?,receipts_json=?,updated_at=? WHERE owner_id=? AND revision=?',next,json,hash,journal,at,owner,body.revision):
    await run('INSERT INTO game_vaults(owner_id,revision,snapshot_json,payload_hash,receipts_json,updated_at) VALUES(?,?,?,?,?,?)',owner,next,json,hash,journal,at);
   if(!result.changes){const head=await current(owner),replayed=replay(head);if(replayed)return {...replayed,replayed:true};fault(409,'vault_conflict','Another save completed first. Your draft has not replaced it.');}
  }catch(e){if(e.code==='23505'||e.errcode===1555||e.errcode===2067){const replayed=replay(await current(owner));if(replayed)return {...replayed,replayed:true};fault(409,'vault_conflict','Another save completed first. Keep your draft.');}throw e;}
  return response(await current(owner),owner,next);
 }};
}
