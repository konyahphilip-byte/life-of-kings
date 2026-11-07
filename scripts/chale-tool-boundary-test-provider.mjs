// Test-only transport/reader faults. Never import this in an application runtime.
import './chale-test-provider.mjs';
import {appendFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
if(!process.env.CHALE_TOOL_FIXTURE)throw Error('Isolated tool-boundary capture is required.');
const capture=value=>appendFileSync(process.env.CHALE_TOOL_FIXTURE,JSON.stringify(value)+'\n',{mode:0o600});
const prepare=DatabaseSync.prototype.prepare;
DatabaseSync.prototype.prepare=function(sql){const statement=prepare.call(this,sql);return new Proxy(statement,{get(target,key){if(key==='all')return (...params)=>{if(sql.includes('FROM products p JOIN users u ON u.id=p.seller_id')){const marker=params.find(p=>p==='%stallboundary%'||p==='%cancelboundary%');if(marker){capture({kind:'reader',marker});return new Promise(()=>{});}}return target.all(...params);};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});};
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
 if(String(input)!=='https://api.openai.com/v1/responses')return originalFetch(input,options);
 const body=JSON.parse(options.body),marker=body.input.filter(i=>i.role==='user').at(-1)?.content;
 if(!['TOOL_TIMEOUT_HTTP','TOOL_CANCEL_HTTP','TOOL_PRIVATE_HTTP'].includes(marker))return originalFetch(input,options);
 const results=body.input.filter(i=>i.type==='function_call_output');
 if(!results.length)return Response.json({status:'completed',output:[{type:'function_call',name:marker==='TOOL_PRIVATE_HTTP'?'confirm_sale':'search_ecovibes_catalog',arguments:JSON.stringify(marker==='TOOL_PRIVATE_HTTP'?{businessId:'PRIVATE_ID',userId:'other',amount:450}:{query:marker==='TOOL_TIMEOUT_HTTP'?'stallboundary':'cancelboundary'}),call_id:'synthetic-tool-call'}]});
 capture({kind:'tool-result',marker,result:JSON.parse(results[0].output)});
 return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'The tool was not completed. No action or transaction is confirmed.'}]}]});
};
