import { appReleaseUpdates, publicNewsSources, readPublicUpdates } from '../shared/chale-updates.mjs';

function endpoint(group){
  const url=new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  const hosts=Object.keys(publicNewsSources).filter(host=>publicNewsSources[host].kind===group);
  url.search=new URLSearchParams({query:`(${hosts.map(host=>`domainis:${host}`).join(' OR ')}) sourcelang:english`,mode:'artlist',format:'json',maxrecords:'100',timespan:'24h',sort:'datedesc'});
  return url.href;
}
function indexedDate(value){
  if(typeof value!=='string' || !/^\d{8}T\d{6}Z$/.test(value)) return '';
  const iso=value.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,'$1-$2-$3T$4:$5:$6.000Z');
  const time=Date.parse(iso);return Number.isFinite(time)&&new Date(time).toISOString()===iso?iso:'';
}
async function boundedJson(response){
  if(!response.ok || !/application\/json/i.test(response.headers.get('content-type')||'')) throw Error('News unavailable');
  const reader=response.body?.getReader();if(!reader)throw Error('News unavailable');
  let total=0;const chunks=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>262144)throw Error('News budget');chunks.push(value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createPublicUpdates({fetchImpl=(...args)=>fetch(...args),clock=Date.now,waitImpl=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  const caches=new Map(),pending=new Map();let queue=Promise.resolve(),nextAllowed=0;
  async function news(group){
    const cached=caches.get(group);if(cached && clock()<cached.expires)return cached;
    if(pending.has(group))return pending.get(group);
    const operation=queue.then(async()=>{
      const wait=Math.min(6000,Math.max(0,nextAllowed-clock()));if(wait)await waitImpl(wait);
      const checkedAt=new Date(clock()).toISOString();
      let value;
      try{
        const response=await fetchImpl(endpoint(group),{redirect:'error',credentials:'omit',signal:AbortSignal.timeout(5000),headers:{Accept:'application/json'}});
        const payload=await boundedJson(response);
        if(!Array.isArray(payload.articles) || payload.articles.length>100)throw Error('News shape');
        const entries=readPublicUpdates({entries:payload.articles.map(item=>{
          if(!item || typeof item.url!=='string')return null;
          let url;try{url=new URL(item.url);}catch{return null;}
          const source=publicNewsSources[url.hostname.replace(/^www\./,'')];
          return source?.kind===group?{...source,url:item.url,title:item.title,date:indexedDate(item.seendate)}:null;
        })},clock());
        value={entries,checkedAt,status:entries.length?'available':'empty',expires:clock()+15*60_000};
      }catch{value={entries:[],checkedAt,status:'unavailable',expires:clock()+60_000};}
      nextAllowed=clock()+6000;caches.set(group,value);return value;
    });
    queue=operation.then(()=>undefined,()=>undefined);pending.set(group,operation);
    try{return await operation;}finally{pending.delete(group);}
  }
  return async function publicUpdates(scope='both'){
    const selected=['app','ghana','world','both'].includes(scope)?scope:'both';
    const groups=selected==='app'?[]:selected==='both'?['ghana','world']:[selected];
    const data=await Promise.all(groups.map(news));
    const raw=[...(selected==='app'||selected==='both'?appReleaseUpdates:[]),...data.flatMap(value=>value.entries)];
    const entries=readPublicUpdates({entries:raw},clock());
    const statuses=data.map(value=>value.status);
    const newsStatus=!data.length?'not_requested':statuses.every(s=>s==='available')?'available':statuses.includes('available')?'partial':statuses.includes('unavailable')?'unavailable':'empty';
    return {source:'public_updates',text:[
      selected==='app'||selected==='both'?'EcoVibes updates below come from versioned release records. No verified popularity ranking or live activity counts are available.':'',
      ...data.map((value,i)=>`${groups[i]==='ghana'?'Ghana':'World'}: ${value.status==='unavailable'?'I could not check current news. Please try again later.':value.status==='empty'?'No recent headlines from the selected publishers were found in this news index.':'Publisher headlines below were indexed by GDELT within the last 36 hours. Indexed time is not publication time or independent fact-checking; this is not a popularity ranking.'} Last checked: ${value.checkedAt} (UTC).`),
    ].filter(Boolean).join('\n\n'),entries,newsStatus,newsStatuses:Object.fromEntries(groups.map((group,i)=>[group,data[i].status])),checkedAt:data.at(-1)?.checkedAt||null,asOf:new Date(clock()).toISOString(),items:[],guides:[],drafts:[],diagnostics:[],usage:{inputTokens:0,outputTokens:0,requests:0,latencyMs:0}};
  };
}
