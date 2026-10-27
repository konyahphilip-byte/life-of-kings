type BrowserSessionResult={data:{session:{user:{id:string}}|null};error?:{code?:string}|null};
type BrowserAuth={refreshSession:()=>PromiseLike<BrowserSessionResult>;getSession:()=>PromiseLike<BrowserSessionResult>};
const unconfirmed='Your password was updated and provider sign-out was accepted, but browser session refresh is unconfirmed. Choose Finish signing out to retry.';
const expectedExpiry=new Set(['refresh_token_not_found','refresh_token_already_used','session_not_found','session_expired']);

// A rejected proactive refresh can return session:null while the SDK retains
// the unexpired original session. Require an independent public getSession read
// before clearing recovery UI. Never remove storage or sign out a mutable account.
export async function confirmRecoveryBrowserState(auth:BrowserAuth,ownerId:string):Promise<void>{
 try{
  const refreshed=await auth.refreshSession();
  if(refreshed.error&&!expectedExpiry.has(refreshed.error.code||''))throw new Error(unconfirmed);
  const current=await auth.getSession();
  if(current.error||!current.data||!Object.hasOwn(current.data,'session'))throw new Error(unconfirmed);
  const session=current.data.session;
  if(session!==null&&(typeof session?.user?.id!=='string'||!session.user.id.trim()||session.user.id===ownerId))throw new Error(unconfirmed);
 }catch{throw new Error(unconfirmed);}
}
