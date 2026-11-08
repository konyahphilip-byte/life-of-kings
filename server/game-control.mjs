import {createHash} from 'node:crypto';
import {emptyWorkspace,normalizeWorkspace} from '../shared/game-control.mjs';
export const GAME_CONTROL_VERSION='20261108150000_game_control_revisions';
export const GAME_CONTROL_SQLITE_SCHEMA=`CREATE TABLE IF NOT EXISTS game_control_revisions(
 owner_id TEXT NOT NULL REFERENCES users(id),revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 100),
 operation_id TEXT NOT NULL,payload_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(owner_id,revision),UNIQUE(owner_id,operation_id));`;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fault=(status,code,message)=>{throw Object.assign(new Error(message),{status,code});};
export function createGameControl({q,run,all,now,rateLimit,available=false}){
 async function read(owner){
  const row=await q('SELECT revision,snapshot_json,created_at FROM game_control_revisions WHERE owner_id=? ORDER BY revision DESC LIMIT 1',owner);
  const history=await all('SELECT revision,payload_hash,created_at FROM game_control_revisions WHERE owner_id=? ORDER BY revision DESC LIMIT 20',owner);
  return {ownerId:owner,revision:row?.revision??0,workspace:row?normalizeWorkspace(typeof row.snapshot_json==='string'?JSON.parse(row.snapshot_json):row.snapshot_json):emptyWorkspace(),history:history.map(r=>({revision:r.revision,sha256:r.payload_hash,createdAt:r.created_at})),authority:'user-reported',releaseAuthorized:false};
 }
 return {async route(ctx,method,body,query){
  if(!ctx.user)fault(401,'sign_in_required','Sign in to your EcoVibes account to open your private Games workspace.');
  if(ctx.user.status!=='active')fault(403,'account_unavailable','This account is unavailable.');
  if(!available)fault(503,'game_control_unavailable','The private Games workspace is awaiting its reviewed database release.');
  if([...query.keys()].length)fault(400,'invalid_control_query','This workspace does not accept account selectors.');
  const owner=ctx.user.id;
  await rateLimit('game-control:'+owner,method==='GET'?30:10,60000);
  if(method==='GET')return read(owner);
  if(method!=='PUT')fault(405,'method_not_allowed','Use the workspace save action.');
  if(!body||Object.keys(body).sort().join(',')!=='expectedOwnerId,operationId,revision,workspace'||!uuid.test(body.operationId??'')||!Number.isSafeInteger(body.revision)||body.revision<0||body.revision>99)fault(400,'invalid_control_save','Save requires an operation ID and the current workspace revision.');
  if(body.expectedOwnerId!==owner)fault(409,'account_changed','Your account changed. Reopen your own workspace before saving.');
  let workspace;try{workspace=normalizeWorkspace(body.workspace);}catch(e){fault(400,'invalid_control_workspace',e.message);}
  const json=JSON.stringify(workspace),digest=createHash('sha256').update(json).digest('hex');
  async function replay(){
   const row=await q('SELECT revision,payload_hash FROM game_control_revisions WHERE owner_id=? AND operation_id=?',owner,body.operationId);
   if(!row)return null;
   if(row.payload_hash!==digest||row.revision!==body.revision+1)fault(409,'operation_conflict','That save ID already belongs to a different change.');
   return {...await read(owner),replayed:true};
  }
  const previous=await replay();if(previous)return previous;
  const current=await q('SELECT COALESCE(MAX(revision),0) revision FROM game_control_revisions WHERE owner_id=?',owner);
  if(current.revision!==body.revision)fault(409,'workspace_conflict','A newer workspace exists. Export your draft and refresh before trying again.');
  if(current.revision>=100)fault(429,'workspace_limit','The pilot revision limit has been reached. Export your workspace; no draft was saved.');
  try{
   const result=await run('INSERT INTO game_control_revisions(owner_id,revision,operation_id,payload_hash,snapshot_json,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COALESCE(MAX(revision),0) FROM game_control_revisions WHERE owner_id=?)=?',owner,body.revision+1,body.operationId,digest,json,now(),owner,body.revision);
   if(!result.changes){const retry=await replay();if(retry)return retry;fault(409,'workspace_conflict','A newer workspace exists. Your draft has not replaced it.');}
  }catch(e){
   if(e.code==='23505'||e.errcode===1555||e.errcode===2067){const retry=await replay();if(retry)return retry;fault(409,'workspace_conflict','Another save completed first. Keep your draft and refresh.');}
   throw e;
  }
  return read(owner);
 }};
}
