// @vitest-environment node
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {confirmRecoveryBrowserState} from './recovery-browser';

const clients:SupabaseClient[]=[];
afterEach(async()=>{for(const client of clients.splice(0))await client.auth.stopAutoRefresh();});
function sdkFixture(owner='synthetic-recovery-owner'){
 const storageKey=`synthetic-recovery-${crypto.randomUUID()}`,exp=Math.floor(Date.now()/1000)+3600;
 const encode=(value:unknown)=>btoa(JSON.stringify(value)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const access_token=`${encode({alg:'none'})}.${encode({sub:owner,session_id:crypto.randomUUID(),exp})}.synthetic`;
 const memory=new Map([[storageKey,JSON.stringify({access_token,refresh_token:'synthetic-refresh-only',expires_at:exp,expires_in:3600,token_type:'bearer',user:{id:owner}})]]);
 const removeItem=vi.fn((key:string)=>{memory.delete(key);});
 const fetcher=vi.fn<typeof fetch>(async(input)=>{
  if(!String(input).includes('/auth/v1/token'))throw new Error('Unexpected synthetic endpoint');
  return Response.json({code:'refresh_token_not_found',error_code:'refresh_token_not_found',message:'Synthetic revoked refresh token'},{status:400});
 });
 const client=createClient('https://synthetic-recovery.invalid','sb_publishable_synthetic',{auth:{storageKey,storage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>{memory.set(key,value);},removeItem},persistSession:true,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:fetcher}});
 clients.push(client);return{client,memory,storageKey,removeItem,fetcher};
}
describe('recovery browser completion confirmation',()=>{
 it('reproduces retained unexpired session after rejection with the actual installed SDK',async()=>{
  const f=sdkFixture();await f.client.auth.getSession();
  const refreshed=await f.client.auth.refreshSession();
  expect(refreshed.error?.code).toBe('refresh_token_not_found');expect(refreshed.data.session).toBeNull();
  expect(f.memory.has(f.storageKey)).toBe(true);expect((await f.client.auth.getSession()).data.session?.user.id).toBe('synthetic-recovery-owner');
  await expect(confirmRecoveryBrowserState(f.client.auth,'synthetic-recovery-owner')).rejects.toThrow('browser session refresh is unconfirmed');
  expect(f.removeItem).not.toHaveBeenCalled();expect(f.fetcher).toHaveBeenCalledOnce();
 });
 it('preserves another current account under the installed SDK without deleting storage',async()=>{
  const f=sdkFixture('synthetic-other-account');await f.client.auth.getSession();
  await confirmRecoveryBrowserState(f.client.auth,'synthetic-recovery-owner');
  expect((await f.client.auth.getSession()).data.session?.user.id).toBe('synthetic-other-account');expect(f.removeItem).not.toHaveBeenCalled();
 });
 it('does not delete a newer session belonging to the original account',async()=>{
  const f=sdkFixture();await f.client.auth.getSession();
  await expect(confirmRecoveryBrowserState(f.client.auth,'synthetic-recovery-owner')).rejects.toThrow('unconfirmed');
  expect(f.memory.has(f.storageKey)).toBe(true);expect(f.removeItem).not.toHaveBeenCalled();
 });
 it('requires a fresh read even when refresh reports no session and no error',async()=>{
  const auth={refreshSession:vi.fn(async()=>({data:{session:null},error:null})),getSession:vi.fn(async()=>({data:{session:{user:{id:'owner'}}},error:null}))};
  await expect(confirmRecoveryBrowserState(auth,'owner')).rejects.toThrow('unconfirmed');expect(auth.getSession).toHaveBeenCalledOnce();
 });
 it('allows completion after an independent successful read confirms no current session',async()=>{
  const auth={refreshSession:vi.fn(async()=>({data:{session:null},error:{code:'refresh_token_not_found'}})),getSession:vi.fn(async()=>({data:{session:null},error:null}))};
  await confirmRecoveryBrowserState(auth,'owner');expect(auth.getSession).toHaveBeenCalledOnce();
 });
 it('does not treat a failed or malformed final read as proof of sign-out',async()=>{
  for(const result of [{data:{session:null},error:{code:'unknown'}},{data:{}},{data:{session:{user:{}}}},{data:{session:{user:{id:123}}}},{data:{session:{user:{id:{}}}}},{data:{session:{user:{id:'   '}}}}]){
   const auth={refreshSession:vi.fn(async()=>({data:{session:null},error:null})),getSession:vi.fn(async()=>result)};
   await expect(confirmRecoveryBrowserState(auth as Parameters<typeof confirmRecoveryBrowserState>[0],'owner')).rejects.toThrow('unconfirmed');
  }
 });
 it('retains an unconfirmed state on unknown refresh errors or thrown network errors',async()=>{
  const getSession=vi.fn(async()=>({data:{session:null},error:null}));
  await expect(confirmRecoveryBrowserState({getSession,refreshSession:async()=>({data:{session:null},error:{code:'unknown'}})},'owner')).rejects.toThrow('unconfirmed');
  await expect(confirmRecoveryBrowserState({getSession,refreshSession:async()=>{throw new Error('Synthetic network interruption');}},'owner')).rejects.toThrow('unconfirmed');
  expect(getSession).not.toHaveBeenCalled();
 });
});
