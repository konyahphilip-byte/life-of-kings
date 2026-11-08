import {useContext,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {emptyVault,newProject,normalizeVault,exportBackup,readBackup,mergeVault,checkpointProject,restoreCheckpoint,FILE_BYTES,BACKUP_BYTES,type GameVault,type VaultProject} from '../../../shared/game-vault.mjs';
import {GameVaultDraftContext,GameVaultDraftProvider} from './GameVaultDraft';
import {useGameVault} from './useGameVault';
import './vault-studio.css';
type Props={ownerId:string|null;onAccount:()=>void};
export default function GameVaultStudio(props:Props){const context=useContext(GameVaultDraftContext);return context?.ownerId===props.ownerId?<Studio key={props.ownerId??'guest'} {...props}/>:<GameVaultDraftProvider ownerId={props.ownerId}><Studio {...props}/></GameVaultDraftProvider>;}
function Studio({ownerId,onAccount}:Props){
 const cache=useContext(GameVaultDraftContext)!;const {memory,setMemory}=cache;const draft=memory.project,dirty=memory.dirty;
 const vault=useGameVault(ownerId),{snapshot,error,setError,busy,loading}=vault;
 const [reading,setReading]=useState(false),readingRef=useRef(false);
 const [consent,setConsent]=useState(false),[notice,setNotice]=useState(memory.dirty?'Unsaved draft resumed in this open app.':''),[selectedFile,setSelectedFile]=useState(draft?.files[0]?.path??'');
 const [newPath,setNewPath]=useState(''),[label,setLabel]=useState(''),[preview,setPreview]=useState<{vault:GameVault;revision:number}|null>(null);
 const [confirm,setConfirm]=useState<{kind:'discard'|'restore'|'remove';project:VaultProject}|{kind:'reload'}|null>(null);
 const snapshotRef=useRef(snapshot);snapshotRef.current=snapshot;
 const dialogRef=useRef<HTMLDivElement|null>(null),createRef=useRef<HTMLButtonElement|null>(null),reloadRef=useRef<HTMLButtonElement|null>(null),focusRequested=useRef(false),busyRef=useRef(busy);busyRef.current=busy;
 const [focusVersion,setFocusVersion]=useState(0);useEffect(()=>{if(!focusRequested.current||busy||loading)return;const target=[createRef.current,reloadRef.current].find(e=>e?.isConnected&&!e.disabled);if(target){target.focus();focusRequested.current=false;}},[focusVersion,busy,loading]);
 function requestUsefulFocus(){focusRequested.current=true;setFocusVersion(v=>v+1);}
 const live=useRef(true),generation=useRef(0),fileGeneration=useRef(0),draftRef=useRef<VaultProject|null>(draft);
 useEffect(()=>{live.current=true;return()=>{live.current=false;fileGeneration.current++;draftRef.current=null;};},[]);
 useEffect(()=>{if(!confirm)return;const previous=document.activeElement as HTMLElement|null,dialog=dialogRef.current;const buttons=()=>[...(dialog?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[])];buttons()[0]?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busyRef.current){e.preventDefault();setConfirm(null);}if(e.key==='Tab'){const list=buttons(),index=list.indexOf(document.activeElement as HTMLButtonElement);if(index<0||(!e.shiftKey&&index===list.length-1)||(e.shiftKey&&index===0)){e.preventDefault();(e.shiftKey?list.at(-1):list[0])?.focus();}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);if(previous?.isConnected&&!previous.matches(':disabled'))previous.focus();};},[confirm]);
 function replace(value:VaultProject|null,modified:boolean,base=snapshot){generation.current++;draftRef.current=value;setMemory({project:value,dirty:modified,baseRevision:base?.revision??0,baseVault:base?.vault??emptyVault()});if(!modified)cache.pending.current=null;setConsent(false);setNotice('');setPreview(null);setSelectedFile(value?.files[0]?.path??'');}
 useLayoutEffect(()=>{if(vault.accountInvalid){replace(null,false,null);return;}if(snapshot&&!dirty&&memory.baseRevision!==snapshot.revision)replace(snapshot.vault.projects.find(p=>p.id===draft?.id)??null,false,snapshot);},[snapshot,vault.accountInvalid,dirty,memory.baseRevision]);
 function edit(value:VaultProject){generation.current++;draftRef.current=value;setMemory(old=>({...old,project:value,dirty:true}));setConsent(false);setNotice('');setPreview(null);}
 function choose(value:VaultProject){if(dirty){setConfirm({kind:'discard',project:value});return;}replace(value,false);}
 function draftVault(){const current=draft?memory.baseVault:snapshot?.vault??emptyVault();return normalizeVault(draft?{...current,projects:[...current.projects.filter(p=>p.id!==draft.id),draft]}:current);}
 async function save(value:GameVault,revision=draft?memory.baseRevision:snapshot?.revision,selectedId:string|null=draft?.id??null){
  if(revision===undefined)return;if(readingRef.current){setError('Wait for selected files to finish reading, or cancel the read.');return;}const savedGeneration=generation.current;try{const result=await vault.save(value,revision);if(!live.current||!result)return;if(savedGeneration!==generation.current){setError('The submitted revision was saved, but newer draft edits remain unsaved. Export or save them separately.');return;}replace(result.vault.projects.find(p=>p.id===selectedId)??null,false,result);if(!selectedId)requestUsefulFocus();setNotice('Project Vault saved by the server.');}
  catch(e){setError(e instanceof Error?e.message:'Check the project before saving.');}
 }
 async function refresh(){
  if(readingRef.current){setError('Wait for the selected file read to finish.');return;}if(dirty){setConfirm({kind:'reload'});return;}
  fileGeneration.current++;setPreview(null);setConsent(false);const result=await vault.load();if(live.current&&result)replace(null,false,result);
 }
 async function discardAndReload(){replace(null,false);fileGeneration.current++;const result=await vault.load();if(live.current&&result)replace(null,false,result);requestUsefulFocus();}
 async function backup(){
  try{const json=await exportBackup(draftVault());if(!live.current)return;const url=URL.createObjectURL(new Blob([json],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='ecogames-vault.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  catch(e){if(live.current)setError(e instanceof Error?e.message:'Could not export the project.');}
 }
 async function files(selected:FileList|null){
  const token=++fileGeneration.current,start=generation.current,project=draftRef.current;readingRef.current=false;setReading(false);if(!selected?.length||!project)return;
  if(selected.length>20||[...selected].some(f=>f.size>FILE_BYTES)){setError('Choose up to 20 UTF-8 text files, at most 32 KB each.');return;}
  readingRef.current=true;setReading(true);try{
   const incoming=await Promise.all([...selected].map(async f=>({path:f.name,content:new TextDecoder('utf-8',{fatal:true}).decode(await f.arrayBuffer())})));
   const proposed={...project,files:[...project.files,...incoming]};normalizeVault({...emptyVault(),projects:[proposed]});
   if(!live.current||token!==fileGeneration.current)return;if(start!==generation.current){setError('The draft changed while files were read. Select them again; your edits were preserved.');return;}edit(proposed);setSelectedFile(incoming[0].path);
  }catch{if(live.current&&token===fileGeneration.current)setError('The selected files could not be added. Use unique relative names and supported UTF-8 text files; nothing was uploaded.');}
  finally{if(live.current&&token===fileGeneration.current){readingRef.current=false;setReading(false);}}
 }
 async function importBackup(file:File|undefined){
  const token=++fileGeneration.current,start=generation.current,revision=snapshot?.revision;readingRef.current=false;setReading(false);setPreview(null);setConsent(false);if(!file||revision===undefined)return;
  if(file.size>BACKUP_BYTES){setError('Choose a Vault backup smaller than 129 KB.');return;}
  if(dirty){setError('Save or export your draft before importing a backup.');return;}
  readingRef.current=true;setReading(true);try{const imported=await readBackup(new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()));
   if(!live.current||token!==fileGeneration.current)return;
   const current=snapshotRef.current;if(!current||current.revision!==revision||start!==generation.current)throw Error('Saved projects changed. Select the backup again.');
   setPreview({vault:mergeVault(current.vault,imported),revision});setConsent(false);
  }catch(e){if(live.current&&token===fileGeneration.current)setError(e instanceof Error?e.message:'The backup could not be verified.');}
  finally{if(live.current&&token===fileGeneration.current){readingRef.current=false;setReading(false);}}
 }
 function saveDraft(){try{void save(draftVault());}catch(e){setError(e instanceof Error?e.message:'Check the draft before saving.');}}
 const project=draft,projects=snapshot?.vault.projects??[],activeFile=project?.files.find(f=>f.path===selectedFile);
 const mutate=(patch:Partial<VaultProject>)=>{if(project)edit({...project,...patch});};
 function addFile(){
  if(!project)return;try{const proposed={...project,files:[...project.files,{path:newPath,content:''}]};normalizeVault({...emptyVault(),projects:[proposed]});edit(proposed);setSelectedFile(newPath);setNewPath('');}catch(e){setError(e instanceof Error?e.message:'Check the source path.');}
 }
 return <section className="eg-vault" aria-label="Game Vault and Studio">
  <header><p className="eg-kicker">YOUR PROJECTS, YOUR ORIGINALS</p><h2>Keep building where you left off.</h2><p>Create a project, write its Story Bible and edit selected text files. Save privately to your EcoVibes account, then reopen on another signed-in device.</p><p>Text-source pilot: five projects, twenty files each, three checkpoints each, 128 KB combined. Game execution, binary assets and AI generation are not connected here.</p></header>
  {error&&<p role="alert" className="eg-error">{error}</p>}<p role="status">{notice||(busy?'Saving project…':reading?'Reading selected files locally…':loading?'Loading your project Vault…':'')}</p>
  {reading&&<button onClick={()=>{fileGeneration.current++;readingRef.current=false;setReading(false);setError('File reading cancelled. Nothing was added or uploaded.');}}>Cancel file read</button>}
  {!ownerId?<section><h3>Your own workspace</h3><p>Sign in before uploading or retrieving project source.</p><button onClick={onAccount}>Open EcoVibes ID</button></section>
  :vault.accountInvalid?<section><p>The account changed. This workspace is hidden.</p><button onClick={onAccount}>Open EcoVibes ID</button></section>
  :!snapshot?<button disabled={loading} onClick={()=>void vault.load()}>Retry project Vault</button>
  :<>
   <div className="eg-vault-actions"><button ref={createRef} disabled={busy||loading||reading||projects.length>=5} onClick={()=>{const p=newProject();if(dirty)setConfirm({kind:'discard',project:p});else replace(p,true);}}>Create project</button><button ref={reloadRef} disabled={busy||loading||reading} onClick={()=>void refresh()}>Reload saved projects</button><button onClick={()=>void backup()}>Export {dirty?'current draft':'Vault backup'}</button><span>Saved revision {snapshot.revision}</span></div>
   <div className="eg-studio-layout"><aside aria-label="Saved game projects"><h3>Your projects</h3>{projects.length?projects.map(p=><button key={p.id} disabled={busy||loading||reading} aria-pressed={p.id===project?.id} onClick={()=>choose(p)}><strong>{p.title}</strong><small>{p.engine} · {p.files.length} files · {p.checkpoints.length} checkpoints</small></button>):<p>No projects saved. Create one to start.</p>}</aside>
   {project?<section aria-label="Project editor"><fieldset disabled={busy||loading||reading}>
    <div className="eg-editor-top"><label>Project title<input maxLength={100} value={project.title} onChange={e=>mutate({title:e.target.value})}/></label><label>Engine<select aria-label="Engine" value={project.engine} onChange={e=>mutate({engine:e.target.value as VaultProject['engine']})}><option value="godot">Godot</option><option value="three">Three.js</option><option value="custom">Custom</option></select></label><span>{dirty?'Unsaved draft':'Server-saved project'}</span></div>
    <label>Story Bible<textarea aria-label="Story Bible" className="eg-story" maxLength={12000} value={project.story} onChange={e=>mutate({story:e.target.value})} placeholder="World, characters, mechanics and the smallest playable goal…"/></label>
    <section><h3>Source files</h3><p>Only selected files are read locally. Save project separately to upload them privately. No source is executed, rendered as a web page or sent to AI.</p><label>Choose text source files<input type="file" multiple accept=".gd,.godot,.tscn,.tres,.ts,.tsx,.js,.jsx,.json,.md,.txt,.html,.css,.glsl,.shader,.svg" onChange={e=>{void files(e.target.files);e.target.value='';}}/></label>
    <div className="eg-new-file"><label>New file path<input value={newPath} maxLength={160} onChange={e=>setNewPath(e.target.value)} placeholder="scripts/main.gd"/></label><button type="button" onClick={addFile}>Add empty text file</button></div>
    <nav aria-label="Project source files">{project.files.map(f=><button key={f.path} aria-pressed={selectedFile===f.path} onClick={()=>setSelectedFile(f.path)}>{f.path}</button>)}</nav>
    {activeFile&&<><label>Source: {activeFile.path}<textarea aria-label={'Source: '+activeFile.path} className="eg-source" spellCheck={false} maxLength={FILE_BYTES} value={activeFile.content} onChange={e=>mutate({files:project.files.map(f=>f.path===activeFile.path?{...f,content:e.target.value}:f)})}/></label><button onClick={()=>{mutate({files:project.files.filter(f=>f.path!==activeFile.path)});setSelectedFile(project.files.find(f=>f.path!==activeFile.path)?.path??'');}}>Remove selected file from draft</button></>}
    </section>
    <label className="eg-vault-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Store this Story Bible, selected source and checkpoints privately in my EcoVibes account. No AI processing or public publishing.</label>
    <button className="eg-primary" disabled={!consent||!dirty||busy||loading||reading} onClick={saveDraft}>Save project</button>
    <section><h3>Checkpoints</h3><p>Prepare a checkpoint from the saved project, then save it. Only the latest three are retained. Removing a checkpoint or project removes it from the current Vault; provider backup retention is separate.</p><label>Checkpoint label<input maxLength={80} value={label} onChange={e=>setLabel(e.target.value)}/></label><button disabled={dirty||!label.trim()||!projects.some(p=>p.id===project.id)} onClick={()=>{try{edit(checkpointProject(project,label));setLabel('');}catch(e){setError(e instanceof Error?e.message:'Checkpoint could not be prepared.');}}}>Prepare checkpoint</button>
    {project.checkpoints.map(c=><article key={c.id}><strong>{c.label}</strong><span>{new Date(c.at).toLocaleString()} · {c.files.length} files</span><button onClick={()=>{try{setConfirm({kind:'restore',project:restoreCheckpoint(project,c.id)});}catch(e){setError(e instanceof Error?e.message:'Checkpoint unavailable.');}}}>Preview checkpoint {c.label}</button><button onClick={()=>mutate({checkpoints:project.checkpoints.filter(item=>item.id!==c.id)})}>Remove checkpoint {c.label}</button></article>)}</section>
    {projects.some(p=>p.id===project.id)&&<button className="eg-vault-remove" disabled={dirty} onClick={()=>setConfirm({kind:'remove',project})}>Remove project from Vault</button>}
   </fieldset></section>:<section><h3>Choose a saved project or create one.</h3><p>Your editor reopens server-confirmed work. Export a backup for independent recovery. Unsaved edits resume when you return within this open app. Closing or reloading the app can lose them; export or save first.</p></section>}
   </div>
   <section className="eg-vault-import"><h3>Restore from a backup</h3><p>Select only your own Vault JSON backup. Integrity verification detects accidental changes; it does not prove authorship or asset rights. Import preview does not upload anything.</p><label>Choose Vault backup<input type="file" accept=".json,application/json" disabled={busy||loading||reading} onChange={e=>{void importBackup(e.target.files?.[0]);e.target.value='';}}/></label>
   {preview&&<div aria-label="Vault import preview"><p>{preview.vault.projects.length} projects after merge. Existing conflicting IDs will not be overwritten.</p><label className="eg-vault-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Store these verified backup contents privately in my EcoVibes account. No AI processing.</label><button disabled={!consent||busy||loading||reading||dirty} onClick={()=>void save(preview.vault,preview.revision)}>Import verified backup</button></div>}</section>
  </>}
  {confirm&&<div className="eg-vault-backdrop"><div ref={dialogRef} className="eg-vault-dialog" role="dialog" aria-modal="true" aria-label={confirm.kind==='reload'?'Discard draft and reload':confirm.kind==='discard'?'Unsaved project edits':confirm.kind==='restore'?'Checkpoint preview':'Remove project confirmation'}>
   <h3>{confirm.kind==='reload'?'Discard draft and reload?':confirm.kind==='discard'?'Discard unsaved edits?':confirm.kind==='restore'?'Load checkpoint into draft?':'Remove saved project?'}</h3>{'project' in confirm&&<p>{confirm.project.title} · {confirm.project.files.length} files</p>}<p>{confirm.kind==='remove'?'This removes the current project and all its checkpoints from this account’s Vault. Export first if you want a recovery copy. Provider backups follow their own retention policy.':confirm.kind==='reload'||confirm.kind==='discard'?'Your current unsaved edits will be replaced. Export them first if needed.':'This replaces the editor draft; saving is a separate private-storage action.'}</p>
   <button disabled={busy} onClick={()=>{const c=confirm;setConfirm(null);if(c.kind==='reload')void discardAndReload();else if(c.kind==='remove'&&snapshot)void save({...snapshot.vault,projects:snapshot.vault.projects.filter(p=>p.id!==c.project.id)},snapshot.revision,null);else replace(c.project,c.kind==='restore'||!projects.some(p=>p.id===c.project.id));}}>{confirm.kind==='reload'?'Discard draft and reload':confirm.kind==='remove'?'Confirm removal':confirm.kind==='discard'?'Discard and continue':'Load checkpoint draft'}</button><button disabled={busy} onClick={()=>setConfirm(null)}>Keep current work</button>
  </div></div>}
 </section>;
}
