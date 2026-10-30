import {useEffect,useState} from 'react';
import {Fingerprint,Layers3,Leaf,Recycle} from 'lucide-react';
import './depth-view.css';

type DataMode='standard'|'saver'|'extreme';
const preferenceKey='ecovibes:depth-view:v1';
function readPreference(){try{return localStorage.getItem(preferenceKey)==='flat'?'flat':'depth';}catch{return 'depth';}}
export function useDepthView(saver:DataMode){
 const [choice,setChoice]=useState(readPreference);
 const [reduced,setReduced]=useState(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false);
 const supported=typeof CSS!=='undefined'&&CSS.supports?.('transform-style','preserve-3d')===true;
 useEffect(()=>{
  const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const changed=()=>setReduced(media?.matches??false);
  media?.addEventListener?.('change',changed);
  const preferenceChanged=()=>setChoice(readPreference());
  window.addEventListener('storage',preferenceChanged);window.addEventListener('ecovibes:depth_changed',preferenceChanged);
  return()=>{media?.removeEventListener?.('change',changed);window.removeEventListener('storage',preferenceChanged);window.removeEventListener('ecovibes:depth_changed',preferenceChanged);};
 },[]);
 const reason=saver!=='standard'?'2D view · Data Saver':reduced?'2D view · Reduced motion':!supported?'2D view · Browser compatibility':'';
 const depth=!reason&&choice==='depth';
 function toggle(){const next=depth?'flat':'depth';setChoice(next);try{localStorage.setItem(preferenceKey,next);window.dispatchEvent(new Event('ecovibes:depth_changed'));}catch{/* The control still works without persistent storage. */}}
 return{depth,reason,toggle};
}
export function DepthToggle({view}:{view:ReturnType<typeof useDepthView>}){
 return view.reason?<span className="depth-mode-note"><Layers3 size={15} aria-hidden="true"/>{view.reason}</span>:<button type="button" className="depth-mode-toggle" onClick={view.toggle}><Layers3 size={16} aria-hidden="true"/>{view.depth?'Use 2D view':'Use 3D view'}</button>;
}

// Decorative CSS solids only: no device sensors, account data, map or GPU canvas.
export function DepthScene({kind,depth}:{kind:'home'|'collection';depth:boolean}){
 return <div className={`eco-depth-scene scene-${kind}`} data-depth={depth?'3d':'2d'} aria-hidden="true">
  {depth?<div className="eco-depth-stage">
   <div className="eco-depth-floor"/><div className="eco-depth-plinth"/>
   {kind==='home'?<>
    <div className="eco-id-solid"><div className="solid-edge"/><div className="solid-face"><Fingerprint size={68}/><span>ecovibes</span><Leaf size={18}/></div></div>
    <div className="eco-depth-sprout"><i/><b/><span/></div><div className="eco-depth-seed seed-one"/><div className="eco-depth-seed seed-two"/>
   </>:<>
    <div className="eco-bin-solid"><div className="bin-front"><Recycle size={43}/></div><div className="bin-side"/><div className="bin-lid"/><i className="bin-wheel wheel-left"/><i className="bin-wheel wheel-right"/></div>
    <div className="eco-paper-stack"><span/><span/><span/></div><div className="eco-bottle"><i/><span/></div>
   </>}
  </div>:<svg className="eco-flat-scene" viewBox="0 0 320 230" focusable="false">
   <ellipse cx="160" cy="194" rx="112" ry="12" fill="#103e2d" opacity=".2"/>
   {kind==='home'?<><rect x="84" y="40" width="152" height="152" rx="36" fill="#cdeca8"/><path d="M160 67c-36 0-55 26-55 56m55-41c-28 0-40 20-40 42v34m40-59c-18 0-26 12-26 25v51m26-62c-9 0-12 5-12 13v56m12-50v49m14-86c21 8 27 23 27 42m-26-26v60m13-34v27" fill="none" stroke="#21563e" strokeWidth="6" strokeLinecap="round"/></>:<><path d="M100 71h122l-12 120H112z" fill="#91b77e"/><path d="M90 61h142v18H90z" fill="#d4eca8"/><path d="M139 61V47h44v14" fill="none" stroke="#d4eca8" strokeWidth="9"/><circle cx="126" cy="195" r="9" fill="#173e2e"/><circle cx="196" cy="195" r="9" fill="#173e2e"/><path d="m141 114 15-23 14 24m-33 4-14 24h29m30-21 14 23h-29" fill="none" stroke="#183f2e" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/></>}
  </svg>}
 </div>;
}
