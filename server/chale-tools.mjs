import {APP_GUIDE_VERSION,CHALE_DESTINATIONS} from './chale-guide.mjs';
function stringSchema(description, maxLength) {
  return { type: 'string', description, minLength: 1, maxLength };
}

function functionTool(name, description, properties = {}) {
  return {
    type: 'function', name, description, strict: true,
    parameters: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
  };
}

const modelTools = [
  functionTool('search_ecovibes_catalog', 'Search public active EcoVibes products and open Quick&Handi jobs. One lookup per reply. This tool does not search private data or live grants.', {
    query: stringSchema('Concise search phrase preserving item, skill, location and budget constraints.', 120),
  }),
  functionTool('search_app_guide', 'Find verified app sections, exact navigation steps and implemented/preview/provider limitations in the versioned EcoVibes guide.', {
    query: stringSchema('The app task, question or problem to look up.', 120),
  }),
  functionTool('get_my_context', 'Get the current page, data mode and safe server-derived sign-in, preferred language and opt-in learning flags. No private profile or identity is returned.'),
  functionTool('diagnose_ecovibes_issue', 'Check an EcoVibes problem against verified app guidance and safe configuration flags. Does not access private records, test live service health, change settings or repair anything automatically.', {
    symptom: stringSchema('Brief description of the app symptom. Do not include private identifiers, passwords or payment information.', 120),
  }),
  functionTool('draft_support_request', 'Prepare a local support draft for the user to review. Does not submit a report or send anything.', {
    title: stringSchema('Short description of the problem without credentials or private identifiers.', 100),
    detail: stringSchema('Useful symptoms, what was tried and the desired outcome. Exclude credentials and sensitive account information.', 1000),
  }),
  functionTool('propose_improvement', 'Prepare a local improvement idea with a small experiment and risk for user review. Does not publish or implement it.', {
    title: stringSchema('Short improvement title.', 100),
    problem: stringSchema('The observed problem; label any assumption.', 500),
    benefit: stringSchema('A plausible community or user benefit, without a guarantee.', 500),
    experiment: stringSchema('A small affordable test and an observable measure of success.', 500),
    risk: stringSchema('A practical risk and how to limit it.', 500),
  }),
];

