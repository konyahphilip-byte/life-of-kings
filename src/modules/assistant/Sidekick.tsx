import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, ChevronRight, Sparkles, X } from 'lucide-react';
import { answerEcoVibesQuery, type AssistantDestination, type AssistantItem } from './assistant';

type ChatEntry = {id:number;role:'assistant'|'user';text:string;items?:AssistantItem[]};
type LiveSearchItem={id:string;kind:string;title:string;detail:string;category:string;destination:'Marketplace'|'Quick&Handi';actor_eco_id:string;price?:string};
const welcome:ChatEntry={id:0,role:'assistant',text:'Hi Philip. I can help you find creators, products, games, communities and opportunities across EcoVibes.'};
export default function Sidekick({onNavigate}:{onNavigate:(page:AssistantDestination)=>void}){
 const [open,setOpen]=useState(false);
 const [draft,setDraft]=useState('');
 const [entries,setEntries]=useState<ChatEntry[]>([welcome]);
 const inputRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(open)inputRef.current?.focus()},[open]);
 const ask=async(value:string)=>{const query=value.trim();if(!query)return;setDraft('');const userId=Date.now();setEntries(current=>[...current,{id:userId,role:'user',text:query},{id:userId+1,role:'assistant',text:'Searching EcoVibes…'}]);let result=answerEcoVibesQuery(query);try{const response=await fetch(`/api/v1/search?q=${encodeURIComponent(query)}`,{credentials:'include'});if(response.ok){const payload=await response.json() as {items:LiveSearchItem[]};if(payload.items.length){result={...result,text:`I found ${payload.items.length} matching public listings and open jobs in the live EcoVibes catalog.`,items:payload.items.map(item=>({id:item.id,eyebrow:`${item.kind==='job'?'QUICK&HANDI JOB':'MARKETPLACE PRODUCT'} · ${item.category}`,title:item.title,detail:`${item.detail} · @${item.actor_eco_id}${item.price?` · ${item.price}`:''}`,destination:item.destination,score:1}))};}}}catch{/* Use bundled preview results when the local API is unavailable. */}setEntries(current=>current.map(entry=>entry.id===userId+1?{...entry,text:result.text,items:result.items}:entry));};
 const submit=(event:FormEvent)=>{event.preventDefault();ask(draft)};
 return <>
  <button className="sidekick-launch" onClick={()=>setOpen(value=>!value)} aria-expanded={open} aria-controls="ecovibes-sidekick"><span className="sidekick-orb" aria-hidden="true"><Sparkles size={19}/></span><span>Ask your sidekick</span><i>AI</i></button>
  {open&&<section className="sidekick-panel" id="ecovibes-sidekick" role="dialog" aria-label="EcoVibes sidekick">
    <header className="sidekick-head"><span className="sidekick-avatar"><Sparkles size={19}/></span><span><b>EcoVibes sidekick</b><small><i/> Your ecosystem guide · preview</small></span><button aria-label="Close sidekick" onClick={()=>setOpen(false)}><X size={17}/></button></header>
    <div className="sidekick-context"><span className="context-orbit"><span/><i/><b/></span><span><b>One identity. More ways forward.</b><small>Search EcoVibes in everyday language.</small></span></div>
    <div className="sidekick-thread" aria-live="polite">{entries.map(entry=><div className={`assistant-message ${entry.role}`} key={entry.id}><p>{entry.text}</p>{entry.items?.length? <div className="assistant-results">{entry.items.map(item=><button key={item.id} onClick={()=>{onNavigate(item.destination);setOpen(false)}}><span><small>{item.eyebrow}</small><b>{item.title}</b><i>{item.detail}</i></span><ChevronRight size={16}/></button>)}</div>:null}</div>)}
      {entries.length===1&&<div className="sidekick-prompts"><span>TRY ASKING</span>{['Find grants','Show creators','Explore gaming','Open communities'].map(prompt=><button key={prompt} onClick={()=>ask(prompt)}>{prompt}<ChevronRight size={13}/></button>)}</div>}
    </div>
    <form className="sidekick-input" onSubmit={submit}><input ref={inputRef} value={draft} onChange={event=>setDraft(event.target.value)} placeholder="What are you looking for?" aria-label="Ask the EcoVibes sidekick"/><button disabled={!draft.trim()} aria-label="Send question"><ArrowUp size={17}/></button></form>
    <p className="sidekick-disclosure">Searches public live products and open jobs when the API is available; otherwise uses demo listings. Generative AI isn’t connected.</p>
  </section>}
 </>;
}
