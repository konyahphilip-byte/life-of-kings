import {emptyVault,normalizeVault} from './game-vault.mjs';
import {assertPortableSourcePaths} from './game-source-paths.mjs';
const coverage='Godot 4 config_version=5 and text scene/resource format=3 reference subset; not a GDScript compiler, engine import, security scan or playable-build test.';
const fixes={
 'missing-project':['error','Root project.godot is missing.','Select the folder that contains project.godot, keeping it at the project root.'],
 'invalid-project':['error','The source draft does not fit the existing Vault rules.','Check source paths, file sizes and the project format before inspecting again.'],
 'malformed-text':['error','A quote, bracket or statement is unfinished or mismatched.','Review this line and its surrounding lines in your local editor.'],
 'unsupported-format':['warning','This Godot file version is outside the supported inspector format.','Use Godot 4 config_version=5 and text scenes/resources with format=3, or inspect manually in an isolated editor.'],
 'invalid-resource':['error','The text scene or resource structure is incomplete.','Check its header, required root node/resource section and property assignments in the original editor.'],
 'unsupported-syntax':['warning','This syntax is outside the supported static checks.','Review it manually. No engine or script compiler has checked this file.'],
 'missing-source':['error','A referenced source file is not in this project.','Add the original source at the referenced path, or repair the reference manually.'],
 'missing-asset':['warning','A referenced binary asset is absent from this text-only Vault.','Keep the original image, model, sound or font and restore it locally. No binary asset was imported.'],
 'unsafe-reference':['error','This reference points outside the supported project paths.','Use a project-local res:// path without escaping the project root. External URLs and user:// paths are not read.'],
 'case-conflict':['error','The reference and source path use different capitalization.','Compare the exact filename and reference in your editor; nothing is renamed automatically.'],
 'uid-unresolved':['warning','A UID-only reference cannot be resolved from these text files.','Keep the original .uid/import metadata or replace it manually with a verified res:// path.'],
 'uid-conflict':['error','The same resource UID names different source paths.','Check the original resource identities in Godot; do not guess or silently replace them.'],
 'duplicate-resource-id':['error','Two declarations reuse the same local resource ID.','Assign distinct IDs in the original scene/resource and update its references.'],
 'undefined-resource-id':['error','An ExtResource or SubResource ID has no matching declaration.','Restore the declaration or correct the local ID manually.'],
 'resource-kind':['error','A declared resource type conflicts with its referenced file.','Check Script, PackedScene and source-resource file types before changing the reference.'],
 'duplicate-setting':['error','A setting or attribute is declared more than once.','Compare the duplicate declarations and choose the intended value manually.'],
 'unsupported-language':['warning','This project requires a language runtime outside this text-source inspector.','Keep its C# or other language project and verify it separately; no compilation occurs here.'],
 'native-extension':['warning','This project references a native extension.','Keep the original licensed extension/configuration; no binary is loaded or executed here.'],
 'plugin-required':['warning','This project enables an editor plugin.','Keep its original plugin.cfg and licensed dependencies. This inspector never installs or runs plugins.'],
 'tool-script':['warning','This script requests editor execution with @tool.','Review it before opening in an isolated editor. This inspector does not run it.'],
 'dynamic-reference':['warning','A dependency is constructed at runtime or uses an unsupported loader expression.','Check the possible paths manually; the inspector will not evaluate the expression.'],
 'relative-script-reference':['warning','A script reference needs an explicit project path for this inspector.','Use a verified res:// path when appropriate; relative script-loader behavior is not guessed.'],
 'dependency-cycle':['warning','The dependency graph contains a cycle.','Inspect the linked files manually; some cycles are invalid and none were executed here.'],
 'inspection-limit':['warning','The inspector reached its bounded parsing or reference limit.','Inspect a smaller source set or review the remaining references manually.'],
 'missing-main-scene':['warning','No supported startup scene was found in the project settings.','Set the intended main scene in your local Godot project if this project is meant to run.'],
 'asset-import-unverified':['warning','Asset source is present, but native asset import was not tested.','Verify the original asset and its importer in an isolated local editor.']
};
const abort=signal=>{if(signal?.aborted)throw Error('Godot source inspection cancelled.');};
function lex(content,script,emit){
 const out=[],stack=[];let i=content.charCodeAt(0)===0xfeff?1:0,line=1;
 const push=(kind,value,at=line)=>{if(out.length>=20000){emit('inspection-limit',line);throw Error('bounded');}out.push({kind,value,line:at});};
 while(i<content.length){
  const c=content[i];if(c==='\r'){i++;continue;}if(c==='\n'){push('nl','\n');line++;i++;continue;}if(/\s/.test(c)){i++;continue;}
  if((script&&c==='#')||(!script&&c===';')){while(i<content.length&&content[i]!=='\n')i++;continue;}
  if(c==='"'||c==="'"){
   const at=line,quote=c,triple=script&&content.slice(i,i+3)===c.repeat(3);i+=triple?3:1;let value='',closed=false;
   while(i<content.length){
    if(content.slice(i,i+(triple?3:1))===quote.repeat(triple?3:1)){i+=triple?3:1;closed=true;break;}
    let ch=content[i++];if(ch==='\n'){if(!triple){emit('malformed-text',at);throw Error('quote');}line++;}
    if(ch==='\\'){const esc=content[i++],map={n:'\n',r:'\r',t:'\t',b:'\b',f:'\f','"':'"',"'":"'",'\\':'\\','/':'/'};if(esc in map)ch=map[esc];else if(esc==='u'&&/^[0-9a-f]{4}$/i.test(content.slice(i,i+4))){ch=String.fromCharCode(parseInt(content.slice(i,i+4),16));i+=4;}else{emit('unsupported-syntax',at);throw Error('escape');}}
    value+=ch;
   }
   if(!closed){emit('malformed-text',at);throw Error('quote');}push('str',value,at);continue;
  }
  if(/[A-Za-z_]/.test(c)){const start=i++;while(i<content.length&&/[A-Za-z0-9_]/.test(content[i]))i++;push('id',content.slice(start,i));continue;}
  if(/[0-9]/.test(c)||((c==='-'||c==='+')&&/[0-9]/.test(content[i+1]))){const start=i++;while(i<content.length&&/[0-9.eE+-]/.test(content[i]))i++;push('num',content.slice(start,i));continue;}
  if('([{'.includes(c))stack.push(c);
  if(')]}'.includes(c)&&stack.pop()!=={')':'(',']':'[','}':'{'}[c]){emit('malformed-text',line);throw Error('bracket');}
  push('sym',c);i++;
 }
 if(stack.length){emit('malformed-text',line);throw Error('bracket');}return out;
}
function statements(tokens){const rows=[];let row=[],depth=0;for(const t of tokens){if(t.kind==='nl'&&depth===0){if(row.length)rows.push(row);row=[];continue;}if(t.kind==='nl')continue;row.push(t);if('([{'.includes(t.value)&&t.kind==='sym')depth++;if(')]}'.includes(t.value)&&t.kind==='sym')depth--;}if(row.length)rows.push(row);return rows;}
function kind(path){return path==='project.godot'?'project':path.endsWith('.tscn')?'scene':path.endsWith('.tres')?'resource':path.endsWith('.gd')?'script':'other';}
export async function inspectGodotProject(input,{signal,yieldControl=()=>new Promise(r=>setTimeout(r,0))}={}){
 abort(signal);const report={schema:'ecogames-godot-preflight-v1',root:null,engineExecuted:false,coverage,status:'static-checked',nodes:[],edges:[],issues:[]};
 const emit=(code,file=null,line=1,target)=>{if(report.issues.length>=200){if(!report.issues.some(i=>i.code==='inspection-limit'))report.issues.push({code:'inspection-limit',severity:'warning',file:null,line:1,message:fixes['inspection-limit'][1],repair:fixes['inspection-limit'][2]});return;}const [severity,message,repair]=fixes[code];report.issues.push({code,severity,file,line,message,repair,...(target!==undefined?{target}:{} )});};
 let project;try{project=normalizeVault({...emptyVault(),projects:[input]}).projects[0];assertPortableSourcePaths(project.files.map(f=>f.path));}catch{emit('invalid-project');return {...report,status:'needs-repair'};}
 report.nodes=project.files.map(f=>({path:f.path,kind:kind(f.path)}));
 if(project.files.some(f=>f.path==='project.godot'))report.root='project.godot';else emit('missing-project');
 const context={report,project,emit};
 for(const file of project.files){abort(signal);await yieldControl();abort(signal);if(kind(file.path)==='other')continue;try{const tokens=lex(file.content,kind(file.path)==='script',(code,line)=>emit(code,file.path,line));inspectFile(context,file,tokens);}catch(e){if(!['bounded','quote','escape','bracket'].includes(e.message))throw e;}}
 finishGraph(context);
 report.status=report.issues.some(i=>i.severity==='error')?'needs-repair':report.issues.length?'limited':'static-checked';return report;
}

