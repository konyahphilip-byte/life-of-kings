import {useEffect,useRef,useState} from 'react';
import {TrendingUp,Headphones,Music2,Newspaper,Globe2,Sparkles,RefreshCw,ArrowUpRight,ArrowRight} from 'lucide-react';
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
 const tabBar=useRef<HTMLDivElement>(null);
 const expand=(next:'trends'|'music'|'news')=>{setFilter(next);tabBar.current?.querySelector<HTMLButtonElement>('button[data-section="'+next+'"]')?.focus();};
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
 const limit=filter==='all'?2:4;
 return <section className="rail-card happening-card" aria-label="Happening now">
  <div className="happening-heading"><div><h3>Happening now</h3><p>Searches. Sounds. Stories.</p></div><Sparkles size={26} aria-hidden="true"/></div>
  <div className="happening-toolbar"><span className="happening-region"><Globe2 size={13} aria-hidden="true"/>Focus: Ghana</span><button type="button" className="happening-load" disabled={busy||!online} onClick={()=>refresh.current()}><RefreshCw size={13} aria-hidden="true"/>{busy?'Updating…':'Refresh now'}</button></div>
  <div ref={tabBar} className="happening-tabs" role="group" aria-label="Happening now sections">{([['all','The mix'],['trends','Trends'],['music','Music'],['news','News']] as const).map(([id,label])=><button key={id} data-section={id} type="button" aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div>
  <p className="happening-status" role="status">{status}</p>
  {data?.sections.filter(section=>filter==='all'||(filter==='trends'&&section.id==='searches')||(filter==='music'&&section.id==='music')).map(section=>{
   const expired=Date.parse(section.expiresAt)<=clock,music=section.id==='music';
   return <div key={section.id} className={'happening-source '+(music?'happening-music':'happening-searches')}>
    <div className="happening-section-heading"><h4>{section.label}</h4>{music?<Headphones size={20} aria-hidden="true"/>:<TrendingUp size={20} aria-hidden="true"/>}</div>
    {expired?<p className="happening-stale">This source needs a fresh update.</p>:section.status==='available'?<>
     <ul className={music?'happening-songs':'happening-topics'}>{section.items.slice(0,limit).map(item=><li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer">
      {music&&<span className="happening-track-icon"><Music2 size={19} aria-hidden="true"/></span>}
      <span className="happening-item-copy"><b>{item.title}</b>{item.subtitle&&<span>{item.subtitle}</span>}</span><ArrowUpRight size={17} aria-hidden="true"/>
     </a></li>)}</ul>
     {filter==='all'&&section.items.length>limit&&<button className="happening-more" type="button" onClick={()=>expand(music?'music':'trends')}>See all {music?'songs':'searches'}<ArrowRight size={14} aria-hidden="true"/></button>}
    </>:<p className="happening-empty">{section.status==='disabled'?'This source is turned off.':section.status==='empty'?'No recent entries returned.':'This source is unavailable. We’ll check again automatically.'}</p>}
    <div className="happening-source-meta"><a className="happening-attribution" href={section.sourceUrl} target="_blank" rel="noopener noreferrer">{section.source}</a><small>{section.updatedAt?(music?'Chart updated ':'Latest source entry ')+time(section.updatedAt):'Checked '+time(section.checkedAt)}</small>{section.copyright&&<small>{section.copyright}</small>}</div>
   </div>;
  })}
  {data&&(filter==='all'||filter==='news')&&(data.news?<section aria-label="News sources">{data.news.map(section=><div className={'happening-source happening-news '+(section.id==='world-news'?'happening-world':'')} key={section.id}>
   <div className="happening-section-heading"><h4>{section.label}</h4>{section.id==='world-news'?<Globe2 size={20} aria-hidden="true"/>:<Newspaper size={20} aria-hidden="true"/>}</div>
   {Date.parse(section.expiresAt)<=clock?<p className="happening-stale">This source needs a fresh update.</p>:section.status==='available'?<>
    <ul className="happening-headlines">{section.items.slice(0,limit).map(item=><li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer"><b>{item.title}</b><ArrowUpRight size={16} aria-hidden="true"/></a><span className="happening-publisher">{item.publisher}</span><small>{item.dateKind==='published'?'Published':'Trend date'} {time(item.date)}</small></li>)}</ul>
    {filter==='all'&&section.items.length>limit&&<button className="happening-more" type="button" onClick={()=>expand('news')} aria-label={'See all headlines: '+section.label}>More headlines<ArrowRight size={14} aria-hidden="true"/></button>}
   </>:<p className="happening-empty">{section.status==='disabled'?'This source is turned off.':section.status==='empty'?'No recent headlines from the selected sources.':'Headlines are temporarily unavailable. Updates will retry automatically.'}</p>}
   <div className="happening-source-meta"><a className="happening-attribution" href={section.sourceUrl} target="_blank" rel="noopener noreferrer">{section.source}</a><small>Checked {time(section.checkedAt)}</small></div>
  </div>)}</section>:<p className="happening-note">News sources could not be checked. Trends and music remain separate.</p>)}
  <details className="happening-details"><summary>About these sources</summary>
   <p className="happening-note">Search interest, not confirmed news or EcoVibes activity. This chart reflects Apple Music listening, not all Ghanaian listeners.</p>
   <p className="happening-note">Ghana headlines are publisher coverage linked to local searches, with a trend date rather than an article publication date. World briefings are UN Geneva reporting with original publication dates. These are selected sources, not a complete news service.</p>
   {data?.sections.map(section=><div key={section.id}><small>Checked {section.source}: {time(section.checkedAt)}</small></div>)}
  </details>
 </section>;
}
