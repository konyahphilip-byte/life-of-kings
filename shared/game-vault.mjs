export const VAULT_BYTES=128000,FILE_BYTES=32768,BACKUP_BYTES=VAULT_BYTES+1024;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=message=>{throw new Error(message);};
const size=v=>new TextEncoder().encode(v).length;
function shape(v,keys){if(!object(v)||Object.keys(v).sort().join(',')!==[...keys].sort().join(','))fail('Unsupported project or backup fields.');}
function text(v,max,name,source=false){if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))fail('Check '+name+' text and size.');return source?v:v.trim();}
function id(v){if(typeof v!=='string'||!uuid.test(v))fail('A stable project or checkpoint ID is required.');return v.toLowerCase();}
function files(value){
 if(!Array.isArray(value)||value.length>20)fail('A project supports up to 20 text files.');
 const paths=new Set();
 return value.map(v=>{
  shape(v,['path','content']);const path=text(v.path,160,'file path');
  if(!path||path.startsWith('/')||!path.split('/').every(p=>/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(p))||!/\.(gd|godot|tscn|tres|ts|tsx|js|jsx|json|md|txt|html|css|glsl|shader|svg)$/i.test(path)||paths.has(path.toLowerCase()))fail('Use unique, relative source paths without hidden folders or traversal.');
  const key=path.toLowerCase();if([...paths].some(existing=>existing.startsWith(key+'/')||key.startsWith(existing+'/')))fail('A file cannot also be a directory.');paths.add(key);const content=text(v.content,FILE_BYTES,'source',true);if(size(content)>FILE_BYTES)fail('Each text file must fit within 32 KB.');
  return {path,content};
 }).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
function content(v){const title=text(v.title,100,'project title');if(!title)fail('Give the project a title.');if(!['godot','three','custom'].includes(v.engine))fail('Choose a supported project engine.');return {title,engine:v.engine,story:text(v.story,12000,'Story Bible',true),files:files(v.files)};}
export function emptyVault(){return {schema:'ecogames-vault-v1',projects:[]};}
export function newProject(title='Untitled project'){return {id:crypto.randomUUID(),title,engine:'godot',story:'',files:[],checkpoints:[]};}
export function normalizeVault(value){
 shape(value,['schema','projects']);if(value.schema!=='ecogames-vault-v1'||!Array.isArray(value.projects)||value.projects.length>5)fail('This pilot supports up to five projects.');
 const ids=new Set(),out=emptyVault();
 out.projects=value.projects.map(v=>{
  shape(v,['id','title','engine','story','files','checkpoints']);const projectId=id(v.id);if(ids.has(projectId))fail('Project IDs must be unique.');ids.add(projectId);
  if(!Array.isArray(v.checkpoints)||v.checkpoints.length>3)fail('Keep up to three checkpoints per project.');
  const checkpoints=new Set();
  return {id:projectId,...content(v),checkpoints:v.checkpoints.map(c=>{
   shape(c,['id','label','at','title','engine','story','files']);const cid=id(c.id);if(checkpoints.has(cid))fail('Checkpoint IDs must be unique.');checkpoints.add(cid);
   const label=text(c.label,80,'checkpoint label'),at=text(c.at,40,'checkpoint date');if(!label||!/^\d{4}-\d{2}-\d{2}T/.test(at)||!Number.isFinite(Date.parse(at)))fail('Check the checkpoint label and timestamp.');
   return {id:cid,label,at,...content(c)};
  })};
 }).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 if(size(JSON.stringify(out))>VAULT_BYTES)fail('Projects and checkpoints together must fit within 128 KB. Export or remove unneeded content first.');
 return out;
}
export async function vaultDigest(value){
 if(!globalThis.crypto?.subtle)fail('This browser cannot verify backup integrity. Nothing was imported.');
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(normalizeVault(value))));
 return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
}
export async function exportBackup(vault){const value=normalizeVault(vault);return JSON.stringify({schema:'ecogames-vault-backup-v1',sha256:await vaultDigest(value),vault:value});}
export async function readBackup(json){
 if(typeof json!=='string'||size(json)>BACKUP_BYTES)fail('Choose a Vault backup smaller than 129 KB.');
 let value;try{value=JSON.parse(json);}catch{fail('Choose a valid Vault JSON backup.');}shape(value,['schema','sha256','vault']);
 if(value.schema!=='ecogames-vault-backup-v1'||typeof value.sha256!=='string'||!/^[a-f0-9]{64}$/.test(value.sha256))fail('Choose a supported integrity-checked Vault backup.');
 const vault=normalizeVault(value.vault);if(await vaultDigest(vault)!==value.sha256)fail('Backup integrity check failed. Nothing was imported.');return vault;
}
export function mergeVault(current,incoming){
 const a=normalizeVault(current),b=normalizeVault(incoming),map=new Map(a.projects.map(p=>[p.id,p]));
 for(const project of b.projects){if(map.has(project.id)&&JSON.stringify(map.get(project.id))!==JSON.stringify(project))fail('Project conflict: existing work was not overwritten.');map.set(project.id,project);}
 return normalizeVault({...emptyVault(),projects:[...map.values()]});
}
export function checkpointProject(project,label){
 const p=normalizeVault({...emptyVault(),projects:[project]}).projects[0],{checkpoints,...body}=p;const {id:_,...snapshot}=body;
 return normalizeVault({...emptyVault(),projects:[{...p,checkpoints:[...checkpoints.slice(-2),{id:crypto.randomUUID(),label,at:new Date().toISOString(),...snapshot}]}]}).projects[0];
}
export function restoreCheckpoint(project,checkpointId){
 const p=normalizeVault({...emptyVault(),projects:[project]}).projects[0],c=p.checkpoints.find(c=>c.id===id(checkpointId));if(!c)fail('That checkpoint is unavailable.');
 const {id:_,label:__,at:___,...snapshot}=c;return normalizeVault({...emptyVault(),projects:[{...p,...snapshot}]}).projects[0];
}
