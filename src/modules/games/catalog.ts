export type GameProject={id:string;title:string;category:string;status:'development'|'planned';summary:string;milestone:string;target:string;controls:string;playable:false;releaseVersion:null;downloadBytes:null;notice:string};
export type GameCatalog={version:1;source:'ecovibes-roadmap';categories:string[];games:GameProject[]};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max:number)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
export function readCatalog(value:unknown):GameCatalog{
 const fail=()=>{throw Error('The games catalog could not be read. Please try again.');};
 if(!object(value)||value.version!==1||value.source!=='ecovibes-roadmap'||!Array.isArray(value.categories)||!Array.isArray(value.games))return fail();
 const categories=value.categories,games=value.games;
 if(!categories.length||categories.length>20||categories[0]!=='All'||categories.some(c=>!text(c,40))||new Set(categories).size!==categories.length||games.length>100)return fail();
 const ids=new Set();
 for(const game of games){
  if(!object(game)||!text(game.id,64)||! /^[a-z][a-z0-9-]+$/.test(String(game.id))||ids.has(game.id)||!text(game.title,100)||!text(game.summary,500)
   ||!text(game.milestone,200)||!text(game.target,200)||!text(game.controls,200)||!text(game.notice,500)||game.category==='All'||!categories.includes(game.category)
   ||!['development','planned'].includes(String(game.status))||game.playable!==false||game.releaseVersion!==null||game.downloadBytes!==null)return fail();
  ids.add(game.id);
 }
 return value as unknown as GameCatalog;
}
export function savedKey(ownerId:string|null){return 'ecovibes:games:saved:v1:'+encodeURIComponent(ownerId===null?'guest':'account:'+ownerId);}
export function readSaved(key:string):{ids:string[];error:string}{
 try{
  const value:unknown=JSON.parse(localStorage.getItem(key)||'[]');
  if(!Array.isArray(value)||value.length>100||value.some(id=>typeof id!=='string'||! /^[a-z][a-z0-9-]{1,63}$/.test(id)))throw Error();
  return {ids:[...new Set(value)],error:''};
 }catch{return {ids:[],error:'The saved list could not be read. Your existing list has not been changed.'};}
}
