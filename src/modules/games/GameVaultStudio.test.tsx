import {beforeEach,afterEach,test,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import Studio from './GameVaultStudio';
import {GameVaultDraftProvider} from './GameVaultDraft';
import {emptyVault,newProject} from '../../../shared/game-vault.mjs';
vi.mock('../../../shared/game-vault.mjs',async original=>({...await original<typeof import('../../../shared/game-vault.mjs')>(),vaultDigest:async()=>'synthetic-digest'}));
const initial=(owner='a')=>({ownerId:owner,revision:0,vault:emptyVault(),sha256:'synthetic-digest',updatedAt:null as string|null});
let state=initial(),writes:Record<string,unknown>[];
beforeEach(()=>{state=initial();writes=[];vi.stubGlobal('fetch',vi.fn(async(url,init)=>{
 if(String(url).endsWith('/auth/me'))return Response.json({user:{id:state.ownerId},csrfToken:'synthetic-csrf'});
 if(init?.method==='PUT'){const body=JSON.parse(init.body as string);writes.push(body);state={...state,revision:state.revision+1,vault:body.vault};return Response.json({...state,savedRevision:state.revision});}
 return Response.json(state);
}));});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function open(){render(<Studio ownerId="a" onAccount={vi.fn()}/>);await screen.findByRole('button',{name:'Create project'});}
function create(){fireEvent.click(screen.getByRole('button',{name:'Create project'}));fireEvent.change(screen.getByLabelText('Project title'),{target:{value:'Accra project'}});fireEvent.change(screen.getByLabelText('Story Bible'),{target:{value:'Original story'}});}
async function save(){fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Save project'}));await screen.findByText('Project Vault saved by the server.');}
test('guest neither loads source nor offers false projects',()=>{const account=vi.fn();render(<Studio ownerId={null} onAccount={account}/>);fireEvent.click(screen.getByText('Open EcoVibes ID'));expect(account).toHaveBeenCalledOnce();expect(fetch).not.toHaveBeenCalled();});
test('creates edits and uploads source only after explicit save consent',async()=>{await open();create();expect(screen.getByRole('combobox',{name:/^Engine$/})).toBeTruthy();fireEvent.change(screen.getByLabelText('New file path'),{target:{value:'scripts/main.gd'}});fireEvent.click(screen.getByText('Add empty text file'));fireEvent.change(screen.getByLabelText('Source: scripts/main.gd'),{target:{value:'extends Node3D\n'}});expect(writes).toHaveLength(0);expect((screen.getByText('Save project') as HTMLButtonElement).disabled).toBe(true);await save();expect(writes[0].consent).toBe('private-storage-v1');expect((writes[0].vault as ReturnType<typeof emptyVault>).projects[0].files[0].content).toBe('extends Node3D\n');expect(screen.getByText('Server-saved project')).toBeTruthy();});
test('failed save keeps source and stable operation retry',async()=>{await open();create();const original=vi.mocked(fetch).getMockImplementation()!;let failed=false;vi.mocked(fetch).mockImplementation(async(url,init)=>{if(init?.method==='PUT'&&!failed){failed=true;writes.push(JSON.parse(init.body as string));return Response.json({error:{message:'Temporary outage'}},{status:503});}return original(url,init);});fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByText('Save project'));expect((await screen.findByRole('alert')).textContent).toContain('draft remains');expect((screen.getByLabelText('Story Bible') as HTMLTextAreaElement).value).toBe('Original story');expect(screen.queryByText('Project Vault saved by the server.')).toBeNull();fireEvent.click(screen.getByText('Save project'));await screen.findByText('Project Vault saved by the server.');expect(writes[0].operationId).toBe(writes[1].operationId);});
test('invalid oversized source fails visibly without a stuck save or page error',async()=>{await open();create();fireEvent.change(screen.getByLabelText('New file path'),{target:{value:'main.gd'}});fireEvent.click(screen.getByText('Add empty text file'));fireEvent.change(screen.getByLabelText('Source: main.gd'),{target:{value:'é'.repeat(20000)}});fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByText('Save project'));expect((await screen.findByRole('alert')).textContent).toMatch(/32 KB/);expect(writes).toHaveLength(0);expect((screen.getByLabelText('Project title') as HTMLInputElement).disabled).toBe(false);});
test('new session owner prevents transmission and hides old source',async()=>{await open();create();vi.mocked(fetch).mockResolvedValueOnce(Response.json({user:{id:'b'},csrfToken:'other'}));fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByText('Save project'));await screen.findByText('The account changed. This workspace is hidden.');expect(writes).toHaveLength(0);expect(screen.queryByLabelText('Story Bible')).toBeNull();});
test('late account-A load never appears after switching to B',async()=>{let resolve:(r:Response)=>void=()=>{};vi.mocked(fetch).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));const view=render(<Studio ownerId="a" onAccount={vi.fn()}/>);state=initial('b');view.rerender(<Studio ownerId="b" onAccount={vi.fn()}/>);await screen.findByRole('button',{name:'Create project'});resolve(Response.json({...initial(),vault:{...emptyVault(),projects:[newProject('Private A')]}}));await waitFor(()=>expect(screen.queryByText('Private A')).toBeNull());});
test('checkpoints restore saved source into a draft before server save',async()=>{await open();create();await save();fireEvent.change(screen.getByLabelText('Checkpoint label'),{target:{value:'First checkpoint'}});fireEvent.click(screen.getByText('Prepare checkpoint'));expect(screen.getByText('Unsaved draft')).toBeTruthy();await save();fireEvent.change(screen.getByLabelText('Story Bible'),{target:{value:'Changed story'}});fireEvent.click(screen.getByText('Preview checkpoint First checkpoint'));const dialog=screen.getByRole('dialog',{name:'Checkpoint preview'});expect(dialog).toBeTruthy();fireEvent.click(screen.getByText('Load checkpoint draft'));expect((screen.getByLabelText('Story Bible') as HTMLTextAreaElement).value).toBe('Original story');expect(screen.getByText('Unsaved draft')).toBeTruthy();expect(writes).toHaveLength(2);});
test('removing a project requires confirmation and server acknowledgement',async()=>{await open();create();await save();fireEvent.click(screen.getByText('Remove project from Vault'));expect(writes).toHaveLength(1);fireEvent.click(screen.getByText('Confirm removal'));await screen.findByText('No projects saved. Create one to start.');expect(state.vault.projects).toEqual([]);expect(writes).toHaveLength(2);expect(document.activeElement).toBe(screen.getByText('Create project'));});
test('reload requires explicit discard and can recover a conflicted initially empty Vault',async()=>{await open();create();const before=vi.mocked(fetch).mock.calls.length;fireEvent.click(screen.getByText('Reload saved projects'));expect(screen.getByRole('dialog',{name:'Discard draft and reload'})).toBeTruthy();expect(vi.mocked(fetch).mock.calls.length).toBe(before);fireEvent.click(screen.getByText('Keep current work'));expect((screen.getByLabelText('Story Bible') as HTMLTextAreaElement).value).toBe('Original story');state={...state,revision:1,vault:{...emptyVault(),projects:[newProject('Other device')]}};fireEvent.click(screen.getByText('Reload saved projects'));fireEvent.click(screen.getByText('Discard draft and reload'));await screen.findByText('Other device');expect(screen.queryByLabelText('Story Bible')).toBeNull();});
test('selected files are local drafts; malformed paths do not partially import',async()=>{await open();create();const selected={name:'source.gd',size:7,arrayBuffer:async()=>new TextEncoder().encode('source\n').buffer};fireEvent.change(screen.getByLabelText('Choose text source files'),{target:{files:[selected]}});await screen.findByLabelText('Source: source.gd');expect(writes).toHaveLength(0);fireEvent.change(screen.getByLabelText('Choose text source files'),{target:{files:[{...selected,name:'../private.gd'}]}});await screen.findByRole('alert');expect(screen.getByLabelText('Source: source.gd')).toBeTruthy();expect(writes).toHaveLength(0);});

