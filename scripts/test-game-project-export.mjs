import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir,mkdtemp,rm,writeFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {projectSourceArchive} from '../shared/game-project-export.mjs';

export function fixtureProject(){
 return {id:'e55aff0a-c464-4a8f-9797-961f91efed01',title:'Synthetic local engine project',engine:'godot',story:'Private story excluded from source ZIP',checkpoints:[],files:[
 {path:'project.godot',content:'config_version=5\n\n[application]\nconfig/name="EcoGames ZIP fixture"\nrun/main_scene="res://scenes/main.tscn"\n\n[rendering]\nrenderer/rendering_method="gl_compatibility"\n'},
 {path:'scenes/main.tscn',content:'[gd_scene load_steps=2 format=3]\n\n[ext_resource type="Script" path="res://scripts/main.gd" id="1"]\n\n[node name="ExportFixture" type="Node3D"]\nscript = ExtResource("1")\n'},
 {path:'scripts/main.gd',content:'extends Node3D\n# Akwaaba 🌍 — trusted synthetic source\n'},
 {path:'notes/empty.txt',content:''},
 {path:'notes/source.txt',content:'\uFEFFPreserve BOM, tabs\tand CRLF.\r\n'}
 ]};
}
// An independent standard-library ZIP reader verifies CRC, attributes and extracted bytes.
export async function verifyExtractedArchive(bytes,project,directory){
 await mkdir(directory,{recursive:true});
 const archive=join(directory,'source.zip'),destination=join(directory,'extracted');
 await writeFile(archive,bytes);
 const root='ecogames-'+project.id.toLowerCase(),expected=Object.fromEntries(project.files.map(f=>[root+'/'+f.path,Buffer.from(f.content,'utf8').toString('hex')]));
 const python=spawnSync('python3',['-c',`import sys,json,zipfile,stat,pathlib,hashlib
archive,destination=sys.argv[1:]
expected=json.load(sys.stdin)
base=pathlib.Path(destination)
base.mkdir()
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None, "ZIP CRC mismatch"
    names=z.namelist()
    assert sorted(names)==sorted(expected), "Unexpected or missing source path"
    assert len(names)==len(set(names)), "Duplicate archive names"
    for info in z.infolist():
        path=base.joinpath(info.filename)
        assert base.resolve() in path.resolve().parents, "Escaping source path"
        assert not info.is_dir() and info.compress_type==zipfile.ZIP_STORED
        assert info.flag_bits & 0x800 and not info.flag_bits & 1
        assert stat.S_IFMT(info.external_attr >> 16)==stat.S_IFREG
        assert stat.S_IMODE(info.external_attr >> 16)==0o644
        assert z.read(info)==bytes.fromhex(expected[info.filename]), "Changed UTF-8 bytes"
    z.extractall(base)
actual={p.relative_to(base).as_posix():p for p in base.rglob("*") if p.is_file()}
assert sorted(actual)==sorted(expected), "Extraction changed folder paths"
for name,path in actual.items():
    assert not path.is_symlink()
    assert path.read_bytes()==bytes.fromhex(expected[name]), "Extraction changed source"
print(json.dumps({"files":len(expected),"archiveBytes":pathlib.Path(archive).stat().st_size,"sha256":hashlib.sha256(pathlib.Path(archive).read_bytes()).hexdigest()}))
`,archive,destination],{input:JSON.stringify(expected),encoding:'utf8',timeout:10000,maxBuffer:10000});
 assert.equal(python.status,0,'Independent ZIP extraction failed: '+python.stderr);
 return {...JSON.parse(python.stdout),destination,rootDirectory:root};
}
async function main(){
 const output=new URL('../work/ecogames-project-export-20261108/',import.meta.url);await mkdir(output,{recursive:true});
 const temp=await mkdtemp(join(tmpdir(),'eco-project-export-')),checks=[];let failure;
 try{
  const project=fixtureProject(),archive=projectSourceArchive(project),verified=await verifyExtractedArchive(archive.bytes,project,join(temp,'engine'));
  checks.push({check:'Standard Python ZIP reader extracts nested source with exact UTF-8 bytes and regular file permissions',...verified,destination:undefined,passed:true});
  const many={...project,files:Array.from({length:20},(_,i)=>({path:'folder'+i+'/nested/file.gd',content:'#'+String(i)+'x'.repeat(5000)+'\r\n'}))},large=projectSourceArchive(many);
  const verifiedLarge=await verifyExtractedArchive(large.bytes,many,join(temp,'bounded'));checks.push({check:'Twenty-file near-cap archive extracts without paths or content changing',...verifiedLarge,destination:undefined,passed:true});
  if(process.env.GODOT_BIN){
   // Require an explicitly configured portable editor; never alter a user's engine or home.
   await writeFile(new URL('engine-import.log',output),'No engine process started; checking explicit portable editor.\n');
   const marker=join(process.platform==='darwin'?resolve(dirname(process.env.GODOT_BIN),'../../..'):dirname(process.env.GODOT_BIN),'_sc_');assert((await stat(marker)).isFile(),'Use a task-local Godot editor configured for self-contained mode.');
   // Only this script-owned fixture is imported. Uploaded creator projects are never executed.
   // Preserve the existing platform HOME unchanged for OS user:// resolution; never redirect it.
   const engine=spawnSync(process.env.GODOT_BIN,['--headless','--editor','--path',join(verified.destination,archive.rootDirectory),'--import'],{encoding:'utf8',timeout:45000,maxBuffer:20000,env:{PATH:process.env.PATH,...(process.env.HOME?{HOME:process.env.HOME}:{})}});
   await writeFile(new URL('engine-import.log',output),JSON.stringify({exit:engine.status,signal:engine.signal,error:engine.error?.message})+'\n'+(engine.stdout??'')+(engine.stderr??''));
   assert.equal(engine.status,0,'Installed engine rejected the trusted extracted fixture: '+engine.stderr);
   assert(!/(?:SCRIPT ERROR:|Parse Error:|ERROR:)/.test(engine.stdout+engine.stderr),'Engine import reported an error.');
   assert((await stat(join(verified.destination,archive.rootDirectory,'.godot/editor'))).isDirectory(),'Engine did not create the imported project editor cache.');
   checks.push({check:'Explicitly selected self-contained Godot imports trusted extracted fixture',passed:true,exit:engine.status});
  }else checks.push({check:'Native local engine import',status:'UNVERIFIED',reason:'No existing Godot binary selected; no download, installation or creator-source execution.'});
 }catch(e){failure=String(e);console.error(e);}
 finally{await rm(temp,{recursive:true,force:true});await writeFile(new URL('archive-roundtrip.json',output),JSON.stringify({passed:!failure,checks,failure,scope:'Synthetic trusted text sources and independent ZIP extraction; not creator assets, production data or a playable build.'},null,2));}
 console.log(JSON.stringify({passed:!failure,checks,failure}));if(failure)process.exitCode=1;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
