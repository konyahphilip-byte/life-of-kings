import {createHash} from 'node:crypto';

const key='wikidata-ghana-profile';
const url='https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q117&props=info%7Clabels%7Cdescriptions&languages=en%7Ctw&format=json&formatversion=2&maxlag=5';
export const KNOWLEDGE_SOURCE_CATALOG=Object.freeze([Object.freeze({
 key, sourceId:'5bcfba06-5fce-4ada-a533-e7ef25886045',
 title:'Ghana: Wikidata country profile',sourceUrl:'https://www.wikidata.org/wiki/Q117',
 license:'CC0-1.0',licenseUrl:'https://www.wikidata.org/wiki/Wikidata:Licensing',
 attribution:'Source: Wikidata structured data (CC0). English and available Twi labels/descriptions; no images or article text.',
 category:'geography',language:'en',region:'GH',approvalVersion:'2026-11-07-wikidata-v1',
 intervalSeconds:86400
})]);
export const sourceHash=body=>createHash('sha256').update(body).digest('hex');
export class KnowledgeSourceError extends Error{
 constructor(code,retrySeconds=0){super('Public source check did not complete.');this.code=code;this.retrySeconds=retrySeconds;}
}
const validator=v=>typeof v==='string'&&v.length<=200&&!/[\u0000-\u001f\u007f]/.test(v)?v:null;
const value=v=>typeof v==='string'&&v.trim()&&v.length<=500&&!/[\u0000-\u001f\u007f]/.test(v)?v.trim().normalize('NFC'):null;
const retryAfter=(header,time)=>{if(!header)return 0;const seconds=/^\d+$/.test(header)?Number(header):(Date.parse(header)-time)/1000;return Number.isFinite(seconds)?Math.max(0,Math.min(7*86400,Math.ceil(seconds))):0;};

// No user URL, query, account content, cookie or credential can enter this adapter.
export async function readKnowledgeSource(sourceKey,previous={},options={}){
 if(sourceKey!==key)throw new KnowledgeSourceError('unsupported_source');
 const fetchImpl=options.fetchImpl||fetch,clock=options.now||(()=>Date.now()),controller=new AbortController();
 let timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new KnowledgeSourceError('source_timeout'));},5000);});
 try{
  return await Promise.race([(async()=>{
   const etag=validator(previous.etag),modified=validator(previous.lastModified);
   const response=await fetchImpl(url,{method:'GET',credentials:'omit',redirect:'error',signal:controller.signal,headers:{
    Accept:'application/json','User-Agent':'EcoVibesKnowledgePilot/0.1 (https://github.com/konyahphilip-byte/life-of-kings)',
    ...(etag?{'If-None-Match':etag}:{}),...(modified?{'If-Modified-Since':modified}:{})
   }});
   if(response.url&&response.url!==url)throw new KnowledgeSourceError('source_redirect');
   if(response.status===304){if(!etag&&!modified)throw new KnowledgeSourceError('source_format');return {notModified:true,etag:validator(response.headers.get('etag'))||etag,lastModified:validator(response.headers.get('last-modified'))||modified};}
   if(response.status===429||response.status===503)throw new KnowledgeSourceError('source_busy',retryAfter(response.headers.get('retry-after'),clock()));
   if(!response.ok)throw new KnowledgeSourceError('source_http');
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''))throw new KnowledgeSourceError('source_format');
   const length=Number(response.headers.get('content-length'));if(Number.isFinite(length)&&length>131072)throw new KnowledgeSourceError('source_oversized');
   const reader=response.body?.getReader();if(!reader)throw new KnowledgeSourceError('source_format');
   let size=0;const parts=[];
   try{while(true){const {value:part,done}=await reader.read();if(done)break;size+=part.length;if(size>131072)throw new KnowledgeSourceError('source_oversized');parts.push(part);}}
   finally{void reader.cancel().catch(()=>{});}
   let data;try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));}catch{throw new KnowledgeSourceError('source_format');}
   if(data?.error?.code==='maxlag'||data?.error?.code==='ratelimited')throw new KnowledgeSourceError('source_busy',900);
   const item=data?.entities?.Q117;
   if(!item||item.id!=='Q117'||!Number.isSafeInteger(item.lastrevid)||item.lastrevid<1)throw new KnowledgeSourceError('source_format');
   const lines=['Wikidata country profile Q117. External source data; review before publication.'];
   for(const language of ['en','tw']){
    const label=item.labels?.[language],description=item.descriptions?.[language];
    if(language==='en'&&(!value(label?.value)||label.language!==language))throw new KnowledgeSourceError('source_format');
    if(label){const text=value(label.value);if(!text||label.language!==language)throw new KnowledgeSourceError('source_format');lines.push('Name ('+language+'): '+text);}
    if(description){const text=value(description.value);if(!text||description.language!==language)throw new KnowledgeSourceError('source_format');lines.push('Description ('+language+'): '+text);}
   }
   const body=lines.join('\n');
   return {body,contentHash:sourceHash(body),remoteRevision:String(item.lastrevid),bytes:size,etag:validator(response.headers.get('etag')),lastModified:validator(response.headers.get('last-modified'))};
  })(),timeout]);
 }catch(error){if(error instanceof KnowledgeSourceError)throw error;throw new KnowledgeSourceError(controller.signal.aborted?'source_timeout':'source_network');}
 finally{clearTimeout(timer);controller.abort();}
}

