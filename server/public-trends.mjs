import {happeningSources,plainPublicText,publicTrendItem} from '../shared/public-trends.mjs';
const iso=value=>{const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toISOString():null;};
function xmlText(value){
 if(typeof value!=='string')return null;
 const text=value.trim().replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/,'$1').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,entity)=>{
  if(entity[0]!=='#')return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[entity];
  const n=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';
 });
 return /&[a-z#][^; ]*;/i.test(text)?null:plainPublicText(text);
}
function searchRecords(text,now){
 if(/<!DOCTYPE|<!ENTITY/i.test(text)||!/<rss\b/.test(text)||!text.includes('<link>https://trends.google.com/trending/rss?geo=GH</link>'))throw Error('shape');
 const blocks=[...text.matchAll(/<item>([\s\S]*?)<\/item>/g)];if(blocks.length>100)throw Error('count');
 return blocks.map(([,block])=>{
  const title=xmlText(block.match(/<title>([\s\S]*?)<\/title>/)?.[1]);const date=iso(block.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1]);if(!title||!date)return null;
  const url=new URL('https://trends.google.com/trends/explore');url.search=new URLSearchParams({geo:'GH',q:title});return publicTrendItem('searches',{title,subtitle:'',url:url.href,date},now);
 }).filter(Boolean);
}
function musicRecords(text,now){
 const feed=JSON.parse(text)?.feed;if(!feed||feed.country!=='gh'||!Array.isArray(feed.results)||feed.results.length>100||!plainPublicText(feed.copyright))throw Error('shape');
 const date=iso(feed.updated);if(!date||now-Date.parse(date)>happeningSources.music.maxAge||Date.parse(date)>now+300000)throw Error('date');
 return {date,copyright:feed.copyright,items:feed.results.map(item=>publicTrendItem('music',{title:item?.name,subtitle:item?.artistName,url:item?.url,date},now)).filter(Boolean)};
}
async function body(response,id){
 if(!response.ok||!/(?:application\/(?:json|xml|rss\+xml)|text\/xml)/i.test(response.headers.get('content-type')||'')||(id==='music'&&!/application\/json/i.test(response.headers.get('content-type')||'')))throw Error('response');
 const reader=response.body?.getReader();if(!reader)throw Error('body');let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>262144)throw Error('size');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 return Buffer.concat(chunks).toString('utf8');
}
export function createPublicTrends({fetchImpl=(...args)=>fetch(...args),clock=Date.now,disabled=()=>process.env.ECOVIBES_PUBLIC_TRENDS_DISABLED==='true'}={}){
 const cache=new Map(),pending=new Map();
 async function section(id){
  const cfg=happeningSources[id],time=clock(),checkedAt=new Date(time).toISOString();
  const base={id,source:cfg.source,label:cfg.label,sourceUrl:cfg.sourceUrl,checkedAt,updatedAt:null,expiresAt:new Date(time+300000).toISOString(),copyright:'',items:[]};
  if(disabled())return {...base,status:'disabled'};
  const old=cache.get(id);if(old&&Date.parse(old.expiresAt)>time)return old;if(pending.has(id))return pending.get(id);
  const operation=(async()=>{let result;
   try{
    const response=await fetchImpl(cfg.endpoint,{signal:AbortSignal.timeout(5000),redirect:'error',credentials:'omit',headers:{Accept:id==='music'?'application/json':'application/rss+xml, text/xml'}});
    const text=await body(response,id),completedAt=clock(),parsed=id==='music'?musicRecords(text,completedAt):{items:searchRecords(text,completedAt),copyright:''};
    const seen=new Set(),items=parsed.items.filter(item=>{const key=item.url;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,4);
    result={...base,status:items.length?'available':'empty',items,copyright:parsed.copyright,updatedAt:items.length?(parsed.date||items.map(item=>item.date).sort().at(-1)):null,expiresAt:new Date(items.length?Math.min(time+cfg.ttl,...items.map(item=>Date.parse(item.date)+cfg.maxAge)):time+300000).toISOString()};
   }catch{result={...base,status:'unavailable'};}
   // A switch changed during an upstream request also prevents returning its data.
   if(disabled())result={...base,status:'disabled'};
   cache.set(id,result);return result;
  })();pending.set(id,operation);try{return await operation;}finally{pending.delete(id);}
 }
 return async()=>({asOf:new Date(clock()).toISOString(),sections:await Promise.all(['searches','music'].map(section))});
}
