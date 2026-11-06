import {emptyHeadlines,headlineItem,headlinePublishers,headlineSources} from '../shared/happening-news.mjs';
import {plainPublicText} from '../shared/public-trends.mjs';
function text(value,max=200){
 if(typeof value!=='string')return '';
 const decoded=value.trim().replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/,'$1').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(_,entity)=>{
  if(entity[0]!=='#')return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[entity.toLowerCase()];
  const n=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';
 });return /&[a-z#][^; ]*;/i.test(decoded)?'':plainPublicText(decoded,max)||'';
}
const tag=(block,name)=>block.match(new RegExp('<'+name+'>([\\s\\S]*?)<\\/'+name+'>'))?.[1];
function date(value){
 if(typeof value!=='string')return null;
 const parts=value.trim().match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) ([0-2]\d):([0-5]\d):([0-5]\d) (CET|CEST|GMT|UTC|[+-](?:0\d|1[0-4])[0-5]\d)$/);
 if(!parts)return null;
 const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(parts[2]);
 if(+parts[1]<1||+parts[1]>new Date(Date.UTC(+parts[3],month+1,0)).getUTCDate()||+parts[4]>23)return null;
 const time=Date.parse(value.trim().replace(/ CET$/,' +0100').replace(/ CEST$/,' +0200'));
 return Number.isFinite(time)?new Date(time).toISOString():null;
}
function finish(id,items,now,expires){
 const cfg=headlineSources[id],seen=new Set();items=items.filter(item=>{if(!item||seen.has(item.url))return false;seen.add(item.url);return true;}).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4);
 return {...emptyHeadlines(id,now,items.length?'available':'empty'),items,updatedAt:items[0]?.date||null,expiresAt:new Date(items.length?Math.min(expires,now+cfg.ttl,...items.map(item=>Date.parse(item.date)+cfg.maxAge)):now+300000).toISOString()};
}
export function relatedGhanaNews(xml,now,expires){
 const id='ghana-news';if(typeof xml!=='string'||Buffer.byteLength(xml)>262144||/<!DOCTYPE|<!ENTITY/i.test(xml))return emptyHeadlines(id,now);
 const blocks=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];if(blocks.length>100)return emptyHeadlines(id,now);
 const items=[];for(const [,block]of blocks){const stamp=date(tag(block,'pubDate'));if(!stamp)continue;
  const related=[...block.matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/g)];if(related.length>10)continue;
  for(const [,entry]of related){const url=text(tag(entry,'ht:news_item_url'),2048);let publisher;try{const host=new URL(url).hostname.replace(/^www\./,'');publisher=Object.hasOwn(headlinePublishers,host)?headlinePublishers[host]:null;}catch{continue;}items.push(headlineItem(id,{title:text(tag(entry,'ht:news_item_title')),url,publisher,date:stamp,dateKind:'trend'},now));}
 }return finish(id,items,now,expires);
}
export function createWorldBriefings({fetchImpl=(...args)=>fetch(...args),clock=Date.now,disabled=()=>process.env.ECOVIBES_PUBLIC_TRENDS_DISABLED==='true'}={}){
 let cached,pending;
 return async function worldBriefings(){
  const id='world-news',started=clock();if(disabled())return emptyHeadlines(id,started,'disabled');if(cached&&Date.parse(cached.expiresAt)>started)return cached;if(pending)return pending;
  pending=(async()=>{let result;
   try{const response=await fetchImpl(headlineSources[id].sourceUrl,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(5000),headers:{Accept:'application/rss+xml, application/xml, text/xml'}});
    if(!response.ok||!/^(?:application\/(?:rss\+xml|xml)|text\/xml)(?:;|$)/i.test(response.headers.get('content-type')||''))throw Error();
    const reader=response.body?.getReader();if(!reader)throw Error();let size=0;const chunks=[];
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>262144)throw Error();chunks.push(value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    const xml=Buffer.concat(chunks).toString('utf8');if(/<!DOCTYPE|<!ENTITY/i.test(xml)||!xml.includes('<link>https://www.ungeneva.org/en</link>'))throw Error();
    const blocks=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];if(blocks.length>100)throw Error();
    const completed=clock();result=finish(id,blocks.map(([,block])=>headlineItem(id,{title:text(tag(block,'title')),url:text(tag(block,'link'),2048),publisher:'UN Geneva',date:date(tag(block,'pubDate')),dateKind:'published'},completed)),completed,completed+headlineSources[id].ttl);
   }catch{result=emptyHeadlines(id,clock());}
   if(disabled())result=emptyHeadlines(id,clock(),'disabled');cached=result;return result;
  })();try{return await pending;}finally{pending=null;}
 };
}
