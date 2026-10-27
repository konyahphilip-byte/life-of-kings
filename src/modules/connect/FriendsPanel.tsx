import { useCallback,useEffect,useLayoutEffect,useRef,useState } from 'react';
import { apiUrl } from '../../lib/api';
import type { PublicPerson } from './PeopleLookup';
import './people-lookup.css';

type FriendState={state:string;revision:number;actions:string[]};
type Entry=PublicPerson&FriendState;
type Inbox={incoming:Entry[];outgoing:Entry[];friends:Entry[];blocked:Entry[];truncated:Record<string,boolean>};
const labels:Record<string,string>={request:'Add friend',accept:'Accept',decline:'Decline',cancel:'Cancel request',remove:'Remove friend',block:'Block requests',unblock:'Unblock requests'};
const statuses:Record<string,string>={none:'',incoming:'Wants to add you',outgoing:'Request sent',friends:'Friends',blocked:'Requests blocked',unavailable:'This connection is unavailable',cooldown:'You can send another request later'};
type RefreshOutcome='ok'|'retry'|'auth'|'skip';
class FriendRequestError extends Error { constructor(message:string,readonly status:number){super(message);} }
async function friendRequest(path:string,signal:AbortSignal,csrfToken:string,body?:unknown){
 const controller=new AbortController();let timedOut=false;
 const abort=()=>controller.abort();if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
 const deadline=window.setTimeout(()=>{timedOut=true;controller.abort();},10_000);
 try{
  const response=await fetch(apiUrl(path),{credentials:'include',signal:controller.signal,...(body?{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify(body)}:{})});
  const data=await response.json();if(!response.ok)throw new FriendRequestError(data.error?.message||'Friends are unavailable. Please refresh.',response.status);return data;
 }catch(error){if(timedOut)throw new FriendRequestError('The connection timed out. Refresh to check the latest request status.',0);throw error;}
 finally{window.clearTimeout(deadline);signal.removeEventListener('abort',abort);}
}
const canRefresh=()=>document.visibilityState==='visible'&&navigator.onLine;
// Foreground polling, not push delivery. Completion-based scheduling avoids
// overlap; failed reads back off and expired authentication stops the loop.
function useForegroundRefresh(enabled:boolean,load:()=>Promise<RefreshOutcome>,pause:()=>void){
 useEffect(()=>{
  if(!enabled)return;
  let disposed=false,active=false,again=false,failures=0,authPaused=false,timer:number|undefined;
  const clear=()=>{window.clearTimeout(timer);timer=undefined;};
  async function run(force=false){
   clear();if(disposed)return;if(force)authPaused=false;
   if(!canRefresh()){pause();return;}if(authPaused)return;
   if(active){again=again||force;return;}active=true;
   try{const outcome=await load();if(outcome==='auth')authPaused=true;else if(outcome==='ok')failures=0;else if(outcome==='retry')failures++;}
   finally{
    active=false;if(disposed)return;
    if(again){again=false;void run(true);}
    else if(canRefresh()&&!authPaused)timer=window.setTimeout(()=>void run(),Math.min(15_000*2**Math.min(failures,3),120_000));
   }
  }
  const resume=()=>void run(true),visibility=()=>{if(canRefresh())resume();else{clear();pause();}};
  void run();document.addEventListener('visibilitychange',visibility);window.addEventListener('offline',visibility);
  for(const name of ['focus','online','ecovibes:friends_changed'])window.addEventListener(name,resume);
  return()=>{disposed=true;clear();pause();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('offline',visibility);for(const name of ['focus','online','ecovibes:friends_changed'])window.removeEventListener(name,resume);};
 },[enabled,load,pause]);
}
function checkedState(data:FriendState){
 if(!data||!Object.hasOwn(statuses,data.state)||!Number.isSafeInteger(data.revision)||data.revision<0||!Array.isArray(data.actions)||data.actions.some(action=>!Object.hasOwn(labels,action)))throw Error('Friends are unavailable. Please refresh.');
 return data;
}
export function FriendActions({userId,csrfToken,person,initialState}:{userId:string;csrfToken:string;person:PublicPerson;initialState?:FriendState}) {
 const [state,setState]=useState<FriendState|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const generation=useRef(0),pending=useRef<AbortController|null>(null),path=`/people/friends/${encodeURIComponent(person.id)}`;
 const pause=useCallback(()=>{++generation.current;pending.current?.abort();pending.current=null;setBusy(false);},[]);
 const load=useCallback(async():Promise<RefreshOutcome>=>{
  if(!canRefresh()||pending.current&&!pending.current.signal.aborted)return 'skip';
  const revision=++generation.current,controller=new AbortController();pending.current=controller;setBusy(true);setMessage('');
  try{const data=checkedState(await friendRequest(path,controller.signal,csrfToken));if(revision===generation.current&&!controller.signal.aborted)setState(data);return 'ok';}
  catch(e){if(revision===generation.current&&!controller.signal.aborted){setState(null);setMessage(e instanceof Error?e.message:'Friends are unavailable.');}return e instanceof FriendRequestError&&[401,403].includes(e.status)?'auth':'retry';}
  finally{if(revision===generation.current){setBusy(false);pending.current=null;}}
 },[userId,path,csrfToken]);
 useLayoutEffect(()=>{
  ++generation.current;pending.current?.abort();setMessage('');setBusy(false);setState(initialState?checkedState(initialState):null);
  return()=>{++generation.current;pending.current?.abort();};
 },[userId,path,load,initialState?.revision]);
 useForegroundRefresh(!initialState,load,pause);
 async function change(action:string){
  if(!state||busy)return;
  const revision=++generation.current;pending.current?.abort();const controller=new AbortController();pending.current=controller;setBusy(true);setMessage('');
  try{
   const result=checkedState(await friendRequest(path,controller.signal,csrfToken,{action,revision:state.revision}));
   if(revision!==generation.current)return;
   setState(result);window.dispatchEvent(new Event('ecovibes:friends_changed'));
  }catch(e){if(revision===generation.current&&!controller.signal.aborted){setMessage(e instanceof Error?e.message:'The request could not be completed.');setState(null);}}
  finally{if(revision===generation.current){setBusy(false);pending.current=null;}}
 }
 return <div className="friend-actions" aria-label={`Friend controls for ${person.display_name}`}>
  {state&&<><span role="status">{statuses[state.state]}</span><div>{state.actions.map(action=><button type="button" key={action} disabled={busy||!csrfToken} className={['block','remove','decline'].includes(action)?'friend-secondary':''} onClick={()=>void change(action)}>{labels[action]}</button>)}</div></>}
  {busy&&<span role="status">Updating friends…</span>}{message&&<p role="status">{message}</p>}
  {!state&&!busy&&<button type="button" onClick={()=>{if(initialState)void load().then(result=>{if(result==='ok')window.dispatchEvent(new Event('ecovibes:friends_changed'));});else window.dispatchEvent(new Event('ecovibes:friends_changed'));}}>Refresh connection</button>}
 </div>;
}
export default function FriendsPanel({userId,csrfToken,onSelect}:{userId:string|null;csrfToken:string;onSelect:(person:PublicPerson)=>void}) {
 const [inbox,setInbox]=useState<Inbox|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const generation=useRef(0),pending=useRef<AbortController|null>(null);
 const pause=useCallback(()=>{++generation.current;pending.current?.abort();pending.current=null;setBusy(false);},[]);
 const load=useCallback(async():Promise<RefreshOutcome>=>{
  if(!userId||!canRefresh()||pending.current&&!pending.current.signal.aborted)return 'skip';
  const revision=++generation.current,controller=new AbortController();pending.current=controller;setBusy(true);setMessage('');
  try{
   const data=await friendRequest('/people/friends',controller.signal,csrfToken);
   if(!['incoming','outgoing','friends','blocked'].every(key=>Array.isArray(data[key])&&data[key].length<=50&&data[key].every((entry:Entry)=>typeof entry.id==='string'&&typeof entry.eco_id==='string'&&typeof entry.display_name==='string'&&checkedState(entry))))throw Error('Friends are unavailable. Please refresh.');
   if(revision===generation.current&&!controller.signal.aborted)setInbox(data);return 'ok';
  }catch(e){if(revision===generation.current&&!controller.signal.aborted){setInbox(null);setMessage(e instanceof Error?e.message:'Friends are unavailable.');}return e instanceof FriendRequestError&&[401,403].includes(e.status)?'auth':'retry';}
  finally{if(revision===generation.current){setBusy(false);pending.current=null;}}
 },[userId,csrfToken]);
 useLayoutEffect(()=>{++generation.current;pending.current?.abort();setInbox(null);setMessage('');setBusy(false);return()=>{++generation.current;pending.current?.abort();};},[userId]);
 useForegroundRefresh(Boolean(userId),load,pause);
 if(!userId)return null;
 return <section className="people-lookup friends-panel" aria-label="Friends & requests"><header><h2>Friends & requests</h2><button type="button" disabled={busy} onClick={()=>window.dispatchEvent(new Event('ecovibes:friends_changed'))} aria-label="Refresh friends">{busy?'Refreshing…':'Refresh'}</button></header>
  <p>Checks for new requests while this page is open and online. Accepting does not start a call or share your phone number.</p>
  {message&&<p role="status">{message}</p>}
  {inbox&&(['incoming','friends','outgoing','blocked'] as const).map(kind=><section key={kind} aria-label={{incoming:'Incoming requests',friends:'Your friends',outgoing:'Sent requests',blocked:'Blocked requests'}[kind]}>
   <h3>{{incoming:'Incoming requests',friends:'Your friends',outgoing:'Sent requests',blocked:'Blocked requests'}[kind]}</h3>
   {inbox[kind].length===0?<p>None right now.</p>:inbox[kind].map(person=><article key={person.id}><div className="friend-person"><strong>{person.display_name}</strong><span>@{person.eco_id}</span>{kind==='friends'&&<button type="button" onClick={()=>onSelect(person)}>Select person</button>}</div><FriendActions key={`${userId}:${person.id}`} userId={userId} csrfToken={csrfToken} person={person} initialState={person}/></article>)}
   {inbox.truncated?.[kind]&&<p>Showing the most recent 50. Find other people by their exact EcoVibes ID.</p>}
  </section>)}
 </section>;
}
