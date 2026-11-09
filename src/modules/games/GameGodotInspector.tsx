import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {VaultProject} from '../../../shared/game-vault.mjs';
import {inspectGodotProject,type GodotPreflight} from '../../../shared/game-godot-preflight.mjs';
type Props={ownerId:string|null;project:VaultProject;disabled?:boolean};
type View={owner:string;project:VaultProject;busy:boolean;report?:GodotPreflight;message?:string;error?:boolean};
export default function GameGodotInspector({ownerId,project,disabled=false}:Props){
 const [view,setView]=useState<View|null>(null),sequence=useRef(0),controller=useRef<AbortController|null>(null),mounted=useRef(true),focusBack=useRef(false);
 const button=useRef<HTMLButtonElement|null>(null),heading=useRef<HTMLHeadingElement|null>(null),alert=useRef<HTMLParagraphElement|null>(null);
 const current=!disabled&&view?.owner===ownerId&&view.project===project?view:null;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;sequence.current++;controller.current?.abort();};},[]);
 useEffect(()=>{sequence.current++;controller.current?.abort();controller.current=null;setView(null);focusBack.current=false;},[ownerId,project,disabled]);
 useLayoutEffect(()=>{if(current?.report)heading.current?.focus();else if(current?.error)alert.current?.focus();else if(focusBack.current&&!current?.busy){button.current?.focus();focusBack.current=false;}},[current]);
 async function run(){
  if(!ownerId||disabled||current?.busy)return;const token=++sequence.current,aborter=new AbortController();controller.current=aborter;
  setView({owner:ownerId,project,busy:true});const deadline=setTimeout(()=>aborter.abort(),10000);
  try{const report=await inspectGodotProject(project,{signal:aborter.signal});if(mounted.current&&sequence.current===token&&!aborter.signal.aborted)setView({owner:ownerId,project,busy:false,report});}
  catch{if(mounted.current&&sequence.current===token)setView({owner:ownerId,project,busy:false,error:true,message:aborter.signal.aborted?'Inspection stopped before completion. Your source is unchanged.':'Source inspection could not finish. Your source is unchanged; try again when ready.'});}
  finally{clearTimeout(deadline);if(controller.current===aborter)controller.current=null;}
 }
 function cancel(){sequence.current++;controller.current?.abort();controller.current=null;focusBack.current=true;if(ownerId)setView({owner:ownerId,project,busy:false,message:'Inspection cancelled. No files were changed.'});}
 const report=current?.report,title=report?.status==='needs-repair'?'Source repairs needed':report?.status==='limited'?'Some checks need manual review':'Supported references checked';
 return <section className="eg-godot-inspector" aria-label="Godot source inspector">
  <h3>Check your Godot project</h3><p>Inspect the source already in this draft, on this device. This is static text inspection, not Godot execution, script compilation or a playable preview. Nothing uploads or goes to an AI model.</p>
  <div className="eg-vault-actions"><button ref={button} type="button" disabled={!ownerId||disabled||!!current?.busy} onClick={()=>void run()}>Inspect Godot source</button>{current?.busy&&<button type="button" onClick={cancel}>Cancel inspection</button>}</div>
  {current?.busy&&<p role="status">Checking project references locally…</p>}
  {current?.message&&<p ref={alert} tabIndex={-1} role={current.error?'alert':'status'}>{current.message}</p>}
  {report&&<div aria-label="Godot inspection results">
   <h4 ref={heading} tabIndex={-1}>{title}</h4><p>{report.nodes.length} files · {report.edges.length} references · {report.issues.filter(i=>i.severity==='error').length} errors · {report.issues.filter(i=>i.severity==='warning').length} manual checks</p>
   <p>No files were changed. Only the supported reference checks ran. {report.coverage}</p>
   <ul className="eg-godot-issues">{report.issues.map((issue,index)=><li key={index}><strong>{issue.message}</strong>{issue.file&&<p><code>{issue.file}</code> · line {issue.line}</p>}{issue.target&&<p>Reference: <code>{issue.target}</code></p>}<p>{issue.repair}</p></li>)}</ul>
   <details><summary>Dependency graph ({report.nodes.length} files, {report.edges.length} references)</summary><ul>{report.nodes.map(node=><li key={node.path}><code>{node.path}</code> · {node.kind}<ul>{report.edges.filter(e=>e.from===node.path).map((edge,index)=><li key={index}><code>{edge.target}</code> · {edge.kind} · {edge.status.replaceAll('-',' ')}</li>)}</ul></li>)}</ul></details>
   <p>Binary assets, plugins, UID databases, runtime-computed paths and native compilation may need separate work. Review manual checks before opening source in an isolated local editor.</p>
  </div>}
  <details><summary>Chale assistance and privacy</summary><p>AI explanations and editing are not connected here. A future explanation may use approved issue codes and counts after your separate consent. Source access and any proposed edits will need their own permission, preview and explicit approval.</p></details>
 </section>;
}
