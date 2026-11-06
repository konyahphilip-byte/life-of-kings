import { useCallback,useEffect,useRef,useState,type FormEvent } from 'react';
import { apiUrl } from '../../lib/api';

type Peer={id:string;eco_id:string;display_name:string;revision:number};
type Message={id:string;sequence:string;senderId:string;body:string;createdAt:string;deliveredAt?:string|null};
type Page={ownerId:string;revision:number;messages:Message[];receiptsEnabled?:boolean;hasOlder:boolean;beforeCursor:string|null};
type Outcome='ok'|'retry'|'stop';
class MessageError extends Error{constructor(message:string,readonly status:number){super(message);}}
async function request(path:string,signal:AbortSignal,csrfToken='',body?:unknown){
 const controller=new AbortController(),abort=()=>controller.abort();let timeout=false;
 if(signal.aborted)controller.abort();else signal.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>{timeout=true;controller.abort();},10000);
 try{
  const response=await fetch(apiUrl(path),{credentials:'include',cache:'no-store',signal:controller.signal,method:body?'POST':'GET',headers:body?{'Content-Type':'application/json','X-CSRF-Token':csrfToken}:{},body:body?JSON.stringify(body):undefined});
  const value=await response.json();if(!response.ok)throw new MessageError(value.error?.message||'Messages are unavailable.',response.status);return value;
 }catch(error){if(timeout)throw Error('The connection timed out. Refresh to check your messages.');throw error;}
 finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
}
function useForegroundMessages(load:()=>Promise<Outcome>,pause:()=>void,interval:number){
 useEffect(()=>{
  let disposed=false,revision=0,failures=0,timer:ReturnType<typeof setTimeout>|undefined;
  const clear=()=>{clearTimeout(timer);revision++;pause();};
  const refresh=()=>{
   clear();const current=revision;
   if(disposed||document.visibilityState==='hidden'||!navigator.onLine)return;
   void load().then(outcome=>{
    if(disposed||current!==revision||outcome==='stop')return;
    failures=outcome==='ok'?0:Math.min(failures+1,4);
    timer=setTimeout(refresh,failures?Math.min(120000,15000*2**failures):interval);
   });
  };
  const visibility=()=>{if(document.visibilityState==='hidden'||!navigator.onLine)clear();else refresh();};
  refresh();document.addEventListener('visibilitychange',visibility);window.addEventListener('offline',visibility);
  for(const name of ['online','focus','ecovibes:friends_changed','ecovibes:messages_refresh'])window.addEventListener(name,refresh);
  return()=>{disposed=true;clear();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('offline',visibility);for(const name of ['online','focus','ecovibes:friends_changed','ecovibes:messages_refresh'])window.removeEventListener(name,refresh);};
 },[load,pause,interval]);
}
function checkedPage(value:Page){
 if(value?.receiptsEnabled!==undefined&&typeof value.receiptsEnabled!=='boolean'||!value||typeof value.ownerId!=='string'||!Number.isSafeInteger(value.revision)||!Array.isArray(value.messages)||value.messages.length>50||typeof value.hasOlder!=='boolean'||!(value.beforeCursor===null||typeof value.beforeCursor==='string')||value.messages.some(item=>!item||typeof item.id!=='string'||(item.deliveredAt!==undefined&&item.deliveredAt!==null&&(typeof item.deliveredAt!=='string'||!Number.isFinite(Date.parse(item.deliveredAt))))||typeof item.senderId!=='string'||typeof item.body!=='string'||item.body.length>2000||typeof item.createdAt!=='string'||typeof item.sequence!=='string'||!(/^[1-9][0-9]*$/.test(item.sequence))))throw Error('Messages could not be read. Please refresh.');
 return value;
}
function Conversation({userId,csrfToken,peer,rosterReady}:{userId:string;csrfToken:string;peer:Peer;rosterReady:boolean}){
 const [page,setPage]=useState<Page|null>(null),[draft,setDraft]=useState(''),[error,setError]=useState(''),[sending,setSending]=useState(false),[saved,setSaved]=useState(false),[before,setBefore]=useState<string|null>(null);
 const [attempt,setAttempt]=useState<{body:string;revision:number;clientId:string}|null>(null);
 const generation=useRef(0),writeGeneration=useRef(0),readPending=useRef<AbortController|null>(null),writePending=useRef<AbortController|null>(null),busy=useRef(false);
 const acknowledged=useRef(new Set<string>());
 const path=`/connect/messages/${encodeURIComponent(peer.id)}`;
 const pause=useCallback(()=>{generation.current++;readPending.current?.abort();readPending.current=null;},[]);
 const load=useCallback(async():Promise<Outcome>=>{
  if(busy.current)return 'ok';
  const revision=++generation.current,controller=new AbortController();readPending.current?.abort();readPending.current=controller;
  try{
   const result=checkedPage(await request(`${path}${before?`?before=${encodeURIComponent(before)}`:''}`,controller.signal));
   if(revision!==generation.current||controller.signal.aborted)return 'ok';
   if(result.ownerId!==userId)throw new MessageError('Sign-in changed. Refresh your account to continue.',403);
   if(result.revision!==peer.revision)throw new MessageError('This friendship changed. Reopen the conversation.',409);
   setPage(result);setError('');return 'ok';
  }catch(e){
   if(revision!==generation.current||controller.signal.aborted)return 'ok';
   setPage(null);setSaved(false);setError(e instanceof Error?e.message:'Messages are unavailable.');
   const stop=e instanceof MessageError&&[401,403,404,409].includes(e.status);
   if(stop){setDraft('');setAttempt(null);}return stop?'stop':'retry';
  }
 },[path,before,peer.revision,userId]);
 useForegroundMessages(load,pause,before?60000:5000);
 useEffect(()=>{
  if(!page?.receiptsEnabled||!rosterReady||document.visibilityState==='hidden'||!navigator.onLine)return;
  const messageIds=page.messages.filter(m=>m.senderId===peer.id&&!m.deliveredAt&&!acknowledged.current.has(m.id)).map(m=>m.id);
  if(!messageIds.length)return;
  const controller=new AbortController();
  void request(`${path}/receipts`,controller.signal,csrfToken,{revision:page.revision,messageIds}).then(result=>{
   if(controller.signal.aborted)return;
   if(result.ownerId!==userId||result.revision!==peer.revision||!Array.isArray(result.acknowledged)||result.acknowledged.length!==messageIds.length||result.acknowledged.some((v:string)=>!messageIds.includes(v)))throw Error('Delivery confirmation could not be verified.');
   messageIds.forEach(id=>acknowledged.current.add(id));
  }).catch(e=>{
   if(controller.signal.aborted)return;
   if(e instanceof MessageError&&[401,403,404,409].includes(e.status)){setPage(null);setDraft('');setAttempt(null);}
   setError('Delivery confirmation is unavailable. Messages already saved are unchanged.');
  });
  return()=>controller.abort();
 },[page,rosterReady,peer.id,peer.revision,path,userId,csrfToken]);
 useEffect(()=>()=>{pause();writeGeneration.current++;writePending.current?.abort();},[pause]);
 async function send(e?:FormEvent){
  e?.preventDefault();if(!page||sending||before||!rosterReady)return;
  const outgoing=attempt||{body:draft.trim(),revision:page.revision,clientId:crypto.randomUUID()};if(!outgoing.body)return;
  busy.current=true;pause();const revision=++writeGeneration.current,controller=new AbortController();writePending.current=controller;setSending(true);setSaved(false);setError('');setAttempt(outgoing);
  try{
   const response=await request(path,controller.signal,csrfToken,outgoing);
   const result=checkedPage({ownerId:response.ownerId,revision:response.revision,messages:[response.message],hasOlder:false,beforeCursor:null});
   if(revision!==writeGeneration.current||controller.signal.aborted)return;
   if(result.ownerId!==userId)throw new MessageError('Sign-in changed. Refresh your account to continue.',403);
   if(result.revision!==peer.revision)throw new MessageError('This friendship changed. Reopen the conversation.',409);
   setPage(current=>{if(!current)return null;const all=[...current.messages.filter(item=>item.id!==response.message.id),response.message].sort((a,b)=>BigInt(a.sequence)<BigInt(b.sequence)?-1:BigInt(a.sequence)>BigInt(b.sequence)?1:0),messages=all.slice(-50);return {...current,messages,beforeCursor:messages[0]?.sequence||null,hasOlder:current.hasOlder||all.length>50};});
   setDraft('');setAttempt(null);setSaved(true);
  }catch(e){
   if(revision!==writeGeneration.current||controller.signal.aborted)return;
   setError(e instanceof Error?e.message:'The message could not be confirmed.');
   if(e instanceof MessageError&&[401,403,404,409].includes(e.status)){setPage(null);setDraft('');setAttempt(null);}
  }finally{busy.current=false;writePending.current=null;if(!controller.signal.aborted)setSending(false);}
 }
 return <section className="direct-conversation" aria-label={`Conversation with ${peer.display_name}`}>
  <header><div><h2>{peer.display_name}</h2><p>@{peer.eco_id}</p></div><button type="button" disabled={sending} onClick={()=>window.dispatchEvent(new Event('ecovibes:messages_refresh'))}>Refresh conversation</button></header>
  <p>Private text between accepted friends. Updates while this page is open. ✓ Saved by server · ✓✓ Received by their app. Ticks do not mean read. Calls, attachments and read receipts are not connected here.</p>
  {page&&!page.receiptsEnabled&&<p>Recipient delivery confirmation is unavailable for this conversation.</p>}
  {error&&<p role="alert">{error}</p>}{saved&&<p role="status">Saved to conversation.</p>}
  <div className="direct-message-history" aria-label="Conversation messages">
   {rosterReady&&page?.messages.map(item=><article key={item.id} className={item.senderId===userId?'direct-mine':'direct-theirs'}><small>{item.senderId===userId?'You':peer.display_name} · <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></small><p>{item.body}</p>{item.senderId===userId&&<span className="message-receipt" aria-label={page.receiptsEnabled&&item.deliveredAt?'Received by their app':'Saved by server'}>{page.receiptsEnabled&&item.deliveredAt?'✓✓ Received':'✓ Saved'}</span>}</article>)}
   {page&&!page.messages.length&&<p>No messages yet. Say hello.</p>}
  </div>
  {before?<button type="button" onClick={()=>setBefore(null)}>Back to latest messages</button>:null}
  {page?.hasOlder&&<button type="button" disabled={sending||Boolean(attempt)} onClick={()=>setBefore(page.beforeCursor)}>Load earlier messages</button>}
  <form onSubmit={send}><label>Write a message<textarea aria-label="Write a message" value={draft} maxLength={2000} disabled={!page||!rosterReady||sending||Boolean(attempt)||Boolean(before)} onChange={e=>{setDraft(e.target.value);setSaved(false);}}/></label>
   {attempt&&!sending?<><p>Sending was not confirmed. Refresh to check before retrying. A retry uses the same message reference.</p><button type="button" disabled={!page||!rosterReady} onClick={()=>void send()}>Retry same message</button><button type="button" onClick={()=>{setAttempt(null);setDraft('');setError('');}}>Discard draft</button></>:<button type="submit" disabled={!page||!rosterReady||sending||!draft.trim()||Boolean(before)}>{sending?'Sending…':'Send message'}</button>}
  </form>
 </section>;
}
export default function DirectMessages({userId,csrfToken}:{userId:string;csrfToken:string}){
 const [peers,setPeers]=useState<Peer[]>([]),[selected,setSelected]=useState<string|null>(null),[error,setError]=useState(''),[ready,setReady]=useState(false),[truncated,setTruncated]=useState(false),[search,setSearch]=useState(''),[query,setQuery]=useState('');
 const generation=useRef(0),pending=useRef<AbortController|null>(null);
 const pause=useCallback(()=>{generation.current++;pending.current?.abort();pending.current=null;},[]);
 const load=useCallback(async():Promise<Outcome>=>{
  const revision=++generation.current,controller=new AbortController();pending.current?.abort();pending.current=controller;
  try{
   const result=await request(`/connect/messages${query?`?ecoId=${encodeURIComponent(query)}`:''}`,controller.signal);
   if(revision!==generation.current||controller.signal.aborted)return 'ok';
   if(result.ownerId!==userId)throw new MessageError('Sign-in changed. Refresh your account to continue.',403);
   if(!Array.isArray(result.friends)||result.friends.length>50||result.friends.some((p:Peer)=>!p||typeof p.id!=='string'||typeof p.eco_id!=='string'||typeof p.display_name!=='string'||!Number.isSafeInteger(p.revision))||typeof result.truncated!=='boolean')throw Error('Messages could not be read. Please refresh.');
   setPeers(result.friends);setSelected(current=>result.friends.some((p:Peer)=>p.id===current)?current:null);setTruncated(result.truncated);setError('');setReady(true);return 'ok';
  }catch(e){
   if(revision!==generation.current||controller.signal.aborted)return 'ok';
   const stop=e instanceof MessageError&&[401,403,503].includes(e.status);
   if(stop){setPeers([]);setSelected(null);}setReady(false);setError(e instanceof Error?e.message:'Messages are unavailable.');return stop?'stop':'retry';
  }
 },[query,userId]);
 useForegroundMessages(load,pause,15000);
 const person=peers.find(p=>p.id===selected);
 return <section className="direct-messages" aria-label="Private friend messages"><header><h2>Your friends</h2><button type="button" onClick={()=>window.dispatchEvent(new Event('ecovibes:messages_refresh'))}>Refresh messages</button></header>
  <form onSubmit={e=>{e.preventDefault();pause();setSelected(null);setPeers([]);setReady(false);setQuery(search.trim());if(search.trim()===query)window.dispatchEvent(new Event('ecovibes:messages_refresh'));}}><label>Find friend by EcoVibes ID<input aria-label="Find friend by EcoVibes ID" maxLength={25} autoCapitalize="none" autoCorrect="off" value={search} placeholder="@their_id" onChange={e=>setSearch(e.target.value)}/></label><button type="submit">Find friend</button>{query&&<button type="button" onClick={()=>{setSearch('');setQuery('');setSelected(null);setPeers([]);setReady(false);}}>Show recent friends</button>}</form>
  {error&&<p role="alert">{error}</p>}{!ready&&!error&&<p role="status">Loading your friends…</p>}
  {ready&&!peers.length&&<p>Accept a friend request in Calls &amp; Live to start a private conversation.</p>}
  <div className="direct-friend-list">{peers.map(p=><button type="button" aria-label={`Message ${p.display_name}`} aria-pressed={p.id===selected} key={p.id} onClick={()=>setSelected(p.id)}><strong>{p.display_name}</strong><span>@{p.eco_id}</span></button>)}</div>
  {truncated&&<p>Showing 50 recent friends. Search by their exact @name to find another.</p>}
  {person&&<Conversation key={`${userId}:${person.id}:${person.revision}`} userId={userId} csrfToken={csrfToken} peer={person} rosterReady={ready}/>}
 </section>;
}
