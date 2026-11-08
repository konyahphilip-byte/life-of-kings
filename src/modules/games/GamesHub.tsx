import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,Bookmark,ChevronLeft,Gamepad2,Search,ShieldCheck,Sparkles,X} from 'lucide-react';
import {apiRequest} from '../../lib/api';
import {readCatalog,readSaved,savedKey,type GameCatalog,type GameProject} from './catalog';
import './games.css';
type Props={ownerId:string|null;saver:'standard'|'saver'|'extreme';onSupport:()=>void;onAskAI:()=>void};
export default function GamesHub(props:Props){return <GamesWorkspace key={props.ownerId??'guest'} {...props}/>;}
function GamesWorkspace({ownerId,saver,onSupport,onAskAI}:Props){
 const [catalog,setCatalog]=useState<GameCatalog|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const [section,setSection]=useState<'discover'|'saved'|'creator'>('discover'),[query,setQuery]=useState(''),[category,setCategory]=useState('All');
 const [selected,setSelected]=useState<string|null>(null),[saved,setSaved]=useState(()=>readSaved(savedKey(ownerId)));
 const [storageError,setStorageError]=useState(''),[notice,setNotice]=useState('');
 const [offline,setOffline]=useState(!navigator.onLine),[focusRevision,setFocusRevision]=useState(0);
 const navigationRef=useRef<HTMLElement|null>(null);
 const detailRef=useRef<HTMLElement|null>(null),opener=useRef<HTMLButtonElement|null>(null);
 const key=savedKey(ownerId);
 useEffect(()=>{
  const sync=(event:StorageEvent)=>{if(event.key===key||event.key===null){setSaved(readSaved(key));setNotice('');}};
  const connection=()=>setOffline(!navigator.onLine);
  window.addEventListener('storage',sync);window.addEventListener('online',connection);window.addEventListener('offline',connection);
  return()=>{window.removeEventListener('storage',sync);window.removeEventListener('online',connection);window.removeEventListener('offline',connection);};
 },[key]);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  setCatalog(null);setError('');
  const timer=setTimeout(()=>{if(active){controller.abort();setError('The catalog took too long to load. Please try again.');}},8000);
  apiRequest<unknown>('/games',{signal:controller.signal}).then(value=>{if(active){setCatalog(readCatalog(value));clearTimeout(timer);}}).catch(reason=>{
   if(active){clearTimeout(timer);setError(reason instanceof Error&&reason.name!=='AbortError'?reason.message:'The catalog is unavailable. Please try again.');}
  });
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[attempt]);
 useEffect(()=>{if(selected)detailRef.current?.focus();},[selected,focusRevision]);
 const games=useMemo(()=>catalog?.games.filter(game=>(section!=='saved'||saved.ids.includes(game.id))
  &&(category==='All'||category===game.category)&&(''+game.title+' '+game.summary).toLowerCase().includes(query.trim().toLowerCase()))??[],[catalog,section,saved.ids,query,category]);
 const featured=catalog?.games.find(game=>game.id==='rumble-rush');
 const detail=catalog?.games.find(game=>game.id===selected);
 const showDetails=(game:GameProject,button:HTMLButtonElement)=>{opener.current=button;setSelected(game.id);setFocusRevision(value=>value+1);};
 const closeDetails=()=>{setSelected(null);if(opener.current?.isConnected)opener.current.focus();else navigationRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();};
 const chooseSection=(value:typeof section)=>{setSection(value);setSelected(null);setCategory('All');setQuery('');setNotice('');};
 const toggleSaved=(game:GameProject)=>{
  if(saved.error)return;
  // Read immediately before this explicit write to incorporate other-tab changes.
  const current=readSaved(key);if(current.error){setSaved(current);return;}
  const removing=current.ids.includes(game.id),ids=removing?current.ids.filter(id=>id!==game.id):[...current.ids,game.id];
  try{localStorage.setItem(key,JSON.stringify(ids));setSaved({ids,error:''});setStorageError('');setNotice(removing?'Removed from this device’s saved list.':'Saved on this device.');}
  catch{setStorageError('Your change could not be saved on this device. No saved success has been recorded.');setNotice('');}
 };
 const saveButton=(game:GameProject)=>{const active=saved.ids.includes(game.id);return <button className="eg-save" aria-label={active?'Remove '+game.title+' from saved':'Save '+game.title} aria-pressed={active} disabled={!!saved.error} onClick={()=>toggleSaved(game)}><Bookmark size={18} fill={active?'currentColor':'none'}/><span>{active?'Saved':'Save'}</span></button>;};
 return <section className="ecogames" aria-label="EcoVibes Games">
  <header className="eg-masthead"><div className="eg-wordmark"><Gamepad2 size={25}/><h1>EcoGames<span aria-hidden="true">BY ECOVIBES</span></h1></div><span className="eg-pilot">THE FIRST CHAPTER</span></header>
  <nav ref={navigationRef} className="eg-tabs" aria-label="Games navigation">{([['discover','Discover'],['saved','Saved projects'],['creator','Creator guide']] as const).map(([value,label])=><button key={value} aria-label={label} aria-pressed={section===value} onClick={()=>chooseSection(value)}>{label}{value==='saved'&&<span aria-hidden="true">{catalog?.games.filter(g=>saved.ids.includes(g.id)).length??0}</span>}</button>)}</nav>
  {offline&&<p className="eg-notice" role="status">You’re offline. Loaded project details and saved choices remain here; retry the catalog when connected.</p>}
  {(saved.error||storageError)&&<p className="eg-error" role="alert">{saved.error||storageError}</p>}
  <p className="eg-sr" role="status" aria-live="polite">{notice}</p>
  {section==='creator'?<section className="eg-creator"><span className="eg-kicker">IDEAS NEED A PLACE TO START</span><h2>Make something<br/>worth playing.</h2><p>Bring your idea to Chale AI for planning and conversation. Game generation, the project vault and publishing are still being built.</p><button className="eg-primary" onClick={onAskAI}><Sparkles size={18}/>Open Chale AI<ArrowRight size={18}/></button><ol><li><strong>Define the moment.</strong> What should your player feel, do and discover?</li><li><strong>Start with one mechanic.</strong> Build a small playable loop before expanding.</li><li><strong>Keep your originals.</strong> Record asset rights and back up your own project files.</li></ol><p className="eg-fine">This page does not upload files, generate code or submit a game for publication.</p></section>:<>
  {section==='discover'&&<section className="eg-feature" aria-label="Featured development project">
   {saver!=='extreme'&&<img className="ecogames-art" src="/games/accra-skyway.svg" width="1280" height="740" alt="" decoding="async"/>}
   <div className="eg-feature-copy"><span className="eg-kicker">ORIGINAL WORLDS. NEW POSSIBILITIES.</span><p className="eg-feature-line">A city above.<br/>A road of your own.</p><h2>RUMBLE RUSH<span>FUSION EDITION</span></h2><p>Accra Skyway is where our first racing project begins. Built around rhythm, speed and a different view of home.</p>
   {featured&&<button className="eg-primary" onClick={event=>showDetails(featured,event.currentTarget)}>Explore the project<ArrowRight size={18}/></button>}
   <span className="eg-build-state"><span/>In development · No public build yet</span></div>
  </section>}
  <div className="eg-section-heading"><div><span className="eg-kicker">{section==='saved'?'YOUR LOCAL SHORTLIST':'FROM OUR DEVELOPMENT CATALOG'}</span><h2>{section==='saved'?'Saved for later':'Find your next world'}</h2></div><p>Every project has a starting line.<br/>Released builds will appear after testing and approval.</p></div>
  <div className="eg-discovery-controls"><label className="eg-search"><Search size={18}/><span className="eg-sr">Search game projects</span><input type="search" maxLength={80} placeholder="A title, a genre, an idea…" value={query} onChange={event=>{setQuery(event.target.value);setSelected(null);}}/></label>{catalog&&<div className="eg-filters" aria-label="Game categories">{catalog.categories.map(value=><button key={value} aria-pressed={category===value} onClick={()=>{setCategory(value);setSelected(null);}}>{value}</button>)}</div>}</div>
  {error?<div className="eg-error" role="alert"><h3>Let’s reconnect to the catalog.</h3><p>{error}</p><button className="eg-primary" onClick={()=>setAttempt(a=>a+1)}>Try again</button></div>:!catalog?<div className="eg-loading" role="status">Loading the development catalog…</div>:<>
   <p className="eg-result-count" role="status">{games.length} {games.length===1?'project':'projects'} · No public releases yet</p>
   {games.length?<div className="eg-projects">{games.map((game,index)=><article className={'eg-project eg-'+game.category.toLowerCase()} key={game.id}><div className="eg-cover" aria-hidden="true"><span className="eg-cover-index">{String(index+1).padStart(2,'0')}</span><span className="eg-cover-shape"/><span className="eg-cover-title">{game.category==='Strategy'?'THINK\nAHEAD':game.category==='Racing'?'FIND\nYOUR LINE':game.category==='Puzzle'?'WORD\nBY WORD':game.category==='Learning'?'SMALL\nDISCOVERIES':'MAKE\nYOUR MOVE'}</span><span className="eg-cover-cross">+</span></div><div className="eg-project-body"><div className="eg-project-meta"><span>{game.category}</span><span>{game.status==='development'?'In development':'Planned'}</span></div><h3>{game.title}</h3><p>{game.summary}</p><div className="eg-project-actions"><button aria-label={'View project: '+game.title} aria-expanded={selected===game.id} className="eg-detail-button" onClick={event=>showDetails(game,event.currentTarget)}>View project<ArrowRight size={17}/></button>{saveButton(game)}</div></div></article>)}</div>:<div className="eg-empty"><Bookmark size={28}/><h3>{section==='saved'&&!query&&category==='All'?'Your next discovery starts here':'No matching projects'}</h3><p>{section==='saved'?'Save a project from Discover to keep it here on this device.':'Try another title or category.'}</p><button className="eg-primary" onClick={()=>{if(section==='saved'&&!query&&category==='All')chooseSection('discover');else{setQuery('');setCategory('All');}}}>{section==='saved'&&!query&&category==='All'?'Explore projects':'Clear filters'}</button></div>}
  </>}
  {detail&&<section className="eg-detail" ref={detailRef} tabIndex={-1} aria-label={detail.title+' details'}><div><span className="eg-kicker">PROJECT NOTES</span><button aria-label="Close details" onClick={closeDetails}><X size={21}/></button></div><h2>{detail.title}</h2><p>{detail.summary}</p><p className="eg-notice">{detail.notice}</p><dl><div><dt>Current focus</dt><dd>{detail.milestone}</dd></div><div><dt>Platform targets</dt><dd>{detail.target}</dd></div><div><dt>Input targets</dt><dd>{detail.controls}</dd></div><div><dt>Release</dt><dd>Not released. Device performance, controller compatibility and download size are unverified.</dd></div></dl><button className="eg-detail-button" onClick={closeDetails}><ChevronLeft size={18}/>Back to discoveries</button></section>}
  </>}
  <footer className="eg-footer"><ShieldCheck size={21}/><div><strong>Your ideas. Your pace.</strong><p>Only a saved list on this device; it is not a game backup or cloud library. No paid games, cash prizes or creator payouts are active.</p></div><button onClick={onSupport}>Report a concern</button></footer>
 </section>;
}
