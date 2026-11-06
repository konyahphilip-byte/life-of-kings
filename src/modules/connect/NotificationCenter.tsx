import {useCallback,useEffect,useRef,useState} from 'react';
import {Bell,X} from 'lucide-react';
import {apiUrl} from '../../lib/api';
import './notifications.css';
type Notice={id:string;type:string;title:string;body:string;target_type:string|null;target_id:string|null;read_at:string|null;created_at:string};
type Summary={ownerId:string;items:Notice[];unread:number;truncated:boolean};
function checked(value:Summary,userId:string):Summary{
 if(value?.ownerId!==userId||!Array.isArray(value.items)||value.items.length>50||!Number.isSafeInteger(value.unread)||value.unread<0||typeof value.truncated!=='boolean'||value.items.some(n=>!n||typeof n.id!=='string'||typeof n.type!=='string'||typeof n.title!=='string'||typeof n.body!=='string'||typeof n.created_at!=='string'||!(n.read_at===null||typeof n.read_at==='string')))throw Error('Notifications could not be verified. Refresh to try again.');
 return value;
}
export default function NotificationCenter({userId,csrfToken,online,onNavigate}:{userId:string|null;csrfToken:string;online:boolean;onNavigate:(page:'Messages'|'Calls & Live'|'EcoVibes ID')=>void}){
 const [open,setOpen]=useState(false),[summary,setSummary]=useState<Summary|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState<string|null>(null);
 const writeVersion=useRef(0);
 const generation=useRef(0),pending=useRef<AbortController|null>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),bell=useRef<HTMLButtonElement>(null);
 const cancel=useCallback(()=>{generation.current++;pending.current?.abort();pending.current=null;clearTimeout(timer.current);},[]);
 const refresh=useCallback(async()=>{
  cancel();if(!userId||!online||document.visibilityState==='hidden')return;
  const revision=generation.current,controller=new AbortController();pending.current=controller;
  const deadline=setTimeout(()=>controller.abort(),10000);
  let failed=false;
  try{
   const response=await fetch(apiUrl('/notifications/summary'),{credentials:'include',cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error('Notifications are unavailable. Please refresh.');
   const result=checked(await response.json(),userId);
   if(revision!==generation.current||controller.signal.aborted)return;
   setSummary(result);setError('');
  }catch(e){if(revision!==generation.current)return;failed=true;setSummary(null);setError(e instanceof Error&&e.name!=='AbortError'?e.message:'The connection timed out. Refresh notifications.');}
  finally{clearTimeout(deadline);if(revision===generation.current){pending.current=null;timer.current=setTimeout(()=>void refresh(),failed?60000:15000);}}
 },[cancel,userId,online]);
 useEffect(()=>{
  setSummary(null);setError('');setOpen(false);setBusy(null);void refresh();
  const visible=()=>{if(document.visibilityState==='hidden'||!navigator.onLine)cancel();else void refresh();};
  const offline=()=>{cancel();setError('You are offline. Notifications will update when connected.');};
  document.addEventListener('visibilitychange',visible);window.addEventListener('online',visible);window.addEventListener('offline',offline);
  return()=>{cancel();document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',visible);window.removeEventListener('offline',offline);};
 },[refresh,cancel]);
 useEffect(()=>{if(!open)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);bell.current?.focus();}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[open]);
 useEffect(()=>{writeVersion.current++;setBusy(null);return()=>{writeVersion.current++;};},[userId,online]);
 async function markRead(notice:Notice){
  if(busy||!userId||!csrfToken||!online)return;
  const revision=++writeVersion.current;setBusy(notice.id);setError('');
  try{
   const response=await fetch(apiUrl(`/notifications/${encodeURIComponent(notice.id)}/read`),{method:'POST',credentials:'include',cache:'no-store',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:'{}'});
   if(!response.ok||(await response.json())?.ok!==true)throw Error('Could not mark this notification as read. Try again.');
   if(revision!==writeVersion.current)return;
   // Only a confirmed write changes the unread indicator.
   setBusy(null);await refresh();
  }catch(e){if(revision===writeVersion.current)setError(e instanceof Error?e.message:'Could not update this notification.');}
  finally{if(revision===writeVersion.current)setBusy(null);}
 }
 return <div className="notification-center">
  <button ref={bell} type="button" className="icon-button" aria-label={summary?.unread?`Notifications, ${summary.unread} unread`:'Notifications'} aria-expanded={open} aria-controls="ecovibes-notifications" onClick={()=>{setOpen(v=>!v);if(!open)void refresh();}}><Bell size={18}/>{Boolean(summary?.unread)&&<span className="notification-count">{summary!.unread>99?'99+':summary!.unread}</span>}</button>
  <span className="notification-announcement" role="status">{summary?.unread?`${summary.unread} unread notifications`:''}</span>
  {open&&<section id="ecovibes-notifications" className="notification-panel" aria-label="Your notifications">
   <header><h2>Notifications</h2><button type="button" aria-label="Close notifications" onClick={()=>{setOpen(false);bell.current?.focus();}}><X size={20}/></button></header>
   {!userId?<><p>Sign in to see your saved notifications.</p><button type="button" onClick={()=>{setOpen(false);onNavigate('EcoVibes ID');}}>Open EcoVibes ID</button></>:<>
    <p>Updates while EcoVibes is open and online. Lock-screen alerts are not connected yet.</p>
    <button type="button" disabled={!online} onClick={()=>void refresh()}>Refresh notifications</button>
    {error&&<p role="alert">{error}</p>}
    {!summary&&!error&&<p role="status">Checking notifications…</p>}
    {summary&&!summary.items.length&&<p>No saved notifications yet.</p>}
    {summary?.items.map(n=><article key={n.id} className={n.read_at?'':'notification-unread'}><h3>{n.title}</h3><p>{n.body}</p><small><time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString()}</time> · {n.read_at?'Read':'Unread'}</small><div><button type="button" onClick={()=>{setOpen(false);onNavigate(n.type==='direct_message'?'Messages':n.type.startsWith('friend')?'Calls & Live':'EcoVibes ID');}}>Open</button>{!n.read_at&&<button type="button" disabled={Boolean(busy)||!online} onClick={()=>void markRead(n)}>Mark read</button>}</div></article>)}
    {summary?.truncated&&<p>Showing the latest 50 notifications. Older account notices remain in EcoVibes ID.</p>}
   </>}
  </section>}
 </div>;
}
