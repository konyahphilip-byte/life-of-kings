import {beforeEach,afterEach,expect,test,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import Hub from './GameControlHub';
import {emptyWorkspace} from '../../../shared/game-control.mjs';
const snapshot=(ownerId='a',revision=0)=>({ownerId,revision,workspace:emptyWorkspace(),history:[]});
let current=snapshot(),puts:Record<string,unknown>[];
beforeEach(()=>{current=snapshot();puts=[];vi.stubGlobal('fetch',vi.fn(async(url,init)=>{if(String(url).endsWith('/auth/me'))return Response.json({user:{id:current.ownerId},csrfToken:'synthetic-csrf'});if(init?.method==='PUT'){const body=JSON.parse(init.body as string);puts.push(body);current={...current,revision:current.revision+1,workspace:body.workspace};return Response.json(current);}return Response.json(current);}));});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function open(){render(<Hub ownerId="a" onAccount={vi.fn()}/>);await screen.findByRole('button',{name:'Save record'});}
function fill(){fireEvent.change(screen.getByLabelText('Title'),{target:{value:'First real milestone'}});fireEvent.change(screen.getByLabelText('Responsible owner'),{target:{value:'QA'}});}
test('guest tools and guide never fetch private records',()=>{const account=vi.fn();render(<Hub ownerId={null} onAccount={account}/>);fireEvent.click(screen.getByText('Open EcoVibes ID'));expect(account).toHaveBeenCalledOnce();fireEvent.click(screen.getByRole('button',{name:'Open tools'}));expect(screen.getByText('KTX-Software')).toBeTruthy();expect(fetch).not.toHaveBeenCalled();});
test('saves through existing authenticated API and confirms only acknowledged success',async()=>{await open();fill();fireEvent.click(screen.getByRole('button',{name:'Save record'}));await screen.findByText('Workspace saved by the server.');expect(puts).toHaveLength(1);expect(puts[0].expectedOwnerId).toBe('a');expect((puts[0].workspace as ReturnType<typeof emptyWorkspace>).milestones[0].title).toBe('First real milestone');});
test('failed saves preserve draft and retry uses the same operation ID',async()=>{await open();fill();let failure=true;const original=vi.mocked(fetch).getMockImplementation()!;vi.mocked(fetch).mockImplementation(async(url,init)=>{if(init?.method==='PUT'&&failure){failure=false;puts.push(JSON.parse(init.body as string));return Response.json({error:{message:'Temporary outage'}},{status:503});}return original(url,init);});fireEvent.click(screen.getByRole('button',{name:'Save record'}));expect((await screen.findByRole('alert')).textContent).toContain('draft remains');expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('First real milestone');expect(screen.queryByText('Workspace saved by the server.')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Save record'}));await screen.findByText('Workspace saved by the server.');expect(puts[0].operationId).toBe(puts[1].operationId);});
test('import previews before an explicit separate storage consent',async()=>{await open();fireEvent.click(screen.getByText('Bring in your separate Control Hub records'));const input={...emptyWorkspace(),milestones:[{id:'import1',title:'Cloud milestone',status:'Unknown'}]};fireEvent.change(screen.getByLabelText('Or paste exported JSON'),{target:{value:JSON.stringify(input)}});fireEvent.click(screen.getByText('Preview import'));expect(screen.getByLabelText('Import preview')).toBeTruthy();expect((screen.getByRole('button',{name:'Import to my workspace'}) as HTMLButtonElement).disabled).toBe(true);expect(puts).toHaveLength(0);fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Import to my workspace'}));await screen.findByText('Workspace saved by the server.');expect(puts).toHaveLength(1);});
test('account switch discards late account-A data and never retargets it',async()=>{let resolveA:(r:Response)=>void=()=>{};vi.mocked(fetch).mockImplementationOnce(()=>new Promise(r=>{resolveA=r;}));const view=render(<Hub ownerId="a" onAccount={vi.fn()}/>);current=snapshot('b');view.rerender(<Hub ownerId="b" onAccount={vi.fn()}/>);await screen.findByRole('button',{name:'Save record'});resolveA(Response.json({...snapshot(),workspace:{...emptyWorkspace(),milestones:[{id:'privateA',title:'A private record',status:'Unknown'}]}}));await waitFor(()=>expect(screen.queryByText('A private record')).toBeNull());});
test('mismatched session stops a save before private data is transmitted',async()=>{await open();fill();vi.mocked(fetch).mockResolvedValueOnce(Response.json({user:{id:'b'},csrfToken:'b'}));fireEvent.click(screen.getByRole('button',{name:'Save record'}));expect((await screen.findByRole('alert')).textContent).toContain('account changed');expect(puts).toHaveLength(0);});
test('matrix starts untested and creates no fabricated server record',async()=>{await open();fireEvent.click(screen.getByRole('button',{name:'Device matrix'}));expect(screen.getAllByRole('button',{name:'Untested'})).toHaveLength(60);fireEvent.click(screen.getAllByRole('button',{name:'Untested'})[0]);expect((screen.getByLabelText('Test case ID') as HTMLInputElement).value).toBe('A01');expect(puts).toHaveLength(0);});

test('matrix keeps Rumble Rush 1 evidence separate from Rumble Rush 2',async()=>{
 current={...snapshot(),workspace:{...emptyWorkspace(),tests:[{id:'r2',title:'Other project test',status:'Fail',caseId:'A01',platform:'Web',projectId:'rumble-rush-2'}]}};
 await open();fireEvent.click(screen.getByRole('button',{name:'Device matrix'}));
 expect(screen.getAllByRole('button',{name:'Untested'})).toHaveLength(60);
 fireEvent.change(screen.getByLabelText('Evidence project'),{target:{value:'rumble-rush-2'}});
 expect(screen.getAllByRole('button',{name:'Untested'})).toHaveLength(59);
 expect(screen.getByRole('button',{name:'Fail'})).toBeTruthy();expect(puts).toHaveLength(0);
});

test('refresh invalidates an import preview made before another-device save',async()=>{
 await open();fireEvent.click(screen.getByText('Bring in your separate Control Hub records'));
 fireEvent.change(screen.getByLabelText('Or paste exported JSON'),{target:{value:JSON.stringify({...emptyWorkspace(),milestones:[{id:'cloud',title:'Imported claim',status:'Unknown'}]})}});
 fireEvent.click(screen.getByText('Preview import'));fireEvent.click(screen.getByRole('checkbox'));
 current={...snapshot('a',1),workspace:{...emptyWorkspace(),milestones:[{id:'other',title:'Other-device work',status:'Unknown'}]}};
 fireEvent.click(screen.getByRole('button',{name:'Refresh saved workspace'}));
 await screen.findByRole('heading',{name:'Other-device work'});
 expect(screen.queryByLabelText('Import preview')).toBeNull();expect(puts).toHaveLength(0);
 fireEvent.click(screen.getByText('Preview import'));fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Import to my workspace'}));
 await screen.findByText('Workspace saved by the server.');
 expect((puts[0].workspace as ReturnType<typeof emptyWorkspace>).milestones.map(r=>r.id)).toEqual(['other','cloud']);
});

test('refresh in flight prevents imports and cannot overwrite a later save',async()=>{
 await open();fireEvent.click(screen.getByText('Bring in your separate Control Hub records'));
 fireEvent.change(screen.getByLabelText('Or paste exported JSON'),{target:{value:JSON.stringify(emptyWorkspace())}});fireEvent.click(screen.getByText('Preview import'));fireEvent.click(screen.getByRole('checkbox'));
 let finish:(r:Response)=>void=()=>{};vi.mocked(fetch).mockImplementationOnce(()=>new Promise(r=>{finish=r;}));
 fireEvent.click(screen.getByRole('button',{name:'Refresh saved workspace'}));
 expect((screen.getByRole('button',{name:'Import to my workspace'}) as HTMLButtonElement).disabled).toBe(true);
 expect((screen.getByRole('button',{name:'Save record'}) as HTMLButtonElement).disabled).toBe(true);
 finish(Response.json(snapshot()));await waitFor(()=>expect(screen.queryByLabelText('Import preview')).toBeNull());expect(puts).toHaveLength(0);
});
test('edit preserves every accepted imported status',async()=>{
 current={...snapshot(),workspace:{...emptyWorkspace(),submissions:[{id:'rejected',title:'Unapproved submission',status:'Rejected'}]}};
 await open();fireEvent.change(screen.getByLabelText('Record type'),{target:{value:'submissions'}});fireEvent.click(screen.getByRole('button',{name:'Edit'}));
 expect((screen.getByLabelText('Recorded status') as HTMLSelectElement).value).toBe('Rejected');
});

test('imported project IDs stay explicit when editing and filtering evidence',async()=>{
 current={...snapshot(),workspace:{...emptyWorkspace(),milestones:[{id:'other',title:'Other game',status:'Unknown',projectId:'word-sprint'}]}};
 await open();fireEvent.click(screen.getByRole('button',{name:'Edit'}));
 expect((screen.getByLabelText('Project') as HTMLSelectElement).value).toBe('word-sprint');
 fireEvent.click(screen.getByRole('button',{name:'Device matrix'}));
 fireEvent.change(screen.getByLabelText('Evidence project'),{target:{value:'word-sprint'}});
 expect((screen.getByLabelText('Evidence project') as HTMLSelectElement).value).toBe('word-sprint');expect(puts).toHaveLength(0);
});

test('export includes the latest visible edits after a failed save',async()=>{
 await open();fill();vi.mocked(fetch).mockResolvedValueOnce(Response.json({user:{id:'a'},csrfToken:'synthetic'})).mockResolvedValueOnce(Response.json({error:{message:'outage'}},{status:503}));
 fireEvent.click(screen.getByRole('button',{name:'Save record'}));await screen.findByRole('alert');
 fireEvent.change(screen.getByLabelText('Title'),{target:{value:'Latest visible draft'}});
 let exported:Blob|undefined;Object.defineProperty(URL,'createObjectURL',{configurable:true,value:vi.fn((blob:Blob)=>{exported=blob;return 'blob:synthetic';})});Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:vi.fn()});
 vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 fireEvent.click(screen.getByRole('button',{name:/Export /}));
 const json=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsText(exported!);});
 expect(JSON.parse(json).milestones[0].title).toBe('Latest visible draft');
});
