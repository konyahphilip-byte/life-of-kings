import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
const MAX=14*1024*1024;
const fail=(status,code,message)=>Object.assign(Error(message),{status,code});
export async function boundedBytes(response,max=MAX){
 const length=response.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>max))throw fail(413,'media_too_large','Media exceeds the permitted size.');
 if(!response.body)return Buffer.alloc(0);const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>max)throw fail(413,'media_too_large','Media exceeds the permitted size.');chunks.push(part.value);}return Buffer.concat(chunks,size);}catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
}
export function imageSignature(bytes,mime){return mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==='image/webp'?bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP':false;}
export function createMediaStorage({config,isProduction,localRoot,fetchImpl=(...args)=>fetch(...args)}){
 const safeId=id=>{if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(id))throw fail(400,'invalid_media_id','Choose a valid media record.');};
 function current(){const c=config();if(!c&&isProduction)throw fail(503,'media_storage_unavailable','Product photo storage is not available yet. Your draft is retained.');return c;}
 const objectUrl=(c,id)=>c.root+'/object/'+encodeURIComponent(c.bucket)+'/'+encodeURIComponent(id);
 const headers=c=>({Authorization:'Bearer '+c.key,apikey:c.key});
 async function read(id){safeId(id);const c=current();if(!c)return readFile(resolve(localRoot,id));let r;try{r=await fetchImpl(objectUrl(c,id),{redirect:'error',signal:AbortSignal.timeout(8000),headers:headers(c)});if(!r.ok)throw Error();return await boundedBytes(r);}catch{throw fail(502,'media_read_unconfirmed','The product photo could not be retrieved.');}}
 async function put(id,bytes,mime){
  safeId(id);if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>MAX)throw fail(413,'media_too_large','Choose media no larger than 14 MB.');const c=current();
  if(!c){await mkdir(localRoot,{recursive:true});try{await writeFile(resolve(localRoot,id),bytes,{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST'||!(await read(id)).equals(bytes))throw e;}return;}
  try{const r=await fetchImpl(objectUrl(c,id),{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{...headers(c),'Content-Type':mime,'x-upsert':'false'},body:bytes});if(r.ok)return;}catch{}
  // A lost response may follow a committed upload. Confirm bytes at the same key;
  // never blindly overwrite or use a new key to disguise an uncertain outcome.
  try{if((await read(id)).equals(bytes))return;}catch{}
  throw fail(502,'media_save_unconfirmed','The photo upload could not be confirmed. Retry the same review or keep the draft.');
 }
 async function remove(id){safeId(id);const c=current();if(!c){await unlink(resolve(localRoot,id)).catch(e=>{if(e.code!=='ENOENT')throw e;});return;}let r;try{r=await fetchImpl(objectUrl(c,id),{method:'DELETE',redirect:'error',signal:AbortSignal.timeout(8000),headers:headers(c)});}catch{throw fail(502,'media_delete_unconfirmed','Photo deletion could not be confirmed.');}if(!r.ok&&r.status!==404)throw fail(502,'media_delete_unconfirmed','Photo deletion could not be confirmed.');}
 return {put,read,remove};
}
