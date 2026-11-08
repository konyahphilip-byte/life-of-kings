// @vitest-environment node
import {test,expect} from 'vitest';
import {emptyVault,newProject,normalizeVault,exportBackup,readBackup,mergeVault,checkpointProject,restoreCheckpoint} from './game-vault.mjs';
const p=()=>newProject('Ghana race story');
test('creates real empty project state with stable IDs and no invented builds',()=>{const v=emptyVault();expect(v.projects).toEqual([]);expect(p().files).toEqual([]);expect(p().checkpoints).toEqual([]);});
test('normalization preserves source text exactly',()=>{const project=p();project.files=[{path:'scripts/main.gd',content:'extends Node3D\n\t# user source\n'}];expect(normalizeVault({...emptyVault(),projects:[project]}).projects[0].files[0].content).toBe(project.files[0].content);});
test.each(['../secret.txt','/etc/passwd','C:\\secret.gd','folder/../../a.gd','.env','a//b.gd','a/%2e.gd'])('rejects unsafe file path %s',path=>{const project=p();project.files=[{path,content:'text'}];expect(()=>normalizeVault({...emptyVault(),projects:[project]})).toThrow();});
test('rejects duplicate project IDs and portable filename collisions',()=>{const project=p();expect(()=>normalizeVault({...emptyVault(),projects:[project,project]})).toThrow();project.files=[{path:'Main.gd',content:''},{path:'main.gd',content:''}];expect(()=>normalizeVault({...emptyVault(),projects:[project]})).toThrow();});
test('rejects binary/control content and unsupported authority fields',()=>{const project=p();project.files=[{path:'a.gd',content:'\0binary'}];expect(()=>normalizeVault({...emptyVault(),projects:[project]})).toThrow();expect(()=>normalizeVault({...emptyVault(),ownerId:'other'})).toThrow();});
test('backup integrity catches tampering and supports exact source roundtrip',async()=>{const project=p();project.story='African environment story';project.files=[{path:'scenes/main.tscn',content:'[gd_scene format=3]\n'}];const text=await exportBackup({...emptyVault(),projects:[project]});expect(await readBackup(text)).toEqual(normalizeVault({...emptyVault(),projects:[project]}));const changed=JSON.parse(text);changed.vault.projects[0].story='tampered';await expect(readBackup(JSON.stringify(changed))).rejects.toThrow(/integrity/i);});
test('duplicate backup import is harmless and conflicting project IDs never overwrite',()=>{const project=p(),v={...emptyVault(),projects:[project]};expect(mergeVault(v,v).projects).toHaveLength(1);expect(()=>mergeVault(v,{...v,projects:[{...project,title:'new'}]})).toThrow(/conflict/i);});
test('user checkpoints keep latest three and restore actual saved source',()=>{let project=p();project.story='original';project.files=[{path:'main.gd',content:'original source'}];project=checkpointProject(project,'First');const first=project.checkpoints[0].id;project.story='new';expect(restoreCheckpoint(project,first).story).toBe('original');for(let i=0;i<3;i++)project=checkpointProject(project,'Next '+i);expect(project.checkpoints).toHaveLength(3);expect(project.checkpoints.some(c=>c.id===first)).toBe(false);});
test('global and per-file limits fail closed',()=>{const project=p();project.files=[{path:'main.gd',content:'x'.repeat(32769)}];expect(()=>normalizeVault({...emptyVault(),projects:[project]})).toThrow();project.files=Array.from({length:5},(_,i)=>({path:i+'.txt',content:'x'.repeat(30000)}));expect(()=>normalizeVault({...emptyVault(),projects:[project]})).toThrow();});

test('UUID spelling cannot create duplicate identities or bypass import conflicts',()=>{
 const project={...p(),id:'123e4567-e89b-42d3-a456-426614174000'},upper={...project,id:project.id.toUpperCase()};
 expect(()=>normalizeVault({...emptyVault(),projects:[project,upper]})).toThrow();
 expect(mergeVault({...emptyVault(),projects:[project]},{...emptyVault(),projects:[upper]}).projects).toHaveLength(1);
 expect(()=>mergeVault({...emptyVault(),projects:[project]},{...emptyVault(),projects:[{...upper,title:'Conflicting'}]})).toThrow();
});
test.each([['main.gd','main.gd/child.gd'],['MAIN.gd/child.gd','main.gd']])('rejects files that also occupy directory paths',(...paths)=>{const project=p();project.files=paths.map(path=>({path,content:''}));expect(()=>normalizeVault({...emptyVault(),projects:[project]})).toThrow();});
