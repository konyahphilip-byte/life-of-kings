type RecoverySession = { access_token: string; user: { id: string }; expires_at?: number };
export type RecoveryOperation = ReturnType<typeof createRecoveryOperation>;

// Bind destructive recovery requests to an immutable token snapshot, rather
// than Auth SDK methods that reread another tab's mutable session storage.
// No refresh token, password, credential or provider response is persisted.
export function createRecoveryOperation({url,publishableKey,session,fetcher=fetch,now=Date.now}:{
  url:string;publishableKey:string;session:RecoverySession;fetcher?:typeof fetch;now?:()=>number;
}) {
  const base=new URL(url);
  if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw new Error('Account recovery is unavailable.');
  const ownerId=session.user.id;
  const operationId=crypto.randomUUID();
  let token=session.access_token;
  let signedOut=false;
  const until=Math.min(Number(session.expires_at)*1000,now()+10*60_000);
  if(!Number.isFinite(until)||until<=now()||!token||!ownerId)throw new Error('Recovery authorization expired. Request a new recovery link.');
  let timer:ReturnType<typeof setTimeout>|undefined;
  const dispose=()=>{token='';if(timer)clearTimeout(timer);};
  timer=setTimeout(dispose,Math.max(0,until-now()));
  const authorization=()=>{if(!token||now()>=until){dispose();throw new Error('Recovery authorization expired. Sign in again before requesting another recovery link.');}return `Bearer ${token}`;};
  const request=(path:string,method:string,body?:unknown)=>fetcher(new URL(path,base),{
    method,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(10_000),
    headers:{apikey:publishableKey,Authorization:authorization(),...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
  });
  return {
    ownerId,operationId,authorization,dispose,
    get signedOut(){return signedOut;},
    async updatePassword(password:string){
      if(password.length<12||password.length>256)throw new Error('Use a password with 12–256 characters.');
      let response:Response;
      try{response=await request('/auth/v1/user','PUT',{password});}catch{throw new Error('The password save could not be confirmed. Try signing in with the new password before requesting another reset.');}
      if(!response.ok)throw new Error('The password update was not accepted. Check the password requirements or request a new recovery link.');
      const result=await response.json().catch(()=>null);
      if((result?.id??result?.user?.id)!==ownerId)throw new Error('The password save response could not be verified. Try signing in with the new password before requesting another reset.');
    },
    async signOut(){
      if(signedOut)return;
      let response:Response;
      try{response=await request('/auth/v1/logout?scope=global','POST');}catch{throw new Error('Provider sign-out could not be confirmed. Choose Finish signing out to retry.');}
      if(response.status!==200&&response.status!==204)throw new Error('Provider sign-out could not be confirmed. Choose Finish signing out to retry.');
      signedOut=true;dispose();
    },
  };
}