test('pending selected-file reads block saving an older draft',async()=>{
 await open();create();fireEvent.click(screen.getByRole('checkbox'));
 let finish:(b:ArrayBuffer)=>void=()=>{};const file={name:'late.gd',size:7,arrayBuffer:()=>new Promise<ArrayBuffer>(resolve=>{finish=resolve;})};
 fireEvent.change(screen.getByLabelText('Choose text source files'),{target:{files:[file]}});
 expect((screen.getByText('Save project') as HTMLButtonElement).disabled).toBe(true);expect(writes).toHaveLength(0);
 finish(new TextEncoder().encode('source\n').buffer);await screen.findByLabelText('Source: late.gd');
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByText('Save project'));await screen.findByText('Project Vault saved by the server.');
 expect((writes[0].vault as ReturnType<typeof emptyVault>).projects[0].files[0].path).toBe('late.gd');
});

test('unsaved draft resumes after internal navigation without silently rebasing, and never crosses accounts',async()=>{
 const view=render(<GameVaultDraftProvider key="a" ownerId="a"><Studio ownerId="a" onAccount={vi.fn()}/></GameVaultDraftProvider>);await screen.findByText('Create project');create();
 view.rerender(<GameVaultDraftProvider key="a" ownerId="a"><p>Another page</p></GameVaultDraftProvider>);
 state={...state,revision:1,vault:{...emptyVault(),projects:[newProject('Other device')]}};
 view.rerender(<GameVaultDraftProvider key="a" ownerId="a"><Studio ownerId="a" onAccount={vi.fn()}/></GameVaultDraftProvider>);
 await screen.findByText('Create project');expect((screen.getByLabelText('Story Bible') as HTMLTextAreaElement).value).toBe('Original story');fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByText('Save project'));await waitFor(()=>expect(writes).toHaveLength(1));expect(writes[0].revision).toBe(0);
 state=initial('b');view.rerender(<GameVaultDraftProvider key="b" ownerId="b"><Studio ownerId="b" onAccount={vi.fn()}/></GameVaultDraftProvider>);await screen.findByText('Create project');expect(screen.queryByLabelText('Story Bible')).toBeNull();expect(screen.queryByText('Accra project')).toBeNull();
});
test('removal cancellation and Escape restore focus to the connected opener',async()=>{
 await open();create();await save();const opener=screen.getByText('Remove project from Vault');opener.focus();fireEvent.click(opener);fireEvent.click(screen.getByText('Keep current work'));expect(document.activeElement).toBe(opener);fireEvent.click(opener);fireEvent.keyDown(document,{key:'Escape'});expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(opener);
});

