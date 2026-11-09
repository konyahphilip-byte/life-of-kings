// @vitest-environment node
import {test,expect,vi} from 'vitest';
import {newProject,emptyVault,normalizeVault} from './game-vault.mjs';
import {projectSourceArchive} from './game-project-export.mjs';
import {planSourceFolder,readSourceFolder} from './game-folder-import.mjs';
function file(path,content='source\n'){const data=new TextEncoder().encode(content);return {name:path.split('/').at(-1),webkitRelativePath:path,size:data.length,arrayBuffer:vi.fn(async()=>data.slice().buffer)};}
const paths=plan=>plan.entries.map(e=>e.path);
test('folder preview reads metadata only, strips one root and skips hidden/cache/non-source items',()=>{
 const selected=[file('My Game 🌍/project.godot'),file('My Game 🌍/scripts/main.gd'),file('My Game 🌍/.env'),file('My Game 🌍/.godot/cache.txt'),file('My Game 🌍/node_modules/lib/index.js'),file('My Game 🌍/art/car.png')],plan=planSourceFolder(selected);
 expect(plan.root).toBe('My Game 🌍');expect(paths(plan)).toEqual(['project.godot','scripts/main.gd']);expect(plan.skipped).toBe(4);for(const f of selected)expect(f.arrayBuffer).not.toHaveBeenCalled();
});
test('reads only explicitly selected source with exact BOM/CRLF/emoji/empty bytes and no mutation',async()=>{
 const selected=[file('Game/scripts/main.gd','\uFEFF# Akwaaba 🌍\r\n'),file('Game/scenes/empty.tscn',''),file('Game/settings.json','PRIVATE NOT SELECTED')],plan=planSourceFolder(selected),project=newProject(),before=structuredClone(project);
 const result=await readSourceFolder(plan,['scripts/main.gd','scenes/empty.tscn'],project);
 expect(result).toEqual([{path:'scenes/empty.tscn',content:''},{path:'scripts/main.gd',content:'\uFEFF# Akwaaba 🌍\r\n'}]);expect(project).toEqual(before);expect(selected[2].arrayBuffer).not.toHaveBeenCalled();expect(projectSourceArchive({...project,files:result}).sourceFiles).toBe(2);
});
test.each(['Game/../escape.gd','/Game/main.gd','C:/Game/main.gd','Game/folder\\escape.gd','Game/CON.gd','Game/folder./main.gd','Game/ main.gd','Game/a//main.gd','Game/x/%2e%2e/main.gd'])('unsafe folder path is rejected before reading %s',path=>{const f=file(path);expect(()=>planSourceFolder([f])).toThrow();expect(f.arrayBuffer).not.toHaveBeenCalled();});
test('requires actual relative folder metadata, one root and matching leaf names',()=>{for(const list of [[{...file('Game/main.gd'),webkitRelativePath:''}],[file('One/a.gd'),file('Two/b.gd')],[{...file('Game/a.gd'),name:'b.gd'}],[file('Game/a.gd'),file('Game/a.gd')]])expect(()=>planSourceFolder(list)).toThrow();});
test('metadata and source limits are bounded before source reads',async()=>{
 expect(()=>planSourceFolder({length:1001})).toThrow(/1000/);
 expect(()=>planSourceFolder(Array.from({length:101},(_,i)=>file('Game/f'+i+'.gd')))).toThrow(/100/);
 const selected=Array.from({length:21},(_,i)=>file('Game/f'+i+'.gd')),plan=planSourceFolder(selected);
 await expect(readSourceFolder(plan,paths(plan),newProject())).rejects.toThrow(/20/);for(const f of selected)expect(f.arrayBuffer).not.toHaveBeenCalled();
 const big=file('Game/big.gd');big.size=32769;const bigPlan=planSourceFolder([big]);await expect(readSourceFolder(bigPlan,paths(bigPlan),newProject())).rejects.toThrow(/32 KB/);expect(big.arrayBuffer).not.toHaveBeenCalled();
});
test('rejects empty, duplicate or forged selections without reading anything',async()=>{const f=file('Game/a.gd'),plan=planSourceFolder([f]);for(const selected of [[],['a.gd','a.gd'],['other.gd']])await expect(readSourceFolder(plan,selected,newProject())).rejects.toThrow();expect(f.arrayBuffer).not.toHaveBeenCalled();});
test('rejects current-project collisions, directory aliases and combined caps before reads',async()=>{
 for(const [old,path] of [['main.gd','Main.gd'],['part.gd','part.gd/other.gd'],['Scripts/old.gd','scripts/new.gd']]){
  const f=file('Game/'+path),plan=planSourceFolder([f]);await expect(readSourceFolder(plan,paths(plan),{...newProject(),files:[{path:old,content:'keep'}]})).rejects.toThrow();expect(f.arrayBuffer).not.toHaveBeenCalled();
 }
 const selected=Array.from({length:5},(_,i)=>file('Game/f'+i+'.gd','a'.repeat(30000))),plan=planSourceFolder(selected);await expect(readSourceFolder(plan,paths(plan),newProject())).rejects.toThrow(/128 KB/);for(const f of selected)expect(f.arrayBuffer).not.toHaveBeenCalled();
});
test('bad UTF-8, changed byte count, forbidden controls and revoked access reject atomically',async()=>{
 const first=file('Game/a.gd','keep'),bad=file('Game/b.gd','x');
 for(const read of [async()=>Uint8Array.from([255]).buffer,async()=>new Uint8Array(2).buffer,async()=>Uint8Array.from([0]).buffer,async()=>{throw Error('Private OS detail');}]){
  bad.arrayBuffer.mockImplementation(read);const plan=planSourceFolder([first,bad]);await expect(readSourceFolder(plan,paths(plan),newProject())).rejects.toThrow();expect(plan.entries).toHaveLength(2);
 }
});
test('changed file metadata cannot retarget a preview',async()=>{const f=file('Game/main.gd'),plan=planSourceFolder([f]);f.webkitRelativePath='Game/other.gd';await expect(readSourceFolder(plan,paths(plan),newProject())).rejects.toThrow(/changed/i);expect(f.arrayBuffer).not.toHaveBeenCalled();});
test('cancel before or during a read prevents any next source read',async()=>{
 const first=file('Game/a.gd'),second=file('Game/b.gd'),plan=planSourceFolder([first,second]),already=new AbortController();already.abort();await expect(readSourceFolder(plan,paths(plan),newProject(),already.signal)).rejects.toThrow(/cancel/i);expect(first.arrayBuffer).not.toHaveBeenCalled();
 let finish;first.arrayBuffer.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const controller=new AbortController(),pending=readSourceFolder(plan,paths(plan),newProject(),controller.signal);await vi.waitFor(()=>expect(first.arrayBuffer).toHaveBeenCalledOnce());controller.abort();await expect(pending).rejects.toThrow(/cancel/i);finish(new TextEncoder().encode('source\n').buffer);await Promise.resolve();expect(second.arrayBuffer).not.toHaveBeenCalled();
});
test('unselected oversized files stay metadata only; caller can enforce full multi-project Vault cap',async()=>{
 const a=file('Game/main.gd','a'.repeat(30000)),big=file('Game/unused.gd');big.size=999999;const plan=planSourceFolder([a,big]),project=newProject();const incoming=await readSourceFolder(plan,['main.gd'],project);expect(big.arrayBuffer).not.toHaveBeenCalled();
 const other=newProject('Other');other.files=Array.from({length:4},(_,i)=>({path:'f'+i+'.gd',content:'b'.repeat(25000)}));expect(()=>normalizeVault({...emptyVault(),projects:[other,{...project,files:incoming}]})).toThrow(/128 KB/);
});