function addReference(c,from,raw,kind,line,type){
 if(c.report.edges.length>=200){if(!c.report.issues.some(i=>i.code==='inspection-limit'))c.emit('inspection-limit',from,line);return;}
 let target=raw,status='present';const issue=code=>c.emit(code,from,line,raw.slice(0,200));
 if(raw.startsWith('uid://')){status='unsupported';issue('uid-unresolved');}
 else if(kind==='plugin'){status='unsupported';}
 else if(raw.endsWith('.gdextension')){status='unsupported';issue('native-extension');}
 else if(!raw.startsWith('res://')&&['load','preload','load_threaded_request','load_threaded_get','extends','icon'].includes(kind)&&!raw.includes('://')&&!raw.startsWith('/')){status='unsupported';issue('relative-script-reference');}
 else{
  let parts=raw.startsWith('res://')?[]:from.split('/').slice(0,-1),bad=false;
  if(raw.startsWith('/')||raw.includes('\\')||/^(?!res:\/\/)[a-z]+:/i.test(raw))bad=true;
  for(const segment of (raw.startsWith('res://')?raw.slice(6):raw).split('/')){if(segment==='.')continue;if(segment==='..'){if(!parts.length)bad=true;else parts.pop();}else if(!segment)bad=true;else parts.push(segment);}
  target=parts.join('/');try{assertPortableSourcePaths([target]);}catch{bad=true;}
  if(bad){status='invalid';issue('unsafe-reference');}
  else if(!c.project.files.some(f=>f.path===target)){
   if(c.project.files.some(f=>f.path.toLowerCase()===target.toLowerCase())){status='case-conflict';issue('case-conflict');}
   else if(/\.(png|jpe?g|webp|gif|bmp|glb|gltf|fbx|obj|ogg|wav|mp3|ttf|otf|woff2?|scn|res|pck|dll|so|dylib)$/i.test(target)){status='missing-asset';issue('missing-asset');}
   else{status='missing-source';issue('missing-source');}
  }
  if(status==='present'&&type&&((type==='Script'&&!target.endsWith('.gd'))||(type==='PackedScene'&&!target.endsWith('.tscn')))){issue('resource-kind');status='invalid';}
  if(status==='present'&&!/\.(gd|tscn|tres|godot)$/i.test(target))issue('asset-import-unverified');
 }
 c.report.edges.push({from,target:target.slice(0,200),kind,line,status});
 return target;
}
function attrs(tokens,emit){
 const map=new Map();let i=2;
 while(i<tokens.length-1){const key=tokens[i++];if(key?.kind!=='id'||tokens[i++]?.value!=='='){emit('invalid-resource',key?.line??1);break;}
  const start=i;let depth=0;
  while(i<tokens.length-1){const t=tokens[i];if(depth===0&&i>start&&t.kind==='id'&&tokens[i+1]?.value==='=')break;if(t.kind==='sym'&&'([{'.includes(t.value))depth++;if(t.kind==='sym'&&')]}'.includes(t.value))depth--;i++;}
  if(map.has(key.value))emit('duplicate-setting',key.line);map.set(key.value,tokens.slice(start,i));
 }
 return map;
}
const scalar=t=>t?.length===1? t[0].value:undefined;
function registerUID(c,tokens,target,file,line){
 if(tokens===undefined)return;
 if(tokens.length!==1||tokens[0].kind!=='str'||!/^uid:\/\/[a-z0-9]+$/.test(tokens[0].value)){c.emit('invalid-resource',file,line);return;}
 c.uids??=new Map();const uid=tokens[0].value;if(c.uids.has(uid)&&c.uids.get(uid)!==target)c.emit('uid-conflict',file,line);c.uids.set(uid,target);
}
function inspectFile(c,file,tokens){
 const emit=(code,line=1)=>c.emit(code,file.path,line),rows=statements(tokens),k=kind(file.path);
 if(k==='script'){inspectScript(c,file,tokens);return;}
 if(k==='project'){
  let section='',version,main=false;const seen=new Set();
  for(const row of rows){
   if(row[0].value==='['){if(row.length!==3||row[1].kind!=='id'){emit('unsupported-syntax',row[0].line);continue;}section=row[1].value;continue;}
   const eq=row.findIndex(t=>t.value==='=');if(eq<1){emit('malformed-text',row[0].line);continue;}
   const key=row.slice(0,eq).map(t=>t.value).join(''),value=row.slice(eq+1),full=section+'/'+key;validateValue(value,emit);
   if(seen.has(full))emit('duplicate-setting',row[0].line);seen.add(full);
   if(!section&&key==='config_version')version=value.length===1&&value[0].kind==='num'?value[0].value:undefined;
   if(full==='application/config/features'&&value.some(t=>t.kind==='str'&&t.value==='C#'))emit('unsupported-language',row[0].line);
   if(full==='editor_plugins/enabled'){if(value.some(t=>t.kind==='str')){emit('plugin-required',row[0].line);for(const t of value.filter(t=>t.kind==='str'))addReference(c,file.path,t.value,'plugin',t.line);}else if(value.map(t=>t.value).join('')!=='PackedStringArray()')emit('unsupported-syntax',row[0].line);}
   if(full==='application/run/main_scene'){main=true;if(value.length!==1||value[0].kind!=='str')emit('unsupported-syntax',row[0].line);else addReference(c,file.path,value[0].value,'main',row[0].line,'PackedScene');}
   else if(section==='autoload'){if(value.length!==1||value[0].kind!=='str')emit('unsupported-syntax',row[0].line);else addReference(c,file.path,value[0].value.replace(/^\*/,''),'autoload',row[0].line);}
   else for(const t of value.filter(t=>t.kind==='str'&&/^(res|uid):\/\//.test(t.value)))if(section!=='editor_plugins')addReference(c,file.path,t.value,'setting',t.line);
  }
  if(version!=='5')emit('unsupported-format');if(!main)emit('missing-main-scene');return;
 }
 const first=rows[0],tag=k==='scene'?'gd_scene':'gd_resource';
 if(first?.[0]?.value!=='['||first[1]?.value!==tag){emit('invalid-resource');return;}
 const header=attrs(first,emit);registerUID(c,header.get('uid'),file.path,file.path,first[0].line);
 if(scalar(header.get('format'))!=='3'||header.get('format')?.[0]?.kind!=='num'){emit('unsupported-format');return;}
 if(k==='resource'&&(!scalar(header.get('type'))||header.get('type')?.[0]?.kind!=='str'))emit('invalid-resource',first[0].line);
 const ext=new Set(),sub=new Set(),used=[],keys=new Set();let nodeCount=0,resourceCount=0,section=0;
 for(const row of rows.slice(1)){
  if(row[0].value==='['){
   section++;const name=row[1]?.value,a=attrs(row,emit);
   if(name==='ext_resource'||name==='sub_resource'){
    const id=scalar(a.get('id')),type=scalar(a.get('type')),set=name==='ext_resource'?ext:sub;
    if(typeof id!=='string'||!id||!type||a.get('id')?.[0]?.kind!=='str'||a.get('type')?.[0]?.kind!=='str')emit('invalid-resource',row[0].line);else{if(set.has(id))emit('duplicate-resource-id',row[0].line);set.add(id);}
    if(name==='ext_resource'){
     const path=scalar(a.get('path'));if(typeof path!=='string'||a.get('path')[0].kind!=='str')emit('invalid-resource',row[0].line);
     else{const target=addReference(c,file.path,path,'external',row[0].line,type);registerUID(c,a.get('uid'),target,file.path,row[0].line);}
    }
   }else if(name==='node'){if(!nodeCount&&a.has('parent'))emit('invalid-resource',row[0].line);nodeCount++;if(!scalar(a.get('name'))||a.get('name')?.[0]?.kind!=='str'||(a.has('type')&&a.get('type')?.[0]?.kind!=='str'))emit('invalid-resource',row[0].line);}
   else if(name==='resource')resourceCount++;else if(!['connection','editable'].includes(name))emit('unsupported-syntax',row[0].line);
  }else{
   const eq=row.findIndex(t=>t.value==='=');if(eq<1){emit('invalid-resource',row[0].line);continue;}const key=section+':'+row.slice(0,eq).map(t=>t.value).join('');if(keys.has(key))emit('duplicate-setting',row[0].line);keys.add(key);validateValue(row.slice(eq+1),emit);
  }
  for(let i=0;i<row.length;i++)if(row[i].kind==='id'&&['ExtResource','SubResource'].includes(row[i].value)){
   if(row[i+1]?.value!=='('||row[i+2]?.kind!=='str'||row[i+3]?.value!==')')emit('invalid-resource',row[i].line);
   else used.push({set:row[i].value==='ExtResource'?ext:sub,id:row[i+2].value,line:row[i].line});
  }
 }
 for(const u of used)if(!u.set.has(u.id))emit('undefined-resource-id',u.line);
 if((k==='scene'&&!nodeCount)||(k==='resource'&&resourceCount!==1))emit('invalid-resource');
}

const variants=new Set(['Vector2','Vector2i','Vector3','Vector3i','Vector4','Vector4i','Rect2','Rect2i','Transform2D','Transform3D','Projection','Plane','Quaternion','AABB','Basis','Color','NodePath','StringName','RID','Callable','Signal','Array','Dictionary','PackedByteArray','PackedInt32Array','PackedInt64Array','PackedFloat32Array','PackedFloat64Array','PackedStringArray','PackedVector2Array','PackedVector3Array','PackedColorArray','PackedVector4Array','ExtResource','SubResource']);
function validateValue(tokens,emit){
 let failed=false;
 function value(i,depth=0){
  if(depth>64){emit('inspection-limit',tokens[i]?.line??1);failed=true;return tokens.length;}
  const t=tokens[i];if(!t){failed=true;return i;}
  if(t.kind==='str'||['true','false','null'].includes(t.value))return i+1;
  if(t.kind==='num'){if(!/^[+-]?(?:\d+(?:\.\d*)?)(?:[eE][+-]?\d+)?$/.test(t.value)){emit('malformed-text',t.line);failed=true;}return i+1;}
  if(['&','^'].includes(t.value)&&tokens[i+1]?.kind==='str')return i+2;
  let close;
  if(t.value==='[')close=']';else if(t.value==='{')close='}';
  else if(t.kind==='id'&&tokens[i+1]?.value==='('){if(!variants.has(t.value))emit('unsupported-syntax',t.line);i++;close=')';}
  else{emit('unsupported-syntax',t.line);failed=true;return tokens.length;}
  i++;if(tokens[i]?.value===close)return i+1;
  while(i<tokens.length){i=value(i,depth+1);if(close==='}'&&tokens[i]?.value===':')i=value(i+1,depth+1);else if(close==='}'){failed=true;break;}if(tokens[i]?.value===close)return i+1;if(tokens[i]?.value!==','){failed=true;break;}i++;if(tokens[i]?.value===close)return i+1;}
  failed=true;return i;
 }
 const end=value(0);if(failed||end!==tokens.length)emit('invalid-resource',tokens[0]?.line??1);
}
function inspectScript(c,file,all){
 const tokens=all.filter(t=>t.kind!=='nl'),emit=(code,line=1)=>c.emit(code,file.path,line);
 const nativeBases=new Set(['Node','Node2D','Node3D','Control','Resource','RefCounted','Object','CanvasLayer','CharacterBody2D','CharacterBody3D','RigidBody2D','RigidBody3D','StaticBody2D','StaticBody3D','Area2D','Area3D','MeshInstance3D','Sprite2D','Camera2D','Camera3D','EditorPlugin']);
 for(let i=0;i<tokens.length;i++){
  const t=tokens[i];if(t.kind!=='id')continue;
  if(t.value==='tool'&&tokens[i-1]?.value==='@')emit('tool-script',t.line);
  if(t.value==='extends'){
   if(tokens[i+1]?.kind==='str')addReference(c,file.path,tokens[i+1].value,'extends',t.line,'Script');
   else if(!nativeBases.has(tokens[i+1]?.value))emit('unsupported-syntax',t.line);
  }
  const loader=['load','preload','load_threaded_request','load_threaded_get'].includes(t.value),icon=t.value==='icon'&&tokens[i-1]?.value==='@';
  if(tokens[i-1]?.value==='.'&&tokens[i-2]?.value==='ResourceLoader'&&!loader&&tokens[i+1]?.value==='(')emit('dynamic-reference',t.line);
  if((!loader&&!icon)||tokens[i+1]?.value!=='('||tokens[i-1]?.value==='func')continue;
  if(tokens[i-1]?.value==='.'&&tokens[i-2]?.value!=='ResourceLoader'){emit('dynamic-reference',t.line);continue;}
  if(tokens[i+2]?.kind!=='str'||tokens[i+3]?.value!==')'){emit('dynamic-reference',t.line);continue;}
  addReference(c,file.path,tokens[i+2].value,icon?'icon':t.value,t.line);
 }
}
function finishGraph(c){
 const graph=new Map(c.project.files.map(f=>[f.path,[]]));
 for(const e of c.report.edges)if(e.status==='present')graph.get(e.from)?.push(e.target);
 const visited=new Set(),active=new Set();let found=false;
 function visit(p){if(active.has(p)){found=true;return;}if(visited.has(p))return;visited.add(p);active.add(p);for(const q of graph.get(p)??[])visit(q);active.delete(p);}
 for(const path of graph.keys())visit(path);
 if(found)c.emit('dependency-cycle');
}



export function summarizeGodotPreflight(report){return {schema:'godot-preflight-summary-v1',engineExecuted:false,files:Math.min(20,report.nodes.length),references:Math.min(200,report.edges.length),issueCodes:[...new Set(report.issues.map(i=>i.code).filter(c=>Object.hasOwn(fixes,c)))].sort()};}