const text=(maxLength,minLength=0)=>({type:'string',minLength,maxLength});
const list=(items,maxItems)=>({type:'array',items,maxItems});
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const choice=values=>({type:'string',enum:values});
const exact=value=>choice([value]);
const guide=object({id:text(80,1),title:text(180,1),destination:choice(CHALE_DESTINATIONS),availability:choice(['implemented','preview','provider_required']),summary:text(1500,1),steps:list(text(600,1),8),keywords:list(text(120,1),40)});
const listing=object({id:text(64),kind:choice(['product','job']),title:text(140),detail:text(280),category:text(80),actor_eco_id:text(48),price:text(48),area:text(100),destination:choice(['Marketplace','Quick&Handi'])});
const context=object({currentPage:choice(CHALE_DESTINATIONS),dataMode:choice(['standard','saver','extreme']),signedIn:{type:'boolean'},learningEnabled:{type:'boolean'},preferredLanguage:text(24,1)});
const draftBase={id:text(64,1),status:exact('draft'),notice:exact('Local review draft only. Nothing has been submitted, sent or implemented.')};
const diagnostic=object({id:text(100,1),title:text(180,1),summary:text(2000,1),checks:list(object({label:text(180,1),status:choice(['ready','needs_setup','unknown']),detail:text(2000,1)}),4),guideIds:list(text(80,1),3),destination:choice(CHALE_DESTINATIONS),category:choice(['unknown','dispute','learning','login','network','provider','navigation']),outcome:exact('guidance_only'),guideVersion:exact(APP_GUIDE_VERSION)});
const contracts={
 search_ecovibes_catalog:{pillar:['marketplace','services'],dataScope:'public_active_catalog',requiredPermissions:['public_catalog:read'],risk:'read_only',confirmation:'none_for_read',outputSchema:object({query:text(120,1),listings:list(listing,8)})},
 search_app_guide:{pillar:['platform'],dataScope:'versioned_public_guide',requiredPermissions:['public_guide:read'],risk:'read_only',confirmation:'none_for_read',outputSchema:object({guideVersion:exact(APP_GUIDE_VERSION),guides:list(guide,3)})},
 get_my_context:{pillar:['identity','platform'],dataScope:'allowlisted_server_flags',requiredPermissions:['safe_context:read'],risk:'read_only',confirmation:'none_for_read',outputSchema:object({context,guideVersion:exact(APP_GUIDE_VERSION)})},
 diagnose_ecovibes_issue:{pillar:['platform'],dataScope:'public_guide_and_configuration_booleans',requiredPermissions:['public_guide:read','safe_configuration:read'],risk:'read_only',confirmation:'none_for_read',outputSchema:object({diagnostic,guideVersion:exact(APP_GUIDE_VERSION)})},
 draft_support_request:{pillar:['support'],dataScope:'local_unsent_draft',requiredPermissions:['local_draft:prepare'],risk:'local_draft',confirmation:'separate_actual_form_submission_required',outputSchema:object({draft:object({...draftBase,kind:exact('support'),title:text(100,1),detail:text(1000,1),destination:exact('EcoVibes ID')})})},
 propose_improvement:{pillar:['platform'],dataScope:'local_unsent_draft',requiredPermissions:['local_draft:prepare'],risk:'local_draft',confirmation:'separate_actual_action_required',outputSchema:object({draft:object({...draftBase,kind:exact('improvement'),title:text(100,1),problem:text(500,1),benefit:text(500,1),experiment:text(500,1),risk:text(500,1),destination:exact('Home')})})}
};
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export const CHALE_TOOL_REGISTRY_VERSION='2026-11-07-public-tools-v1';
export const CHALE_TOOL_REGISTRY=freeze(modelTools.map(model=>({id:model.name,purpose:model.description,inputSchema:model.parameters,outputSchema:contracts[model.name].outputSchema,pillar:contracts[model.name].pillar,requiredPermissions:contracts[model.name].requiredPermissions,dataScope:contracts[model.name].dataScope,risk:contracts[model.name].risk,confirmation:contracts[model.name].confirmation,authorization:'server_allowlisted_public_or_local_draft_only',timeoutMs:5000,audit:{fields:['toolId','outcome','durationMs','registryVersion'],content:'omit'},model})));
export const CHALE_TOOLS=Object.freeze(CHALE_TOOL_REGISTRY.map(entry=>entry.model));
const byId=new Map(CHALE_TOOL_REGISTRY.map(entry=>[entry.id,entry]));
export const getChaleToolContract=name=>byId.get(name)||null;
// Deliberately small schema subset: no dynamic schemas, references or external validators.
function conforms(value,schema){
 if(schema.type==='string')return typeof value==='string'&&(schema.minLength===undefined||value.length>=schema.minLength)&&(schema.maxLength===undefined||value.length<=schema.maxLength)&&(!schema.enum||schema.enum.includes(value));
 if(schema.type==='boolean')return typeof value==='boolean';
 if(schema.type==='array')return Array.isArray(value)&&value.length<=schema.maxItems&&value.every(item=>conforms(item,schema.items));
 if(schema.type==='object')return value!==null&&typeof value==='object'&&!Array.isArray(value)&&schema.required.every(key=>Object.hasOwn(value,key))&&Object.keys(value).every(key=>Object.hasOwn(schema.properties,key)&&conforms(value[key],schema.properties[key]));
 return false;
}
export function parseChaleToolArguments(call){
 const tool=byId.get(call?.name);if(!tool)return {error:'unknown_tool'};
 let args;try{const raw=call.arguments??'{}';if(typeof raw!=='string'||Buffer.byteLength(raw)>8192)return {error:'invalid_arguments'};args=JSON.parse(raw);}catch{return {error:'invalid_arguments'};}
 if(!conforms(args,tool.inputSchema))return {error:'invalid_arguments'};
 const clean={};for(const key of tool.inputSchema.required){const value=args[key].replace(/[\u0000-\u001f\u007f]/g,' ').trim();if(!value)return {error:'invalid_arguments'};clean[key]=value;}
 return {args:clean};
}
export class ChaleToolError extends Error{
 constructor(code){super('The approved Chale tool did not complete.');this.name='ChaleToolError';this.code=code;}
}
// The registry grants no role/account authority. Only these existing public/local
// policies are admitted; future private or consequential tools need a new reviewed
// authorizer/confirmation/transaction design, not a caller-supplied permission list.
export async function runChaleTool(name,args,handler,{signal,onAudit}={}){
 const entry=byId.get(name),start=performance.now();let outcome='failed',timer,abortListener,relay;
 const controller=new AbortController();
 try{
  if(!entry)throw new ChaleToolError('unknown_tool');
  const parsed=parseChaleToolArguments({name,arguments:JSON.stringify(args)});
  if(parsed.error)throw new ChaleToolError(parsed.error);
  if(!['read_only','local_draft'].includes(entry.risk)||entry.authorization!=='server_allowlisted_public_or_local_draft_only')throw new ChaleToolError('tool_not_authorized');
  signal?.throwIfAborted();
  relay=()=>controller.abort(signal.reason);signal?.addEventListener('abort',relay,{once:true});
  const stopped=new Promise((_,reject)=>{abortListener=()=>reject(controller.signal.reason);controller.signal.addEventListener('abort',abortListener,{once:true});});
  timer=setTimeout(()=>controller.abort(new ChaleToolError('tool_timeout')),entry.timeoutMs);
  const work=Promise.resolve().then(()=>{controller.signal.throwIfAborted();return handler(parsed.args,controller.signal);});
  const result=await Promise.race([work,stopped]);controller.signal.throwIfAborted();
  let encoded;try{encoded=JSON.stringify(result);}catch{throw new ChaleToolError('tool_output_invalid');}
  if(typeof encoded!=='string'||Buffer.byteLength(encoded)>32768||!conforms(result,entry.outputSchema))throw new ChaleToolError('tool_output_invalid');
  outcome='completed';return result;
 }catch(error){
  if(signal?.aborted){outcome='cancelled';throw signal.reason;}
  if(error instanceof ChaleToolError){outcome=error.code==='tool_timeout'?'timeout':error.code==='tool_output_invalid'?'invalid_output':'rejected';throw error;}
  throw new ChaleToolError('tool_unavailable');
 }finally{
  clearTimeout(timer);if(relay)signal?.removeEventListener('abort',relay);if(abortListener)controller.signal.removeEventListener('abort',abortListener);
  try{onAudit?.({toolId:entry?.id||'unsupported',outcome,durationMs:Math.max(0,Math.round(performance.now()-start)),registryVersion:CHALE_TOOL_REGISTRY_VERSION});}catch{/* Read-only best-effort operational telemetry cannot authorize or change a result. */}
 }
}
