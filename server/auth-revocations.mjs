// Internal verified authentication context. Never call this on an unverified
// credential; signature/issuer verification and authoritative user lookup come first.
export const AUTH_REVOCATIONS_VERSION='20261027121500_identity_auth_revocations';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const primaryMethods=new Set(['password','oauth','otp','recovery','invite','sso/saml','magiclink','email/signup']);
const CLOCK_ALLOWANCE_SECONDS=60;
const fail=(status,code,message)=>{throw Object.assign(new Error(message),{status,code});};
export function extractVerifiedAuthContext(token,ownerId,nowSeconds=Math.floor(Date.now()/1000)){
 let claims;
 try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));}catch{fail(401,'invalid_auth_context','Sign in again.');}
 if(claims?.sub!==ownerId||!uuid.test(claims.session_id||'')||!Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||claims.iat<0||claims.iat>nowSeconds+CLOCK_ALLOWANCE_SECONDS||claims.exp<=nowSeconds||claims.exp<=claims.iat)fail(401,'invalid_auth_context','Sign in again.');
 let primaryAuthAt=null;
 if(claims.amr!==undefined&&!Array.isArray(claims.amr))fail(401,'invalid_auth_context','Sign in again.');
 for(const method of claims.amr||[]){
  if(!primaryMethods.has(method?.method))continue;
  if(!Number.isSafeInteger(method.timestamp)||method.timestamp<0||method.timestamp>claims.iat)fail(401,'invalid_auth_context','Sign in again.');
  primaryAuthAt=Math.max(primaryAuthAt??0,method.timestamp);
 }
 return Object.freeze({sessionId:claims.session_id.toLowerCase(),issuedAt:claims.iat,expiresAt:claims.exp,primaryAuthAt});
}
export const AUTH_REVOCATIONS_SQLITE_SCHEMA=`
 CREATE TABLE IF NOT EXISTS identity_auth_state(user_id TEXT PRIMARY KEY REFERENCES users(id),auth_after INTEGER NOT NULL CHECK(auth_after>=0),revision INTEGER NOT NULL CHECK(revision>0));
 CREATE TABLE IF NOT EXISTS identity_provider_sessions(user_id TEXT NOT NULL REFERENCES users(id),provider_session_id TEXT NOT NULL,revoked_at INTEGER,PRIMARY KEY(user_id,provider_session_id));
 CREATE TABLE IF NOT EXISTS auth_revocation_operations(user_id TEXT NOT NULL REFERENCES users(id),operation_id TEXT NOT NULL,provider_session_id TEXT NOT NULL,auth_after INTEGER NOT NULL,revision INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,operation_id));
`;

// All methods MUST run in the caller's transaction. The mapped users row is the
// shared admission/revocation lock, across API instances. No private Auth tables.
export function createAuthRevocations({q,run,postgresMode,nowSeconds=()=>Math.floor(Date.now()/1000)}){
 async function lock(userId){
  const row=await q(`SELECT id FROM users WHERE id=?${postgresMode?' FOR UPDATE':''}`,userId);
  if(!row)fail(401,'account_unavailable','This account is unavailable.');
 }
 async function requireFresh(userId,proof,state){
  if(!state)return;
  const revoked=proof?.sessionId&&await q('SELECT revoked_at FROM identity_provider_sessions WHERE user_id=? AND provider_session_id=?',userId,proof.sessionId);
  if(!proof||!uuid.test(proof.sessionId||'')||!Number.isSafeInteger(proof.primaryAuthAt)||proof.primaryAuthAt<=Number(state.auth_after)||proof.primaryAuthAt>nowSeconds()||proof.expiresAt<=nowSeconds()||revoked?.revoked_at!=null)fail(401,'fresh_signin_required','Account access was reset. Wait one minute, then sign in again with your email and new password.');
 }
 async function remember(userId,proof){
  if(proof?.sessionId)await run('INSERT INTO identity_provider_sessions(user_id,provider_session_id,revoked_at) VALUES(?,?,NULL) ON CONFLICT(user_id,provider_session_id) DO NOTHING',userId,proof.sessionId);
 }
 return{
  async admit(userId,proof){
   await lock(userId);
   await requireFresh(userId,proof,await q('SELECT auth_after,revision FROM identity_auth_state WHERE user_id=?',userId));
   await remember(userId,proof);
  },
  async revoke(userId,proof,operationId){
   if(!uuid.test(operationId||''))fail(400,'invalid_operation','A recovery operation reference is required.');
   operationId=operationId.toLowerCase();
   if(!uuid.test(proof?.sessionId||''))fail(401,'invalid_auth_context','Sign in again to finish account cleanup.');
   await lock(userId);
   const prior=await q('SELECT provider_session_id,auth_after,revision FROM auth_revocation_operations WHERE user_id=? AND operation_id=?',userId,operationId);
   if(prior){
    if(prior.provider_session_id!==proof.sessionId)fail(409,'revocation_operation_conflict','This recovery reference belongs to a different sign-in.');
    return{replayed:true,revision:Number(prior.revision)};
   }
   const state=await q('SELECT auth_after,revision FROM identity_auth_state WHERE user_id=?',userId);
   await requireFresh(userId,proof,state);
   // Cover the allowed positive provider clock skew. Tokens from previously
   // unseen sessions cannot masquerade as a later primary sign-in in this window.
   const authAfter=nowSeconds()+CLOCK_ALLOWANCE_SECONDS,revision=Number(state?.revision||0)+1;
   await run('INSERT INTO identity_auth_state(user_id,auth_after,revision) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET auth_after=excluded.auth_after,revision=excluded.revision',userId,authAfter,revision);
   await remember(userId,proof);
   await run('UPDATE identity_provider_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL',nowSeconds(),userId);
   await run('DELETE FROM sessions WHERE user_id=?',userId);
   await run('INSERT INTO auth_revocation_operations(user_id,operation_id,provider_session_id,auth_after,revision,created_at) VALUES(?,?,?,?,?,?)',userId,operationId,proof.sessionId,authAfter,revision,nowSeconds());
   return{replayed:false,revision};
  },
 };
}
