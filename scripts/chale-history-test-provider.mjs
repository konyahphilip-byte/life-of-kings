// Isolated synthetic transport only. The imported fixture blocks real provider traffic.
import './chale-test-provider.mjs';
import {writeFile,access} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
const fixtureFetch=globalThis.fetch;
globalThis.fetch=async(input,options={})=>{
 if(String(input)==='https://api.openai.com/v1/responses'&&JSON.parse(options.body).input?.some(item=>item.role==='user'&&item.content==='HISTORY_SESSION_HOLD')){
  if(!process.env.CHALE_HISTORY_HOLD_READY||!process.env.CHALE_HISTORY_HOLD_RELEASE)throw Error('Synthetic history hold paths are required.');
  await writeFile(process.env.CHALE_HISTORY_HOLD_READY,'ready',{mode:0o600});
  let ready=false;for(let i=0;i<400;i++){try{await access(process.env.CHALE_HISTORY_HOLD_RELEASE);ready=true;break;}catch{await delay(10);}}
  if(!ready)throw Error('Synthetic history hold was not released.');
 }
 return fixtureFetch(input,options);
};
