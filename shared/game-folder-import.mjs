import {emptyVault,normalizeVault,FILE_BYTES,VAULT_BYTES} from './game-vault.mjs';
import {assertPortableSourcePaths} from './game-source-paths.mjs';
const source=/\.(gd|godot|tscn|tres|ts|tsx|js|jsx|json|md|txt|html|css|glsl|shader|svg)$/i;
const generated=new Set(['node_modules','__pycache__','build','dist','coverage','target']);
const cancel=()=>Error('Folder source read cancelled. Nothing was added.');
function checkSignal(signal){if(signal?.aborted)throw cancel();}
export function planSourceFolder(selection){
 if(!selection||!Number.isSafeInteger(selection.length)||selection.length<1||selection.length>1000)throw Error('Choose a source folder with at most 1000 file entries.');
 let root;const entries=[],seen=new Set();let skipped=0;
 for(let i=0;i<selection.length;i++){
  const file=selection[i],relative=file?.webkitRelativePath;
  if(typeof relative!=='string'||relative.length>4096||/[\\\u0000-\u001f]/.test(relative))throw Error('This browser did not provide safe folder-relative paths. Choose individual files instead.');
  const parts=relative.split('/'),first=parts.shift();
  if(parts.length<1||!first||first.length>255||first.startsWith('.')||first.includes(':')||parts.some(p=>!p||p==='.'||p==='..')||file.name!==parts.at(-1)||!Number.isSafeInteger(file.size)||file.size<0)throw Error('Choose one source folder with valid relative file metadata.');
  if(root!==undefined&&root!==first)throw Error('Choose files from one folder root.');root=first;
  if(parts.some(p=>p.startsWith('.'))||parts.slice(0,-1).some(p=>generated.has(p.toLowerCase()))||!source.test(parts.at(-1))){skipped++;continue;}
  const path=parts.join('/');assertPortableSourcePaths([path]);if(seen.has(path))throw Error('Duplicate relative source paths in the folder.');seen.add(path);
  if(entries.length>=100)throw Error('Preview at most 100 supported source files. Choose a smaller folder or individual files.');
  entries.push(Object.freeze({path,name:file.name,size:file.size,relative,file}));
 }
 entries.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 return Object.freeze({root,entries:Object.freeze(entries),skipped});
}
function readBytes(file,signal){
 checkSignal(signal);
 return new Promise((resolve,reject)=>{
  const abort=()=>{signal?.removeEventListener('abort',abort);reject(cancel());};signal?.addEventListener('abort',abort,{once:true});
  Promise.resolve().then(()=>{checkSignal(signal);return file.arrayBuffer();}).then(resolve,reject).finally(()=>signal?.removeEventListener('abort',abort));
 });
}
export async function readSourceFolder(plan,selected,project,signal){
 checkSignal(signal);
 if(!Array.isArray(selected)||!selected.length||selected.length>20||new Set(selected).size!==selected.length)throw Error('Choose between 1 and 20 unique source files.');
 const entries=selected.map(path=>{const e=plan.entries.find(e=>e.path===path);if(!e)throw Error('The selected source preview is unavailable.');return e;});
 for(const e of entries)if(e.file.name!==e.name||e.file.webkitRelativePath!==e.relative||e.relative!==plan.root+'/'+e.path||e.file.size!==e.size)throw Error('Folder file metadata changed. Select the folder again.');
 if(entries.some(e=>e.size>FILE_BYTES))throw Error('Each selected source file must fit within 32 KB.');
 if(entries.reduce((n,e)=>n+e.size,0)>VAULT_BYTES)throw Error('Selected source must fit within the existing 128 KB Vault limit.');
 const paths=[...project.files.map(f=>f.path),...entries.map(e=>e.path)];assertPortableSourcePaths(paths);
 normalizeVault({...emptyVault(),projects:[{...project,files:[...project.files,...entries.map(e=>({path:e.path,content:''}))]}]});
 const files=[];
 for(const e of entries){
  checkSignal(signal);let buffer;
  try{buffer=await readBytes(e.file,signal);}catch{checkSignal(signal);throw Error('Selected source could not be read. Re-select the folder when access is available.');}
  checkSignal(signal);if(Object.prototype.toString.call(buffer)!=='[object ArrayBuffer]'||buffer.byteLength!==e.size)throw Error('Source bytes changed during reading. Select the folder again.');
  let content;try{content=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(buffer);}catch{throw Error('Choose valid UTF-8 text source. Nothing was added.');}
  files.push({path:e.path,content});
 }
 normalizeVault({...emptyVault(),projects:[{...project,files:[...project.files,...files]}]});
 return files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
