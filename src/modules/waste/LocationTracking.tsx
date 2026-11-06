import {useEffect,useRef,useState} from 'react';
import {apiUrl} from '../../lib/api';
import {createLocationPublisher,type SaverMode} from './location-publisher';

type Collection={id:string;title:string};
type Snapshot={ownerId:string;jobId:string;role:'customer'|'collector';state:string;canPublish:boolean;sessionId:string|null;expiresAt:string|null;sequence:number;serverTime:string;staleAfterMs:number;locationRetentionMs:number;lastUpdateAt:string|null;point:null|{latitude:number;longitude:number;accuracy:number;capturedAt:string;receivedAt:string}};
const states=new Set(['not_started','waiting','live','stale','paused','stopped','revoked','expired','completed','cancelled','disputed','finished','unavailable','not_authorized']);
function validSnapshot(value:Snapshot,owner:string,job:string){
 if(!value||value.ownerId!==owner||value.jobId!==job||!['customer','collector'].includes(value.role)||!states.has(value.state)||typeof value.canPublish!=='boolean'||!Number.isSafeInteger(value.sequence)||!Number.isFinite(Date.parse(value.serverTime))||value.staleAfterMs!==30000||value.locationRetentionMs!==90000)return false;
 if(value.expiresAt!==null&&!Number.isFinite(Date.parse(value.expiresAt)))return false;
 const p=value.point;return !p||([p.latitude,p.longitude,p.accuracy].every(v=>typeof v==='number'&&Number.isFinite(v))&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180&&p.accuracy>=0&&p.accuracy<=1000&&Number.isFinite(Date.parse(p.capturedAt))&&Number.isFinite(Date.parse(p.receivedAt)));
}
export function locationPresentation(snapshot:Snapshot,elapsed:number){
 const serverNow=Date.parse(snapshot.serverTime)+Math.max(0,elapsed),age=snapshot.point?Math.max(0,serverNow-Date.parse(snapshot.point.receivedAt)):null;
 if(snapshot.expiresAt&&serverNow>=Date.parse(snapshot.expiresAt)&&['live','stale','waiting'].includes(snapshot.state))return{state:'expired',point:null};
 const state=snapshot.state==='live'&&age!==null&&age>=snapshot.staleAfterMs?'stale':snapshot.state;
 return{state,point:age!==null&&age<snapshot.locationRetentionMs&&['live','stale'].includes(state)?snapshot.point:null};
}
const online=()=>navigator.onLine!==false&&!document.hidden;

