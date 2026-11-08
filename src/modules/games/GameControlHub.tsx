import {useEffect,useRef,useState} from 'react';
import {apiRequest} from '../../lib/api';
import {COLLECTIONS,PLATFORMS,STATUSES,MAX_WORKSPACE_BYTES,emptyWorkspace,normalizeWorkspace,serializeWorkspace,mergeImport,advisoryGate,type Workspace,type WorkspaceRecord,type Collection} from '../../../shared/game-control.mjs';
import tools from '../../../shared/game-tools.json';
import './control-hub.css';
type Snapshot={ownerId:string;revision:number;workspace:Workspace;history:{revision:number;sha256:string;createdAt:string}[]};
type Props={ownerId:string|null;onAccount:()=>void};
const labels:Record<Collection,string>={milestones:'Workboard',tests:'Device tests',builds:'Builds',compatibility:'Compatibility',submissions:'Submissions',changes:'Change notes'};
const projects=[['rumble-rush-1','Rumble Rush 1'],['rumble-rush-2','Rumble Rush 2 · planned'],['ecogames-platform','EcoGames platform'],['legacy','Imported legacy project']] as const;
const fresh=():WorkspaceRecord=>({id:crypto.randomUUID(),title:'',status:'Unknown',projectId:'rumble-rush-1',owner:'',nextAction:''});
function readSnapshot(value:unknown,ownerId:string):Snapshot{
 const s=value as Snapshot;
 if(!s||s.ownerId!==ownerId||!Number.isInteger(s.revision)||s.revision<0||s.revision>100||!Array.isArray(s.history))throw Error('The workspace response did not match your account.');
 return {...s,workspace:normalizeWorkspace(s.workspace)};
}
export default function GameControlHub(props:Props){return <ControlWorkspace key={props.ownerId??'guest'} {...props}/>;}
function ControlWorkspace({ownerId,onAccount}:Props){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [evidenceProject,setEvidenceProject]=useState('rumble-rush-1');
 const [tab,setTab]=useState<'workspace'|'matrix'|'tools'|'guide'>('workspace'),[kind,setKind]=useState<Collection>('milestones');
 const [draft,setDraft]=useState<WorkspaceRecord>(fresh),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [importText,setImportText]=useState(''),[preview,setPreview]=useState<{workspace:Workspace;revision:number}|null>(null),[consent,setConsent]=useState(false);
 const alive=useRef(true),controller=useRef<AbortController|null>(null),fileRevision=useRef(0);
 const pending=useRef<{expectedOwnerId:string;revision:number;operationId:string;workspace:Workspace}|null>(null);
 const draftSnapshot=useRef<Workspace|null>(null);
 useEffect(()=>{
  alive.current=true;
  if(ownerId)void load();
  return()=>{alive.current=false;controller.current?.abort();fileRevision.current++;};
 },[ownerId]);
 async function load(){
  if(!ownerId)return;controller.current?.abort();const abort=new AbortController();controller.current=abort;
  setLoading(true);setError('');
  const timer=setTimeout(()=>abort.abort(),10000);
  try{const value=await apiRequest<unknown>('/games/control',{signal:abort.signal});if(alive.current&&controller.current===abort&&!abort.signal.aborted){setSnapshot(readSnapshot(value,ownerId));setPreview(null);setConsent(false);}}
  catch(e){if(alive.current&&controller.current===abort)setError(abort.signal.aborted?'The workspace took too long to load. Please retry.':e instanceof Error?e.message:'The workspace could not be loaded.');}
  finally{clearTimeout(timer);if(alive.current&&controller.current===abort)setLoading(false);}
 }
 async function save(workspace:Workspace,previewRevision?:number){
  if(!ownerId||!snapshot||busy||loading)return;
  if(previewRevision!==undefined&&previewRevision!==snapshot.revision){setError('The workspace changed after this preview. Preview the import again before saving.');setPreview(null);setConsent(false);return;}
  draftSnapshot.current=workspace;setBusy(true);setError('');setNotice('');
  controller.current?.abort();const abort=new AbortController();controller.current=abort;
  const prior=pending.current;
  const operation=prior&&prior.revision===snapshot.revision&&JSON.stringify(prior.workspace)===JSON.stringify(workspace)?prior:{expectedOwnerId:ownerId,revision:snapshot.revision,operationId:crypto.randomUUID(),workspace};
  pending.current=operation;
  const timer=setTimeout(()=>abort.abort(),10000);
  try{
   const session=await apiRequest<{user:{id:string}|null;csrfToken:string|null}>('/auth/me',{signal:abort.signal});
   if(session.user?.id!==ownerId||!session.csrfToken)throw Error('Your account changed or session expired. Reopen your own workspace.');
   if(!alive.current||abort.signal.aborted)return;
   const value=await apiRequest<unknown>('/games/control',{method:'PUT',headers:{'X-CSRF-Token':session.csrfToken},body:JSON.stringify(operation),signal:abort.signal});
   if(!alive.current||abort.signal.aborted)return;
   setSnapshot(readSnapshot(value,ownerId));pending.current=null;draftSnapshot.current=null;setDraft(fresh());setPreview(null);setImportText('');setConsent(false);setNotice('Workspace saved by the server.');
  }catch(e){if(alive.current&&controller.current===abort)setError((abort.signal.aborted?'The save outcome is unknown. Retry the same draft.':e instanceof Error?e.message:'Save failed.')+' Your draft remains here; no saved success is recorded.');}
  finally{clearTimeout(timer);if(alive.current&&controller.current===abort)setBusy(false);}
 }
 function prepareRecord(){
  if(!snapshot)return;
  try{
   const proposed={...snapshot.workspace,[kind]:[...snapshot.workspace[kind].filter(r=>r.id!==draft.id),draft]};
   void save(normalizeWorkspace(proposed));
  }catch(e){setError(e instanceof Error?e.message:'Check the record.');}
 }
 function exportJSON(value:Workspace){
  const blob=new Blob([serializeWorkspace(value)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ecogames-workspace.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
 }
 function inspectImport(text:string){
  setError('');setPreview(null);setConsent(false);
  try{if(!snapshot)throw Error('Load your account workspace first.');const parsed=normalizeWorkspace(text);setPreview({workspace:mergeImport(snapshot.workspace,parsed),revision:snapshot.revision});}
  catch(e){setError(e instanceof Error?e.message:'This export could not be read.');}
 }
 async function selectFile(file:File|undefined){
  const generation=++fileRevision.current;if(!file)return;
  if(file.size>MAX_WORKSPACE_BYTES){setError('Choose a JSON export smaller than 128 KB.');return;}
  try{const text=await file.text();if(alive.current&&generation===fileRevision.current){setImportText(text);inspectImport(text);}}
  catch{if(alive.current&&generation===fileRevision.current)setError('The selected file could not be read. Nothing was uploaded.');}
 }
 const workspace=snapshot?.workspace??emptyWorkspace(),count=COLLECTIONS.reduce((n,k)=>n+workspace[k].length,0);
 const projectWorkspace={...workspace};
 for(const collection of COLLECTIONS)projectWorkspace[collection]=workspace[collection].filter(record=>(record.projectId??'legacy')===evidenceProject);
 const gate=advisoryGate(projectWorkspace),records=workspace[kind];
 const projectOptions=new Map<string,string>(projects);
 for(const collection of COLLECTIONS)for(const record of workspace[collection])if(record.projectId&&!projectOptions.has(record.projectId))projectOptions.set(record.projectId,'Imported project: '+record.projectId);
 if(draft.projectId&&!projectOptions.has(draft.projectId))projectOptions.set(draft.projectId,'Imported project: '+draft.projectId);
 const projectSelect=<label>Evidence project<select value={evidenceProject} onChange={e=>setEvidenceProject(e.target.value)}>{[...projectOptions].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>;
 const hasFormDraft=['title','version','caseId','action'].some(field=>Boolean(draft[field]?.trim()));
 function exportCurrent(){
  try{const value=hasFormDraft?{...workspace,[kind]:[...workspace[kind].filter(record=>record.id!==draft.id),draft]}:draftSnapshot.current??workspace;exportJSON(normalizeWorkspace(value));}
  catch(e){setError(e instanceof Error?e.message:'Check the draft before exporting.');}
 }
 const update=(name:string,value:string)=>setDraft(d=>({...d,[name]:value}));
 const field=(name:string,label:string,large=false)=><label key={name}>{label}{large?<textarea maxLength={2000} value={draft[name]??''} onChange={e=>update(name,e.target.value)}/>:<input maxLength={2000} value={draft[name]??''} onChange={e=>update(name,e.target.value)}/>}</label>;
 const specific=kind==='tests'?['caseId','platform','device','buildVersion']:kind==='builds'?['version','platform','channel','commit','artifact']:kind==='compatibility'?['compatId']:kind==='submissions'?['creatorName','platform','packageUrl','rights']:kind==='changes'?['action','details']:[];
 return <section className="eg-control" aria-label="Games Control Hub">
  <header className="eg-control-hero"><p className="eg-kicker">YOUR GAMES WORKSPACE</p><h2>Ideas into playable worlds.</h2><p>Plan, record builds and track real tests across EcoGames. Rumble Rush 1 is the existing prototype; Rumble Rush 2 is a separate future high-fidelity project.</p><div className="eg-control-stats"><span>{count} saved records</span><span>Revision {snapshot?.revision??'—'}</span><span>GH₵0 platform fees</span></div></header>
  <nav aria-label="Control Hub views">{([['workspace','Workspace'],['matrix','Device matrix'],['tools','Open tools'],['guide','Getting started']] as const).map(([value,label])=><button key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}>{label}</button>)}</nav>
  {error&&<p role="alert" className="eg-error">{error}</p>}<p role="status" aria-live="polite">{notice|| (loading?'Loading your private workspace…':'')}</p>
  {tab==='tools'?<section><h3>Build with proven tools.</h3><p>Licence review is separate from installation, integration and game-quality acceptance. No tool here automatically creates AAA gameplay.</p><div className="eg-tool-grid">{tools.tools.map(t=><article key={t.id}><span>{t.stage} · {t.license}</span><h4>{t.name}</h4><p>{t.use}</p><p>{t.note}</p><a href={t.url} target="_blank" rel="noopener noreferrer">Licence source ↗</a></article>)}</div><p>Sources checked {tools.checkedAt}. No new tool, service or paid inference was installed or activated by this register.</p></section>
  :tab==='guide'?<section className="eg-control-guide"><h3>Your first working session</h3><ol><li>Sign in with the EcoVibes account whose private workspace you want to use.</li><li>Add a milestone with its owner and next action. Use Unknown when it has not been tested.</li><li>Record a specific build ID and actual device test. Keep Rumble Rush 1 and 2 records separate.</li><li>Import an export from your separate Control Hub only after reviewing the preview.</li><li>Export a backup. Refresh to see server-confirmed records on another signed-in device.</li></ol><p>Evidence links are recorded claims. The checklist does not approve publication, change permissions, run code, upload game binaries or deploy a game.</p><p>This pilot stores at most 100 records and 100 immutable workspace revisions per account. Records stay private in EcoVibes; they are not sent to Chale or used for training.</p></section>
  :!ownerId?<section><h3>Your workspace follows your EcoVibes account.</h3><p>Sign in before saving or importing private project records.</p><button className="eg-primary" onClick={onAccount}>Open EcoVibes ID</button></section>
  :!snapshot?<section><p>The private workspace must load before editing.</p><button disabled={loading} onClick={()=>void load()}>Retry workspace</button></section>
  :tab==='matrix'?<section><h3>Actual device evidence</h3>{projectSelect}<p>Cells show saved, user-reported results. Missing cells are untested; a browser simulation does not stand in for a real phone.</p><div className="eg-matrix-scroll"><table><thead><tr><th>Case</th>{PLATFORMS.map(p=><th key={p}>{p}</th>)}</tr></thead><tbody>{Array.from({length:12},(_,i)=>'A'+String(i+1).padStart(2,'0')).map(caseId=><tr key={caseId}><th>{caseId}</th>{PLATFORMS.map(platform=>{const matches=projectWorkspace.tests.filter(t=>t.caseId===caseId&&t.platform===platform);return <td key={platform}><button onClick={()=>{setKind('tests');setDraft(matches.at(-1)??{...fresh(),projectId:evidenceProject,title:caseId+' acceptance test',caseId,platform,status:'Untested'});setTab('workspace');}}>{matches.at(-1)?.status??'Untested'}</button></td>;})}</tr>)}</tbody></table></div></section>
  :<section>
   <div className="eg-control-actions"><button disabled={loading||busy} onClick={()=>void load()}>Refresh saved workspace</button><button onClick={exportCurrent}>Export {hasFormDraft?'form draft':draftSnapshot.current?'last attempted save':'workspace'}</button></div>
   <p className="eg-fine">Private, server-saved metadata. Imported claims remain user-reported. Saves never authorize game execution or publication.</p>
   <div className="eg-control-columns"><section><label>Record type<select value={kind} disabled={busy} onChange={e=>{setKind(e.target.value as Collection);setDraft(fresh());}}>{COLLECTIONS.map(k=><option key={k} value={k}>{labels[k]}</option>)}</select></label><h3>{labels[kind]}</h3>{records.length?records.map(r=><article className="eg-control-record" key={r.id}><div><h4>{r.title||r.version||r.action||r.caseId}</h4><p>{r.projectId??'Imported legacy project'} · Recorded: {r.status??'Note'}</p><p>{r.nextAction||r.details||'No next action recorded.'}</p></div><button disabled={busy} onClick={()=>setDraft({...r})}>Edit</button></article>):<p>No {labels[kind].toLowerCase()} saved yet.</p>}
    <details><summary>Revision history</summary><p>Latest 20 private revisions. Refresh confirms what the server saved.</p><ul>{snapshot.history.map(h=><li key={h.revision}>Revision {h.revision} · {new Date(h.createdAt).toLocaleString()} · {h.sha256.slice(0,12)}</li>)}</ul></details>
   </section><form onSubmit={e=>{e.preventDefault();prepareRecord();}}><h3>{records.some(r=>r.id===draft.id)?'Edit record':'Add a record'}</h3><fieldset disabled={busy||loading}>
    <label>Project<select value={draft.projectId??'legacy'} onChange={e=>update('projectId',e.target.value)}>{[...projectOptions].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    {field('title','Title')}<label>Recorded status<select value={draft.status??'Unknown'} onChange={e=>update('status',e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></label>
    {specific.map(name=>field(name,name==='caseId'?'Test case ID':name==='buildVersion'?'Tested build ID':name==='device'?'Actual device / browser':name==='version'?'Build version':name[0].toUpperCase()+name.slice(1)))}
    {field('confidence','Evidence confidence / limitation')}{field('owner','Responsible owner')}{field('nextAction','Smallest next action',true)}{field('evidence','Evidence URL')}{field('lastChecked','Last checked (ISO timestamp)')}{field('blocker','Blocker')}{field('dependency','Dependency')}{field('notes','Notes',true)}
    <p>Saving stores this metadata and revision history in your EcoVibes account. It does not upload game files or process them with AI.</p><button className="eg-primary" disabled={loading||busy}>{busy?'Saving…':'Save record'}</button>
   </fieldset></form></div>
   <details className="eg-control-import"><summary>Bring in your separate Control Hub records</summary><p>Select only a JSON export you want to inspect. Reading it here does not upload it. Existing conflicting IDs are rejected; records are merged atomically after consent.</p><input aria-label="Choose Control Hub JSON export" type="file" accept=".json,application/json" disabled={busy} onChange={e=>void selectFile(e.target.files?.[0])}/><label>Or paste exported JSON<textarea maxLength={MAX_WORKSPACE_BYTES} value={importText} onChange={e=>{setImportText(e.target.value);setPreview(null);setConsent(false);}}/></label><button disabled={busy} onClick={()=>inspectImport(importText)}>Preview import</button>
    {preview&&<section aria-label="Import preview"><p>{COLLECTIONS.reduce((n,k)=>n+preview.workspace[k].length,0)} records after merge. All claims remain user-reported.</p><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Store these records and revision history privately in my EcoVibes account. Do not send them to AI.</label><button disabled={!consent||busy||loading} onClick={()=>void save(preview.workspace,preview.revision)}>Import to my workspace</button></section>}
   </details>
   <section className="eg-gate"><h3>Release evidence checklist</h3>{projectSelect}<p>{gate.ready?'Recorded checklist complete; independent review and release approval still required.':'Evidence still needed before release review.'}</p><ul>{gate.failures.map(f=><li key={f}>{f}</li>)}</ul><p>Advisory only. No publish or deployment authority.</p></section>
  </section>}
 </section>;
}
