import { useCallback,useEffect,useLayoutEffect,useRef,useState } from 'react';
import { apiUrl } from '../../lib/api';
import type { PublicPerson } from './PeopleLookup';
import './people-lookup.css';

type FriendState={state:string;revision:number;actions:string[]};
type Entry=PublicPerson&FriendState;
type Inbox={incoming:Entry[];outgoing:Entry[];friends:Entry[];blocked:Entry[];truncated:Record<string,boolean>};
const labels:Record<string,string>={request:'Add friend',accept:'Accept',decline:'Decline',cancel:'Cancel request',remove:'Remove friend',block:'Block requests',unblock:'Unblock requests'};
const statuses:Record<string,string>={none:'',incoming:'Wants to add you',outgoing:'Request sent',friends:'Friends',blocked:'Requests blocked',unavailable:'This connection is unavailable',cooldown:'You can send another request later'};
async function friendRequest(path:string,signal:AbortSignal,csrfToken:string,body?:unknown){
 const response=await fetch(apiUrl(path),{credentials:'include',signal,...(body?{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify(body)}:{})});
 const data=await response.json();if(!response.ok)throw Error(data.error?.message||'Friends are unavailable. Please refresh.');return data;
}
function checkedState(data:FriendState){
 if(!data||!Object.hasOwn(statuses,data.state)||!Number.isSafeInteger(data.revision)||data.revision<0||!Array.isArray(data.actions)||data.actions.some(action=>!Object.hasOwn(labels,action)))throw Error('Friends are unavailable. Please refresh.');
 return data;
}
export function FriendActions({userId,csrfToken,person,initialState}:{userId:string;csrfToken:string;person:PublicPerson;initialState?:FriendState}) {
 const [state,setState]=useState<FriendState|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const generation=useRef(0),pending=useRef<AbortController|null>(null),path=`/people/friends/${encodeURIComponent(person.id)}`;
 const load=useCallback(async()=>{
  const revision=++generation.current;pending.current?.abort();const controller=new AbortController();pending.current=controller;setBusy(true);setState(null);setMessage('');
  try{const data=checkedState(await friendRequest(path,controller.signal,csrfToken));if(revision===generation.current)setState(data);}
  catch(e){if(revision===generation.current&&!controller.signal.aborted)setMessage(e instanceof Error?e.message:'Friends are unavailable.');}
  finally{if(revision===generation.current)setBusy(false);}
 },[path,csrfToken]);
 useLayoutEffect(()=>{
  ++generation.current;pending.current?.abort();setMessage('');setBusy(false);setState(initialState?checkedState(initialState):null);
  if(!initialState)void load();
  return()=>{++generation.current;pending.current?.abort();};
 },[userId,path,load,initialState?.revision]);
 async function change(action:string){
  if(!state||busy)return;
  const revision=++generation.current;pending.current?.abort();const controller=new AbortController();pending.current=controller;setBusy(true);setMessage('');
  try{
   const result=checkedState(await friendRequest(path,controller.signal,csrfToken,{action,revision:state.revision}));
   if(revision!==generation.current)return;
   setState(result);window.dispatchEvent(new Event('ecovibes:friends_changed'));
  }catch(e){if(revision===generation.current&&!controller.signal.aborted){setMessage(e instanceof Error?e.message:'The request could not be completed.');setState(null);}}
  finally{if(revision===generation.current)setBusy(false);}
 }
 return <div className="friend-actions" aria-label={`Friend controls for ${person.display_name}`}>
  {state&&<><span role="status">{statuses[state.state]}</span><div>{state.actions.map(action=><button type="button" key={action} disabled={busy||!csrfToken} className={['block','remove','decline'].includes(action)?'friend-secondary':''} onClick={()=>void change(action)}>{labels[action]}</button>)}</div></>}
  {busy&&<span role="status">Updating friends…</span>}{message&&<p role="status">{message}</p>}
  {!state&&!busy&&<button type="button" onClick={()=>void load()}>Refresh connection</button>}
 </div>;
}
export default function FriendsPanel({userId,csrfToken,onSelect}:{userId:string|null;csrfToken:string;onSelect:(person:PublicPerson)=>void}) {
 const [inbox,setInbox]=useState<Inbox|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const generation=useRef(0),pending=useRef<AbortController|null>(null);
 const load=useCallback(async()=>{
  if(!userId)return;
  const revision=++generation.current;pending.current?.abort();const controller=new AbortController();pending.current=controller;setBusy(true);setMessage('');
  try{
   const data=await friendRequest('/people/friends',controller.signal,csrfToken);
   if(!['incoming','outgoing','friends','blocked'].every(key=>Array.isArray(data[key])&&data[key].length<=50&&data[key].every((entry:Entry)=>typeof entry.id==='string'&&typeof entry.eco_id==='string'&&typeof entry.display_name==='string'&&checkedState(entry))))throw Error('Friends are unavailable. Please refresh.');
   if(revision===generation.current)setInbox(data);
  }catch(e){if(revision===generation.current&&!controller.signal.aborted){setInbox(null);setMessage(e instanceof Error?e.message:'Friends are unavailable.');}}
  finally{if(revision===generation.current)setBusy(false);}
 },[userId,csrfToken]);
 useLayoutEffect(()=>{++generation.current;pending.current?.abort();setInbox(null);setMessage('');setBusy(false);return()=>{++generation.current;pending.current?.abort();};},[userId]);
 useEffect(()=>{
  if(!userId)return;void load();const refresh=()=>{if(document.visibilityState==='visible')void load();};
  window.addEventListener('ecovibes:friends_changed',refresh);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);
  return()=>{window.removeEventListener('ecovibes:friends_changed',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);++generation.current;pending.current?.abort();};
 },[userId,load]);
 if(!userId)return null;
 return <section className="people-lookup friends-panel" aria-label="Friends & requests"><header><h2>Friends & requests</h2><button type="button" disabled={busy} onClick={()=>void load()} aria-label="Refresh friends">{busy?'Refreshing…':'Refresh'}</button></header>
  <p>Requests are saved to your account. Refresh here when a friend sends one. Accepting does not start a call or share your phone number.</p>
  {message&&<p role="status">{message}</p>}
  {inbox&&(['incoming','friends','outgoing','blocked'] as const).map(kind=><section key={kind} aria-label={{incoming:'Incoming requests',friends:'Your friends',outgoing:'Sent requests',blocked:'Blocked requests'}[kind]}>
   <h3>{{incoming:'Incoming requests',friends:'Your friends',outgoing:'Sent requests',blocked:'Blocked requests'}[kind]}</h3>
   {inbox[kind].length===0?<p>None right now.</p>:inbox[kind].map(person=><article key={person.id}><div className="friend-person"><strong>{person.display_name}</strong><span>@{person.eco_id}</span>{kind==='friends'&&<button type="button" onClick={()=>onSelect(person)}>Select person</button>}</div><FriendActions key={`${userId}:${person.id}`} userId={userId} csrfToken={csrfToken} person={person} initialState={person}/></article>)}
   {inbox.truncated?.[kind]&&<p>Showing the most recent 50. Find other people by their exact EcoVibes ID.</p>}
  </section>)}
 </section>;
}