function TrackingSession({ownerId,csrf,job,saver}:{ownerId:string;csrf:string;job:Collection;saver:SaverMode}){
 const [frame,setFrame]=useState<{snapshot:Snapshot;at:number}|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[consent,setConsent]=useState(false),[offline,setOffline]=useState(!online()),[tick,setTick]=useState(0);
 const refresh=useRef<()=>void>(()=>{}),publisher=useRef<ReturnType<typeof createLocationPublisher>|null>(null);
 const current=frame?.snapshot.ownerId===ownerId&&frame.snapshot.jobId===job.id?frame:null;
 const presentation=current?locationPresentation(current.snapshot,performance.now()-current.at):null;
 const canPublish=Boolean(current?.snapshot.canPublish&&presentation&&!['revoked','completed','cancelled','disputed','finished','unavailable','not_authorized'].includes(presentation.state)&&!offline);
 useEffect(()=>{
  let alive=true,controller:AbortController|null=null,timer:ReturnType<typeof setTimeout>|null=null,inflight=false;
  const path=`/jobs/${job.id}/tracking`;
  async function request(action:string,body?:unknown){
   const response=await fetch(apiUrl(path+action),{method:body?'POST':'GET',credentials:'include',cache:'no-store',signal:AbortSignal.timeout(8000),keepalive:action==='/stop',headers:{'Content-Type':'application/json',...(body?{'X-CSRF-Token':csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});
   const result=await response.json();if(!response.ok)throw new Error(result?.error?.message||'Collection location could not be confirmed.');
   if(!validSnapshot(result,ownerId,job.id))throw new Error('Collection location could not be confirmed.');return result as Snapshot;
  }
  const device=navigator.geolocation;
  const instance=device&&window.isSecureContext!==false?createLocationPublisher({ownerId,mode:saver,geo:device,available:()=>alive&&online(),permission:async()=>{
   try{return navigator.permissions?await navigator.permissions.query({name:'geolocation'}):null;}catch{return null;}
  },api:{start:body=>request('/start',body).then(snapshot=>({sessionId:snapshot.sessionId!,sequence:snapshot.sequence,expiresAt:snapshot.expiresAt})),point:body=>request('/point',body),stop:body=>request('/stop',body)},onChange:status=>{if(alive)setMessage(status);}}):null;
  publisher.current=instance;
  async function read(){
   if(inflight||!alive||!online())return;inflight=true;if(timer)clearTimeout(timer);controller=new AbortController();const active=controller,at=performance.now();
   const timeout=setTimeout(()=>active.abort(),8000);
   try{
    const response=await fetch(apiUrl(path),{credentials:'include',cache:'no-store',signal:active.signal});const snapshot=await response.json();
    if(!response.ok||!validSnapshot(snapshot,ownerId,job.id))throw Error('Collection location could not be confirmed.');
    if(!alive||active.signal.aborted||!online())return;
    setFrame({snapshot,at});setError('');
    if(instance?.isActive()&&instance.sessionId()&&snapshot.sessionId!==instance.sessionId())void instance.stop('Location sharing changed on another page. Device location stopped.');
    if(!snapshot.canPublish&&instance?.isActive())void instance.stop('Collection access changed. Device location stopped.');
    if(['paused','stopped','expired','revoked'].includes(snapshot.state)&&instance?.isActive()&&instance.sessionId()===snapshot.sessionId)void instance.stop('Location sharing ended. Device location stopped.');
   }catch{if(alive&&!active.signal.aborted){setFrame(null);setError('Collection location could not be confirmed. No current location is shown.');void instance?.stop('Device location stopped until access can be confirmed.');}
    else if(alive&&online()){setFrame(null);setError('Collection location could not be confirmed. Try Refresh when ready.');void instance?.stop();}}
   finally{clearTimeout(timeout);inflight=false;if(alive&&online())timer=setTimeout(()=>void read(),{standard:5000,saver:10000,extreme:15000}[saver]);}
  }
  refresh.current=()=>void read();
  const changed=()=>{setOffline(!online());if(!online()){controller?.abort();if(timer)clearTimeout(timer);setFrame(null);setConsent(false);void instance?.stop('Device location stopped while this page is hidden or offline.');}else void read();};
  const pagehide=()=>{controller?.abort();setFrame(null);setConsent(false);void instance?.stop();};
  document.addEventListener('visibilitychange',changed);window.addEventListener('offline',changed);window.addEventListener('online',changed);window.addEventListener('pagehide',pagehide);
  const clock=setInterval(()=>setTick(value=>value+1),1000);void read();
  return()=>{alive=false;refresh.current=()=>{};controller?.abort();if(timer)clearTimeout(timer);clearInterval(clock);document.removeEventListener('visibilitychange',changed);window.removeEventListener('offline',changed);window.removeEventListener('online',changed);window.removeEventListener('pagehide',pagehide);publisher.current=null;void instance?.stop();};
 },[ownerId,csrf,job.id,saver]);
 useEffect(()=>{if(presentation?.state==='expired'&&publisher.current?.isActive()&&publisher.current.sessionId()===current?.snapshot.sessionId)void publisher.current.stop('Location sharing expired.');},[presentation?.state,current?.snapshot.sessionId,tick]);
 const state=presentation?.state;
 const text:Record<string,string>={not_started:'The collector has not started location sharing.',waiting:'Waiting for a device position.',live:'Latest device location',stale:'Location is stale. This is not the collector’s confirmed current position.',paused:'Location sharing is paused.',stopped:'Location sharing stopped.',expired:'Location sharing expired.',revoked:'Location access was revoked.',completed:'Collection completed. Tracking ended.',cancelled:'Collection cancelled. Tracking ended.',disputed:'Collection disputed. Tracking ended.',finished:'Collector finished. Tracking ended.',unavailable:'Collection location is unavailable.',not_authorized:'This assignment or current Waste verification does not permit location sharing.'};
 return <div className="waste-location-session">
  <p role="status">{offline?'Offline or hidden: live location is unavailable.':state?text[state]:'Checking collection location…'}</p>
  {error&&<p role="alert">{error}</p>}
  {presentation?.point&&!offline&&<p><strong>{presentation.point.latitude.toFixed(5)}, {presentation.point.longitude.toFixed(5)}</strong><br/>Reported accuracy: {Math.ceil(presentation.point.accuracy)} metres · {new Date(presentation.point.receivedAt).toLocaleTimeString()}<br/><small>A device estimate, not proof of collection or arrival.</small></p>}
  <button type="button" onClick={()=>refresh.current()} disabled={offline}>Refresh collection location</button>
  {current?.snapshot.role==='collector'&&<div className="waste-location-consent">
   <p>Location is optional. This page asks your browser for device location only after you choose Start. Separately, the box below allows sharing with this collection’s customer for up to 30 minutes. No location history, background tracking or AI use is enabled.</p>
   <label><input type="checkbox" checked={consent} disabled={!canPublish} onChange={e=>{setConsent(e.target.checked);if(!e.target.checked)void publisher.current?.stop('Sharing consent was withdrawn. Device location stopped.');}}/> Share my device location with this collection’s customer</label>
   <div className="waste-location-actions"><button type="button" disabled={!canPublish||!consent||!navigator.geolocation} onClick={()=>void publisher.current?.start(consent,canPublish)}>Start device location</button><button type="button" onClick={()=>{setConsent(false);void publisher.current?.stop();}}>Stop device location</button></div>
   {!navigator.geolocation&&<p>This browser cannot provide device location.</p>}
   {message&&<p role="status">{message}</p>}
   <small>Denied or restricted? Change this site’s Location permission in your browser or device settings only if you want to share. Reduced-accuracy locations remain labelled with their reported accuracy. Leaving this page stops device capture.</small>
  </div>}
  <p className="waste-location-note">Updates while this page is visible and online; refreshes every {saver==='standard'?5:saver==='saver'?10:15} seconds. Positions older than 30 seconds are stale and hidden after 90 seconds. The server removes old coordinates on access or its 30-second cleanup cycle. If Stop cannot reach the server, the last position may remain briefly until cleanup. Maps and road routes are not connected in this increment. <a href="/privacy.html" target="_blank" rel="noreferrer">Location privacy</a></p>
 </div>;
}

export default function LocationTracking({ownerId,csrf,jobs,saver}:{ownerId:string;csrf:string;jobs:Collection[];saver:SaverMode}){
 const [selected,setSelected]=useState(jobs[0]?.id||'');const job=jobs.find(item=>item.id===selected)||jobs[0];
 return <section className="waste-section waste-location" aria-label="Collection location"><h2>Collection location</h2>
  {!job?<p>Your own or assigned collections appear here once a provider is selected.</p>:<><label>Collection<select value={job.id} onChange={e=>setSelected(e.target.value)}>{jobs.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label><TrackingSession key={`${ownerId}:${job.id}`} ownerId={ownerId} csrf={csrf} job={job} saver={saver}/></>}
 </section>;
}
