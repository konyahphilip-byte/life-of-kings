// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync, sign, randomUUID } from 'node:crypto';
import { authenticateSupabaseRequest } from './supabase-auth.mjs';
const owner=randomUUID(),sid=randomUUID(),issuer='https://synthetic-auth.example.invalid/auth/v1';
const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'P-256'});
const jwk={...publicKey.export({format:'jwk'}),kid:'synthetic-test-key',alg:'ES256',use:'sig'};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
function jwt(patch={}){
 const now=Math.floor(Date.now()/1000);
 const head=encode({alg:'ES256',typ:'JWT',kid:jwk.kid});
 const payload=encode({iss:issuer,aud:'authenticated',sub:owner,role:'authenticated',iat:now-10,exp:now+3600,session_id:sid,aal:'aal2',amr:[{method:'password',timestamp:now-30}],...patch});
 const input=`${head}.${payload}`;
 return `${input}.${sign('sha256',Buffer.from(input),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')}`;
}
const request=token=>({url:'/api/v1/auth/supabase/session',headers:{authorization:`Bearer ${token}`}});
describe('actual installed Supabase signature boundary with synthetic keys',()=>{
 beforeEach(()=>{
  vi.stubEnv('SUPABASE_URL','https://synthetic-auth.example.invalid');
  vi.stubEnv('SUPABASE_JWKS',JSON.stringify({keys:[jwk]}));
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY','sb_publishable_synthetic_test');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEYS',JSON.stringify({default:'sb_publishable_synthetic_test'}));
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({id:owner,email_confirmed_at:'2026-10-01T00:00:00Z'})));
 });
 afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
 it('verifies a real signature before returning only validated internal context',async()=>{
  const result=await authenticateSupabaseRequest(request(jwt()));
  expect(result.error).toBe(null);expect(result.user.id).toBe(owner);
  expect(result.authContext.sessionId).toBe(sid);expect(result.assuranceLevel).toBe('aal2');
 });
 it('rejects tampering, wrong issuer and expired signed tokens before user lookup',async()=>{
  const valid=jwt(),parts=valid.split('.');
  parts[1]=encode({...JSON.parse(Buffer.from(parts[1],'base64url')),aal:'aal1'});
  for(const value of [parts.join('.'),jwt({iss:'https://other.invalid/auth/v1'}),jwt({iat:1,exp:2})]){
   const result=await authenticateSupabaseRequest(request(value));expect(result.error).toBeTruthy();expect(result.authContext).toBeUndefined();
  }
  expect(fetch).not.toHaveBeenCalled();
 });
 it('binds signed subject to the authoritative provider user',async()=>{
  vi.mocked(fetch).mockResolvedValue(Response.json({id:randomUUID()}));
  const result=await authenticateSupabaseRequest(request(jwt()));expect(result.error?.status).toBe(401);expect(result.authContext).toBeUndefined();
 });
});