test('clean selections refresh to the verified server head after navigation',async()=>{
 const view=render(<GameVaultDraftProvider ownerId="a"><Studio ownerId="a" onAccount={vi.fn()}/></GameVaultDraftProvider>);await screen.findByText('Create project');create();await save();
 view.rerender(<GameVaultDraftProvider ownerId="a"><p>Another page</p></GameVaultDraftProvider>);
 state={...state,revision:2,vault:{...state.vault,projects:state.vault.projects.map(p=>({...p,story:'New verified head'}))}};
 view.rerender(<GameVaultDraftProvider ownerId="a"><Studio ownerId="a" onAccount={vi.fn()}/></GameVaultDraftProvider>);await screen.findByText('Saved revision 2');expect((screen.getByLabelText('Story Bible') as HTMLTextAreaElement).value).toBe('New verified head');
 view.rerender(<GameVaultDraftProvider ownerId="a"><p>Another page</p></GameVaultDraftProvider>);state={...state,revision:3,vault:emptyVault()};view.rerender(<GameVaultDraftProvider ownerId="a"><Studio ownerId="a" onAccount={vi.fn()}/></GameVaultDraftProvider>);await screen.findByText('Saved revision 3');expect(screen.queryByLabelText('Story Bible')).toBeNull();
});

test('discard reload at project capacity focuses enabled Reload and consumes the focus request',async()=>{
 await open();create();state={...state,revision:1,vault:{...emptyVault(),projects:Array.from({length:5},(_,i)=>newProject('Saved '+i))}};fireEvent.click(screen.getByText('Reload saved projects'));fireEvent.click(screen.getByText('Discard draft and reload'));await screen.findByText('Saved revision 1');expect((screen.getByText('Create project') as HTMLButtonElement).disabled).toBe(true);expect(document.activeElement).toBe(screen.getByText('Reload saved projects'));
 fireEvent.click(screen.getByText('Saved 0'));const title=screen.getByLabelText('Project title');title.focus();fireEvent.change(title,{target:{value:'New title'}});await save();expect(document.activeElement).not.toBe(screen.getByText('Reload saved projects'));
});

