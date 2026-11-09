// @vitest-environment node
import {test,expect} from 'vitest';
import {emptyVault,newProject} from './game-vault.mjs';
import {projectSourceArchive,PROJECT_ZIP_BYTES} from './game-project-export.mjs';
const project=()=>({...newProject('Portable circuit'),id:'e55aff0a-c464-4a8f-9797-961f91efed01',story:'PRIVATE STORY OMITTED',checkpoints:[],files:[{path:'project.godot',content:'config_version=5\r\n'},{path:'scripts/main.gd',content:'extends Node3D\n# Akwaaba 🌍\n'},{path:'scenes/empty.tscn',content:''}]});
function entries(bytes){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),result=[];let p=0;
 while(v.getUint32(p,true)===0x04034b50){const length=v.getUint32(p+18,true),nameSize=v.getUint16(p+26,true),extra=v.getUint16(p+28,true),name=new TextDecoder().decode(bytes.slice(p+30,p+30+nameSize));const start=p+30+nameSize+extra;result.push({name,data:bytes.slice(start,start+length),crc:v.getUint32(p+14,true),flags:v.getUint16(p+6,true),method:v.getUint16(p+8,true)});p=start+length;}return result;
}
test('exports exactly current project source under a stable safe root with preserved folder paths and UTF-8 bytes',()=>{
 const p=project(),result=projectSourceArchive(p),files=entries(result.bytes);
 expect(result.rootDirectory).toBe('ecogames-'+p.id);expect(result.filename).toBe(result.rootDirectory+'.zip');expect(result.engineEntryPoint).toBe(result.rootDirectory+'/project.godot');expect(files.map(f=>f.name)).toEqual([...p.files].sort((a,b)=>a.path<b.path?-1:1).map(f=>result.rootDirectory+'/'+f.path));
 for(const source of p.files)expect(files.find(f=>f.name.endsWith('/'+source.path)).data).toEqual(new TextEncoder().encode(source.content));
 expect(files.every(f=>f.flags===0x0800&&f.method===0)).toBe(true);expect(result.sourceFiles).toBe(3);expect(result.bytes.byteLength).toBeLessThan(PROJECT_ZIP_BYTES);
 expect(new TextDecoder().decode(result.bytes)).not.toContain('PRIVATE STORY OMITTED');
});
test('archive does not change the project, include checkpoint source or generate missing files',()=>{
 const p=project();p.checkpoints=[{id:crypto.randomUUID(),label:'Private checkpoint',at:'2026-11-08T00:00:00Z',title:'Old',engine:'godot',story:'Old private note',files:[{path:'private.gd',content:'PRIVATE CHECKPOINT OMITTED'}]}];const before=structuredClone(p),result=projectSourceArchive(p);expect(p).toEqual(before);expect(new TextDecoder().decode(result.bytes)).not.toContain('PRIVATE CHECKPOINT OMITTED');expect(entries(result.bytes)).toHaveLength(3);
});
test('stable bytes despite file ordering and project metadata changes',()=>{const p=project();expect(projectSourceArchive({...p,files:[...p.files].reverse(),title:'A different title',story:'Changed note'}).bytes).toEqual(projectSourceArchive(p).bytes);});
test('empty source cannot claim an engine project export',()=>{expect(()=>projectSourceArchive({...project(),files:[]})).toThrow(/source file/i);});
test.each(['../escape.gd','/absolute.gd','C:/drive.gd','nested/../../escape.gd','folder\\escape.gd','.godot/editor.txt','x/%2e%2e/escape.gd','x/con.gd','AUX.json','nested/NUL.txt','com1.gd','LPT9.ts','folder./main.gd',' main.gd '])('rejects nonportable or escaping archive path %s',path=>{expect(()=>projectSourceArchive({...project(),files:[{path,content:'not written'}]})).toThrow();});
test('rejects case duplicates, file/folder aliases and inconsistent directory spelling',()=>{for(const paths of [['Main.gd','main.gd'],['part.gd','part.gd/other.gd'],['Scripts/main.gd','scripts/other.gd']])expect(()=>projectSourceArchive({...project(),files:paths.map(path=>({path,content:''}))})).toThrow();});
test('rejects lossy Unicode source but preserves BOM, CRLF and valid surrogate pairs',()=>{
 const p={...project(),files:[{path:'main.gd',content:'\uFEFF# Akwaaba 🌍\r\n'}]};expect(entries(projectSourceArchive(p).bytes)[0].data).toEqual(new TextEncoder().encode(p.files[0].content));
 for(const bad of ['\ud800','\udc00','a\ud800z'])expect(()=>projectSourceArchive({...p,files:[{path:'main.gd',content:bad}]})).toThrow(/UTF-8/i);
});
test('enforces existing file and combined-project caps before allocating an archive',()=>{expect(()=>projectSourceArchive({...project(),files:[{path:'main.gd',content:'é'.repeat(20000)}]})).toThrow(/32 KB/);expect(()=>projectSourceArchive({...project(),files:Array.from({length:21},(_,i)=>({path:'file'+i+'.gd',content:''}))})).toThrow();});
test('uses standard CRC32 and regular nonexecutable file attributes, never symlinks',()=>{const p={...project(),files:[{path:'vector.txt',content:'123456789'}]},result=projectSourceArchive(p),v=new DataView(result.bytes.buffer);expect(entries(result.bytes)[0].crc).toBe(0xcbf43926);const central=30+result.rootDirectory.length+1+'vector.txt'.length+9;expect(v.getUint32(central,true)).toBe(0x02014b50);expect(v.getUint32(central+38,true)>>>16).toBe(0o100644);});
test('missing root Godot configuration stays a source-only archive without invented setup',()=>{const result=projectSourceArchive({...project(),files:[{path:'scripts/main.gd',content:'extends Node3D\n'}]});expect(result.engineEntryPoint).toBeNull();expect(entries(result.bytes).map(e=>e.name)).toEqual([result.rootDirectory+'/scripts/main.gd']);});
test('does not accept an entire multi-project Vault as a project export',()=>{expect(()=>projectSourceArchive({...emptyVault(),projects:[project()]})).toThrow();});
