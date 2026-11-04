import {useEffect,useRef,useState} from 'react';
import {TrendingUp} from 'lucide-react';
import {apiUrl} from '../lib/api';
import {readHappening,type HappeningData} from '../../shared/public-trends.mjs';
import './happening-now.css';
const time=(stamp:string)=>new Date(stamp).toLocaleString('en-GH',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Accra'})+' GMT';
export default function HappeningNow(){
 const [data,setData]=useState<HappeningData|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const pending=useRef<AbortController|null>(null);
 useEffect(()=>()=>{const active=pending.current;pending.current=null;active?.abort();},[]);
 useEffect(()=>{if(!data)return;const expires=Math.min(...data.sections.map(section=>Date.parse(section.expiresAt)));const timer=setTimeout(()=>{setData(null);setError('The previous check has expired. Check again for current topics.');},Math.max(0,expires-Date.now()));return()=>clearTimeout(timer);},[data]);
 async function load(){
  if(busy)return;if(!navigator.onLine){setError('You’re offline. Connect to check Ghana topics and music.');return;}
  pending.current?.abort();const controller=new AbortController();pending.current=controller;setBusy(true);setError('');setData(null);const timeout=setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch(apiUrl('/discover/happening'),{credentials:'omit',signal:controller.signal,cache:'no-store',referrerPolicy:'no-referrer'});if(!response.ok)throw Error();const value=readHappening(await response.json());if(!value)throw Error();if(!controller.signal.aborted)setData(value);}
  catch{if(pending.current===controller)setError('Could not check current topics and music. Please try later.');}
  finally{clearTimeout(timeout);if(pending.current===controller){setBusy(false);}}
 }
 return <section className="rail-card happening-card" aria-label="Happening now"><div className="rail-heading"><h3><TrendingUp size={16} aria-hidden="true"/> Happening now</h3></div><p className="happening-intro">Ghana search interest and music charts, with separate sources.</p><button type="button" className="happening-load" disabled={busy} onClick={()=>void load()}>{busy?'Checking sources…':'Check Ghana topics & music'}</button>{error&&<p role="status">{error}</p>}{data?.sections.map(section=><div key={section.id} className="happening-source"><h4>{section.label}</h4><p className="happening-note">{section.id==='searches'?'Search interest, not confirmed news or EcoVibes activity.':'This chart reflects Apple Music listening, not all Ghanaian listeners.'}</p>{section.status==='available'?<ol>{section.items.map(item=><li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>{item.subtitle&&<span>{item.subtitle}</span>}</li>)}</ol>:<p>{section.status==='disabled'?'This source is turned off.':section.status==='empty'?'No recent entries returned.':'This source is unavailable. Try later.'}</p>}<a className="happening-attribution" href={section.sourceUrl} target="_blank" rel="noopener noreferrer">Data source: {section.source}</a>{section.updatedAt&&<small>{section.id==='music'?'Chart updated':'Latest source entry'} {time(section.updatedAt)}</small>}<small>Checked {time(section.checkedAt)}</small>{section.copyright&&<small>{section.copyright}</small>}</div>)}</section>;
}