function mockDownloads(){
 const createObjectURL=vi.fn((_blob:Blob)=> 'blob:synthetic-project-export'),revokeObjectURL=vi.fn(),OriginalURL=URL;
 vi.stubGlobal('URL',class extends OriginalURL{static createObjectURL=createObjectURL;static revokeObjectURL=revokeObjectURL;});
 const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 return {createObjectURL,revokeObjectURL,click};
}
function addSource(path='scripts/main.gd',content='extends Node3D\n'){
 fireEvent.change(screen.getByLabelText('New file path'),{target:{value:path}});fireEvent.click(screen.getByText('Add empty text file'));fireEvent.change(screen.getByLabelText('Source: '+path),{target:{value:content}});
}
test('project ZIP download includes the current draft without saving or clearing separate storage consent',async()=>{
 const downloads=mockDownloads();await open();create();addSource();fireEvent.click(screen.getByRole('checkbox'));const before=vi.mocked(fetch).mock.calls.length;
 fireEvent.click(screen.getByRole('button',{name:'Export draft source ZIP'}));expect(downloads.click).toHaveBeenCalledOnce();const anchor=downloads.click.mock.instances[0] as HTMLAnchorElement;expect(anchor.download).toMatch(/^ecogames-[0-9a-f-]+\.zip$/);expect(anchor.href).toBe('blob:synthetic-project-export');expect(downloads.createObjectURL.mock.calls[0][0].type).toBe('application/zip');expect(anchor.isConnected).toBe(false);
 expect(writes).toHaveLength(0);expect(vi.mocked(fetch).mock.calls.length).toBe(before);expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);expect(screen.getByText('Unsaved draft')).toBeTruthy();expect(screen.getByRole('status').textContent).toMatch(/download requested.*Vault unchanged/i);
 fireEvent.click(screen.getByRole('button',{name:'Save project'}));await screen.findByText('Project Vault saved by the server.');fireEvent.click(screen.getByRole('button',{name:'Export project source ZIP'}));expect(downloads.click).toHaveBeenCalledTimes(2);expect(writes).toHaveLength(1);
});
test('empty or nonportable source fails visibly without a partial download or draft loss',async()=>{
 const downloads=mockDownloads();await open();create();fireEvent.click(screen.getByRole('button',{name:'Export draft source ZIP'}));expect(screen.getByRole('alert').textContent).toMatch(/source file/i);addSource('CON.gd');fireEvent.click(screen.getByRole('button',{name:'Export draft source ZIP'}));expect(screen.getByRole('alert').textContent).toMatch(/portable/i);expect(downloads.click).not.toHaveBeenCalled();expect(writes).toHaveLength(0);expect((screen.getByLabelText('Source: CON.gd') as HTMLTextAreaElement).value).toBe('extends Node3D\n');expect(screen.getByRole('status').textContent).not.toContain('download requested');
});
test('browser download failure keeps source and does not report a completed or requested export',async()=>{
 const downloads=mockDownloads();downloads.createObjectURL.mockImplementation(()=>{throw Error('Downloads unavailable in this browser.');});await open();create();addSource();fireEvent.click(screen.getByRole('button',{name:'Export draft source ZIP'}));expect(screen.getByRole('alert').textContent).toContain('Downloads unavailable');expect(downloads.click).not.toHaveBeenCalled();expect(writes).toHaveLength(0);expect((screen.getByLabelText('Source: scripts/main.gd') as HTMLTextAreaElement).value).toBe('extends Node3D\n');expect(screen.getByRole('status').textContent).not.toContain('download requested');
});
test('pending file reads cannot export an older incomplete draft',async()=>{
 const downloads=mockDownloads();await open();create();addSource();let finish:(b:ArrayBuffer)=>void=()=>{};fireEvent.change(screen.getByLabelText('Choose text source files'),{target:{files:[{name:'late.gd',size:7,arrayBuffer:()=>new Promise<ArrayBuffer>(resolve=>{finish=resolve;})}]}});
 expect(screen.getByRole('button',{name:'Export draft source ZIP'}).matches(':disabled')).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Export draft source ZIP'}));expect(downloads.click).not.toHaveBeenCalled();finish(new TextEncoder().encode('source\n').buffer);await screen.findByLabelText('Source: late.gd');expect(screen.getByRole('button',{name:'Export draft source ZIP'}).matches(':disabled')).toBe(false);
});
test('switching accounts removes access to the previous project export',async()=>{
 const downloads=mockDownloads(),view=render(<Studio ownerId="a" onAccount={vi.fn()}/>);await screen.findByRole('button',{name:'Create project'});create();addSource();state=initial('b');view.rerender(<Studio ownerId="b" onAccount={vi.fn()}/>);await screen.findByRole('button',{name:'Create project'});expect(screen.queryByRole('button',{name:/source ZIP/})).toBeNull();expect(downloads.click).not.toHaveBeenCalled();
});
