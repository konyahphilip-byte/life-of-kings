import {useEffect,useState} from 'react';

export const CHALE_UI_KEY='ecovibes:chale-ui:v1';
const changedEvent='ecovibes:chale_ui_changed';
export type ChaleUI={launcher:'compact'|'labelled'|'hidden';edge:'left'|'right';showCharacter:boolean};
const defaults:ChaleUI={launcher:'compact',edge:'right',showCharacter:false};
let tabChoice:ChaleUI|null=null;
function clean(value:unknown):ChaleUI{
 const v=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
 return {launcher:v.launcher==='hidden'||v.launcher==='labelled'?v.launcher:'compact',edge:v.edge==='left'?'left':'right',showCharacter:v.showCharacter===true};
}
export function readChaleUI():ChaleUI{
 if(tabChoice)return {...tabChoice};
 try{return clean(JSON.parse(localStorage.getItem(CHALE_UI_KEY)||'null'));}catch{return {...defaults};}
}
export function saveChaleUI(value:ChaleUI):boolean{
 const next=clean(value);let saved=true;
 try{localStorage.setItem(CHALE_UI_KEY,JSON.stringify(next));tabChoice=null;}catch{saved=false;tabChoice=next;}
 window.dispatchEvent(new CustomEvent(changedEvent,{detail:next}));
 return saved;
}
export function useChaleUI():ChaleUI{
 const [value,setValue]=useState(readChaleUI);
 useEffect(()=>{
  const changed=(event:Event)=>setValue(clean((event as CustomEvent).detail));
  const storage=(event:StorageEvent)=>{if(event.key!==CHALE_UI_KEY&&event.key!==null)return;tabChoice=null;setValue(readChaleUI());};
  window.addEventListener(changedEvent,changed);window.addEventListener('storage',storage);
  return()=>{window.removeEventListener(changedEvent,changed);window.removeEventListener('storage',storage);};
 },[]);
 return value;
}
