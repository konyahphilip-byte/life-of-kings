import { appReleaseUpdates, publicNewsSources, readPublicUpdates } from '../shared/chale-updates.mjs';

const endpoint=new URL('https://api.gdeltproject.org/api/v2/doc/doc');
endpoint.search=new URLSearchParams({query:`(${Object.keys(publicNewsSources).map(host=>`domainis:${host}`).join(' OR ')}) sourcelang:english`,mode:'artlist',format:'json',maxrecords:'100',timespan:'24h',sort:'datedesc'});
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

export function createPublicUpdates({fetchImpl=(...args)=>fetch(...args),clock=Date.now}={}){
  let cached=null,pending=null;
  async function news(){
    if(cached && clock()<cached.expires)return cached;
    if(pending)return pending;
    pending=(async()=>{
      const checkedAt=new Date(clock()).toISOString();
      try{
        const response=await fetchImpl(endpoint.href,{redirect:'error',credentials:'omit',signal:AbortSignal.timeout(5000),headers:{Accept:'application/json'}});
        const payload=await boundedJson(response);
        if(!Array.isArray(payload.articles) || payload.articles.length>100)throw Error('News shape');
        const entries=readPublicUpdates({entries:payload.articles.map(item=>{
          if(!item || typeof item.url!=='string')return null;
          let url;try{url=new URL(item.url);}catch{return null;}
          const source=publicNewsSources[url.hostname.replace(/^www\./,'')];
          return source?{...source,url:item.url,title:item.title,date:indexedDate(item.seendate)}:null;
        })},clock());
        cached={entries,checkedAt,status:entries.length?'available':'empty',expires:clock()+15*60_000};
      }catch{cached={entries:[],checkedAt,status:'unavailable',expires:clock()+60_000};}
      return cached;
    })();
    try{return await pending;}finally{pending=null;}
  }
  return async function publicUpdates(scope='both'){
    const selected=['app','ghana','world','both'].includes(scope)?scope:'both';
    const data=selected==='app'?null:await news();
    const raw=[...(selected==='app'||selected==='both'?appReleaseUpdates:[]),...(data?.entries||[]).filter(e=>selected==='both'||e.kind===selected)];
    const entries=readPublicUpdates({entries:raw},clock());
    const newsStatus=selected==='app'?'not_requested':data.status==='available'&&!entries.some(e=>e.kind!=='app')?'empty':data.status;
    return {source:'public_updates',text:[
      selected==='app'||selected==='both'?'EcoVibes updates below come from versioned release records. No verified popularity ranking or live activity counts are available.':'',
      newsStatus==='unavailable'?'I could not check current news. Please try again later.':newsStatus==='empty'?'No recent headlines from the selected publishers were found in this news index.':newsStatus==='available'?'Publisher headlines below were indexed by GDELT within the last 36 hours. Indexed time is not publication time or independent fact-checking; this is not a popularity ranking.':'',
      data?`News index last checked: ${data.checkedAt} (UTC).`:'',
    ].filter(Boolean).join('\n\n'),entries,newsStatus,checkedAt:data?.checkedAt||null,asOf:new Date(clock()).toISOString(),items:[],guides:[],drafts:[],diagnostics:[],usage:{inputTokens:0,outputTokens:0,requests:0,latencyMs:0}};
  };
}
