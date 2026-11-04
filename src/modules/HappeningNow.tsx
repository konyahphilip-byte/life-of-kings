import {useEffect,useRef,useState} from 'react';
import {TrendingUp} from 'lucide-react';
import {apiUrl} from '../lib/api';
import {readHappening,type HappeningData} from '../../shared/public-trends.mjs';
import {readHeadlines,type HeadlineSection} from '../../shared/happening-news.mjs';
import './happening-now.css';
type FeedData=HappeningData&{news:HeadlineSection[]|null};
const expiries=(data:FeedData)=>[...data.sections,...(data.news||[])].map(section=>Date.parse(section.expiresAt));
const time=(stamp:string)=>new Date(stamp).toLocaleString('en-GH',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Accra'})+' GMT';
export default function HappeningNow(){
 const [data,setData]=useState<FeedData|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[clock,setClock]=useState(Date.now),[online,setOnline]=useState(()=>navigator.onLine);
 const [filter,setFilter]=useState<'all'|'trends'|'music'|'news'>('all');
 const refresh=useRef<()=>void>(()=>{});
 useEffect(()=>{
  let stopped=false,controller:AbortController|null=null,timer:ReturnType<typeof setTimeout>|undefined,deadline:ReturnType<typeof setTimeout>|undefined,nextDue=0,failures=0;
  const active=()=>!stopped&&navigator.onLine&&document.visibilityState==='visible';
  function schedule(){clearTimeout(timer);timer=undefined;if(active())timer=setTimeout(()=>void load(),Math.max(0,nextDue-Date.now()));}
  function cancel(){clearTimeout(timer);clearTimeout(deadline);timer=undefined;deadline=undefined;const old=controller;controller=null;old?.abort();if(!stopped)setBusy(false);}
  async function load(){
   if(!active()||controller)return;if(Date.now()<nextDue){schedule();return;}
   const current=new AbortController();controller=current;setBusy(true);setError('');setClock(Date.now());
   const ownDeadline=setTimeout(()=>current.abort(),12000);deadline=ownDeadline;
   try{
    const response=await fetch(apiUrl('/discover/happening'),{credentials:'omit',signal:current.signal,cache:'no-store',referrerPolicy:'no-referrer'});
    if(!response.ok)throw Error();const raw=await response.json(),base=readHappening(raw);if(!base)throw Error();const value:FeedData={...base,news:readHeadlines(raw.news)};
    if(stopped||controller!==current||current.signal.aborted||!active())return;
    failures=0;setData(value);setClock(Date.now());
    nextDue=Math.max(Date.now()+30000,Math.min(...expiries(value)));
   }catch{
    if(!stopped&&controller===current&&active()){failures=Math.min(failures+1,4);nextDue=Date.now()+Math.min(300000,60000*2**(failures-1));setError('Could not check current topics, music and news. We’ll try again automatically.');setClock(Date.now());}
   }finally{
    clearTimeout(ownDeadline);
    if(controller===current){controller=null;deadline=undefined;if(!stopped){setBusy(false);schedule();}}
   }
  }
  const changed=()=>{if(stopped)return;setOnline(navigator.onLine);setClock(Date.now());if(!active())cancel();else void load();};
  refresh.current=()=>{if(!active()||controller)return;nextDue=0;void load();};
  document.addEventListener('visibilitychange',changed);window.addEventListener('online',changed);window.addEventListener('offline',changed);void load();
  return()=>{stopped=true;cancel();refresh.current=()=>{};document.removeEventListener('visibilitychange',changed);window.removeEventListener('online',changed);window.removeEventListener('offline',changed);};
 },[]);
 useEffect(()=>{
  if(!data)return;const timers=expiries(data).filter(expires=>expires>Date.now()).map(expires=>setTimeout(()=>setClock(Date.now()),expires-Date.now()));
  return()=>timers.forEach(clearTimeout);
 },[data]);
 const status=!online?'You’re offline. Updates will resume when you reconnect.':error||(busy?'Checking current sources…':'Updates automatically while you’re here and online.');
 return <section className="rail-card happening-card" aria-label="Happening now"><div className="rail-heading"><h3><TrendingUp size={16} aria-hidden="true"/> Happening now</h3></div><p className="happening-intro">Trends, music and news — with the source in every story.</p><div className="happening-tabs" role="group" aria-label="Happening now sections">{([["all","All"],["trends","Trends"],["music","Music"],["news","News"]] as const).map(([id,label])=><button key={id} type="button" aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div><p className="happening-status" role="status">{status}</p><button type="button" className="happening-load" disabled={busy||!online} onClick={()=>refresh.current()}>{busy?'Updating…':'Refresh now'}</button>{data?.sections.filter(section=>filter==='all'||(filter==='trends'&&section.id==='searches')||(filter==='music'&&section.id==='music')).map(section=>{
  const expired=Date.parse(section.expiresAt)<=clock;
  return <div key={section.id} className="happening-source"><h4>{section.label}</h4><p className="happening-note">{section.id==='searches'?'Search interest, not confirmed news or EcoVibes activity.':'This chart reflects Apple Music listening, not all Ghanaian listeners.'}</p>{expired?<p className="happening-stale">This source needs a fresh update.</p>:section.status==='available'?<ol>{section.items.map(item=><li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>{item.subtitle&&<span>{item.subtitle}</span>}</li>)}</ol>:<p>{section.status==='disabled'?'This source is turned off.':section.status==='empty'?'No recent entries returned.':'This source is unavailable. We’ll check again automatically.'}</p>}<a className="happening-attribution" href={section.sourceUrl} target="_blank" rel="noopener noreferrer">Data source: {section.source}</a>{section.updatedAt&&<small>{section.id==='music'?'Chart updated':'Latest source entry'} {time(section.updatedAt)}</small>}<small>Checked {time(section.checkedAt)}</small>{section.copyright&&<small>{section.copyright}</small>}</div>;
 })}{data&&(filter==='all'||filter==='news')&&(data.news?<section aria-label="News sources">{data.news.map(section=><div className="happening-source" key={section.id}><h4>{section.label}</h4><p className="happening-note">{section.id==='ghana-news'?'Publisher coverage linked to searches in Ghana, rather than a complete national news service.':'International reporting from UN Geneva, with original publication dates.'}</p>{Date.parse(section.expiresAt)<=clock?<p className="happening-stale">This source needs a fresh update.</p>:section.status==='available'?<ul className="happening-headlines">{section.items.map(item=><li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a><span>{item.publisher}</span><small>{item.dateKind==='published'?'Published':'Trend date'} {time(item.date)}</small></li>)}</ul>:<p>{section.status==='disabled'?'This source is turned off.':section.status==='empty'?'No recent headlines from the selected sources.':'Headlines are temporarily unavailable. Updates will retry automatically.'}</p>}<a className="happening-attribution" href={section.sourceUrl} target="_blank" rel="noopener noreferrer">Data source: {section.source}</a><small>Checked {time(section.checkedAt)}</small></div>)}</section>:<p className="happening-note">News sources could not be checked. Trends and music remain separate.</p>)}</section>;
}
