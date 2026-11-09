import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,rm,writeFile,readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fixtureProject,verifyExtractedArchive} from './test-game-project-export.mjs';
import {projectSourceArchive} from '../shared/game-project-export.mjs';
import {inspectGodotProject} from '../shared/game-godot-preflight.mjs';
export function godotInspectionFixture(){
 const p=fixtureProject();p.files[1].content='[gd_scene load_steps=3 format=3]\n[ext_resource type="Script" path="res://scripts/main.gd" id="1"]\n[ext_resource type="Material" path="../materials/blue.tres" id="2"]\n[node name="Main" type="Node3D"]\nscript = ExtResource("1")\n[node name="Mesh" type="MeshInstance3D" parent="."]\nmaterial_override = ExtResource("2")\n';
 p.files[2].content+='const MaterialSource = preload("res://materials/blue.tres")\n';
 p.files.push({path:'materials/blue.tres',content:'[gd_resource type="StandardMaterial3D" format=3]\n[resource]\nalbedo_color = Color(0.1, 0.2, 0.3, 1)\n'});return p;
}
export function verifyNativeFixtureResult(result,expectErrors){
 assert(!result.error,'Native import did not finish: '+(result.error?.message??''));
 assert.equal(result.signal,null,'Native import was interrupted');
 assert.equal(result.status,0,'Native import did not complete normally');
 const text=(result.stdout??'')+(result.stderr??''),errors=/(?:SCRIPT ERROR:|Parse Error:|ERROR:)/.test(text);
 if(expectErrors){
  const expected='ERROR: Parse Error: Parse error. [Resource file res://scenes/main.tscn:3]';
  const lines=text.split(/\r?\n/).filter(line=>/(?:SCRIPT ERROR:|Parse Error:|ERROR:)/.test(line));
  assert(lines.includes(expected),'Expected the undefined-resource scene parse failure at line3');
  assert(lines.includes('ERROR: Failed loading resource: res://scenes/main.tscn.'),'Expected the fixture scene load failure');
  assert(lines.every(line=>line===expected||line==='ERROR: Failed loading resource: res://scenes/main.tscn.'),'Unexpected additional native error');
 }else assert(!errors,text);
 return {text,errors};
}
async function main(){
 const output=new URL('../work/ecogames-godot-preflight-20261109/',import.meta.url);await mkdir(output,{recursive:true});const temp=await mkdtemp(join(tmpdir(),'eco-godot-inspection-')),checks=[];let failure;
 try{
  const p=godotInspectionFixture(),before=JSON.stringify(p),report=await inspectGodotProject(p);assert.equal(report.status,'static-checked');assert.equal(report.engineExecuted,false);assert.equal(JSON.stringify(p),before);checks.push({check:'Static inspector finds actual nested fixture references without mutation or execution',passed:true,files:report.nodes.length,references:report.edges.length});
  const extracted=await verifyExtractedArchive(projectSourceArchive(p).bytes,p,join(temp,'positive'));checks.push({check:'Independent ZIP extraction preserves all fixture source bytes before native import',passed:true,files:p.files.length});
  const negative={...p,files:p.files.map(f=>f.path==='scenes/main.tscn'?{...f,content:'[gd_scene format=3]\n[node name="Main" type="Node3D"]\nscript = ExtResource("missing")\n'}:f)};
  const badReport=await inspectGodotProject(negative);assert(badReport.issues.some(i=>i.code==='undefined-resource-id'));checks.push({check:'Static inspector flags a trusted malformed-resource fixture',passed:true});
  if(!process.env.GODOT_BIN){checks.push({check:'Separate native Godot fixture import',status:'UNVERIFIED',reason:'No explicitly verified local Godot selected. Static inspection is not engine execution.'});}
  else{
   assert.equal(process.platform,'darwin','This verifier currently verifies the existing official macOS archive only.');
   const bin=resolve(process.env.GODOT_BIN),app=resolve(dirname(bin),'../..'),archive=resolve(app,'../../Godot_v4.7.2-stable_macos.universal.zip');
   assert((await stat(resolve(app,'../_sc_'))).isFile(),'Use a task-local portable editor; never install or redirect the user home.');
   const hash=createHash('sha256');for await(const bytes of createReadStream(archive))hash.update(bytes);
   assert.equal(hash.digest('hex'),'c58a24e31d720be9d62f60cb5627c4e695fb72f21b0cfe1bc9ccaa9a3b3ba63e','Official archive checksum mismatch');
   const match=spawnSync('python3',['-c','import sys,zipfile,hashlib\nwith zipfile.ZipFile(sys.argv[1]) as z:\n h=hashlib.sha256()\n with z.open("Godot.app/Contents/MacOS/Godot") as f:\n  for b in iter(lambda:f.read(1048576),b""):h.update(b)\n a=h.hexdigest()\nh=hashlib.sha256()\nwith open(sys.argv[2],"rb") as f:\n for b in iter(lambda:f.read(1048576),b""):h.update(b)\nassert a==h.hexdigest(),"Installed binary differs from verified archive"\nprint(a)',archive,bin],{encoding:'utf8',timeout:30000,maxBuffer:3000});assert.equal(match.status,0,match.stderr);
   const signature=spawnSync('codesign',['--verify','--deep','--strict',app],{encoding:'utf8',timeout:30000,maxBuffer:3000});await writeFile(new URL('native-verification.log',output),JSON.stringify({archiveSha256:'c58a24e31d720be9d62f60cb5627c4e695fb72f21b0cfe1bc9ccaa9a3b3ba63e',binaryMatchesArchive:match.status===0,binarySha256:match.stdout.trim(),codesignExit:signature.status})+'\n'+signature.stdout+signature.stderr);assert.equal(signature.status,0,signature.stderr);
   const negativeExtracted=await verifyExtractedArchive(projectSourceArchive(negative).bytes,negative,join(temp,'negative'));
   // Only these hard-coded script-owned fixtures are imported. No creator path/source parameter exists.
   for(const [label,base,expectErrors] of [['positive',extracted,false],['negative',negativeExtracted,true]]){
    const result=spawnSync(bin,['--headless','--editor','--path',join(base.destination,base.rootDirectory),'--import'],{encoding:'utf8',timeout:45000,maxBuffer:20000,env:{PATH:process.env.PATH,...(process.env.HOME?{HOME:process.env.HOME}:{})}});
    const text=(result.stdout??'')+(result.stderr??'');await writeFile(new URL('native-'+label+'.log',output),JSON.stringify({exit:result.status,signal:result.signal,error:result.error?.message})+'\n'+text);
    const {errors}=verifyNativeFixtureResult(result,expectErrors);if(!expectErrors)assert((await stat(join(base.destination,base.rootDirectory,'.godot/editor'))).isDirectory());
    checks.push({check:'Verified Godot4.7.2 '+(expectErrors?'reports the exact trusted negative scene failure':'imports the trusted positive fixture'),passed:true,exit:result.status,expectedErrors:expectErrors,actualErrors:errors});
   }
  }
 }catch(e){failure=String(e);console.error(e);}
 finally{await rm(temp,{recursive:true,force:true});await writeFile(new URL('fixture-report.json',output),JSON.stringify({passed:!failure,checks,failure,scope:'Static source inspection and optional verified native editor on hard-coded trusted synthetic fixtures only. No creator scripts/plugins/binaries executed; not a packaged game, production or AAA check.'},null,2));}
 console.log(JSON.stringify({passed:!failure,checks,failure}));if(failure)process.exitCode=1;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
