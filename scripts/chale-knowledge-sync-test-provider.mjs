// Isolated test transport only. This file never loads in the application runtime.
import './chale-test-provider.mjs';
import {appendFileSync,readFileSync} from 'node:fs';
if(!process.env.CHALE_SYNC_FIXTURE)throw Error('An isolated public-source fixture is required.');
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
 const url=String(input);
 if(url.startsWith('https://www.wikidata.org/')){
  if(url!=='https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q117&props=info%7Clabels%7Cdescriptions&languages=en%7Ctw&format=json&formatversion=2&maxlag=5')throw Error('Unexpected source request.');
  appendFileSync(process.env.CHALE_SYNC_FIXTURE+'.calls','public-source\n',{mode:0o600});
  const fixture=JSON.parse(readFileSync(process.env.CHALE_SYNC_FIXTURE,'utf8'));
  if(fixture.busy)return Response.json({error:'PRIVATE_UPSTREAM_SENTINEL'},{status:429,headers:{'Retry-After':'3600'}});
  return Response.json({entities:{Q117:{id:'Q117',lastrevid:fixture.revision,labels:{en:{language:'en',value:'Ghana'}},descriptions:{en:{language:'en',value:fixture.description}},claims:{private:'PRIVATE_FIELD_SENTINEL'}}}});
 }
 return originalFetch(input,options);
};
