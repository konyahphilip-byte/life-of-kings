import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,describe,expect,it,vi } from 'vitest';
import ConnectInbox from './ConnectInbox';
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const peer={id:B,eco_id:'beta',display_name:'Beta',revision:2};
const message={id:'m1',sequence:'1',senderId:B,body:'Hello from Beta',createdAt:'2026-10-27T07:00:00Z'};
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
function network(){
 const saved=[message];let unavailable=false,failSend=false;
 vi.stubGlobal('fetch',vi.fn(async(input,init)=>{
  const path=new URL(String(input),'http://localhost').pathname;
  if(path.endsWith('/connect/messages'))return Response.json({ownerId:A,friends:[peer],truncated:false});
  if(unavailable)return Response.json({error:{message:'This conversation is unavailable.'}},{status:404});
  if(init?.method==='POST'){
   if(failSend)throw Error('Network interrupted');
   const body=JSON.parse(init.body);saved.push({...message,id:'m2',sequence:'2',senderId:A,body:body.body});
   return Response.json({ownerId:A,message:saved.at(-1),revision:2});
  }
  return Response.json({ownerId:A,revision:2,messages:saved,hasOlder:false,beforeCursor:'1'});
 }));
 return{saved,block:()=>{unavailable=true;},failSend:()=>{failSend=true;},restore:()=>{failSend=false;}};
}
describe('accepted-friend text conversations',()=>{
 it('shows two ticks only from a server-confirmed recipient acknowledgement',async()=>{
  let delivered=false;vi.stubGlobal('fetch',vi.fn(async(input)=>String(input).endsWith('/connect/messages')?Response.json({ownerId:A,friends:[peer],truncated:false}):Response.json({ownerId:A,revision:2,receiptsEnabled:true,messages:[{...message,senderId:A,deliveredAt:delivered?'2026-10-28T20:00:00Z':null}],hasOlder:false,beforeCursor:'1'})));
  render(<ConnectInbox userId={A} csrfToken="csrf" onOpenJobs={()=>{}}/>);fireEvent.click(await screen.findByRole('button',{name:'Message Beta'}));
  await screen.findByLabelText('Saved by server');expect(screen.queryByLabelText('Received by their app')).toBeNull();
  delivered=true;fireEvent.click(screen.getByRole('button',{name:'Refresh conversation'}));await screen.findByLabelText('Received by their app');
 });
 it('acknowledges only received peer messages, never its own, after verified rendering',async()=>{
  const messageId='00000000-0000-4000-8000-000000000099';vi.stubGlobal('fetch',vi.fn(async(input,init)=>{
   if(String(input).endsWith('/connect/messages'))return Response.json({ownerId:A,friends:[peer],truncated:false});
   if(init?.method==='POST')return Response.json({ownerId:A,revision:2,acknowledged:[messageId]});
   return Response.json({ownerId:A,revision:2,receiptsEnabled:true,messages:[{...message,id:messageId,deliveredAt:null},{...message,id:'own',senderId:A,sequence:'2',deliveredAt:null}],hasOlder:false,beforeCursor:'1'});
  }));
  render(<ConnectInbox userId={A} csrfToken="csrf" onOpenJobs={()=>{}}/>);fireEvent.click(await screen.findByRole('button',{name:'Message Beta'}));
  await waitFor(()=>expect(vi.mocked(fetch).mock.calls.some(([url,init])=>String(url).endsWith('/receipts')&&init?.method==='POST')).toBe(true));
  const write=vi.mocked(fetch).mock.calls.find(([,init])=>init?.method==='POST');expect(JSON.parse(String(write?.[1]?.body))).toEqual({revision:2,messageIds:[messageId]});
 });
 it('opens a real friend conversation, displays saved text and sends without HTML execution',async()=>{
  network();render(<ConnectInbox userId={A} csrfToken="csrf" onOpenJobs={()=>{}}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Message Beta'}));
  expect(await screen.findByText('Hello from Beta')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox',{name:'Write a message'}),{target:{value:'<b>hello</b>'}});
  fireEvent.click(screen.getByRole('button',{name:'Send message'}));
  await screen.findByText('Saved to conversation.');
  const text=await screen.findByText('<b>hello</b>');expect(text.querySelector('b')).toBeNull();
  expect((screen.getByRole('textbox',{name:'Write a message'}) as HTMLTextAreaElement).value).toBe('');
 });
 it('clears the former account and ignores an aborted late conversation read',async()=>{
  let finish!:(r:Response)=>void;
  vi.stubGlobal('fetch',vi.fn(async(input)=>String(input).endsWith('/connect/messages')?Response.json({ownerId:A,friends:[peer],truncated:false}):new Promise<Response>(r=>{finish=r;})));
  const view=render(<ConnectInbox userId={A} csrfToken="csrf" onOpenJobs={()=>{}}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Message Beta'}));
  await waitFor(()=>expect(finish).toBeTypeOf('function'));
  view.rerender(<ConnectInbox userId={null} csrfToken="" onOpenJobs={()=>{}}/>);
  await act(async()=>finish(Response.json({ownerId:A,revision:2,messages:[message],hasOlder:false,beforeCursor:'1'})));
  expect(screen.queryByText('Hello from Beta')).toBeNull();expect(screen.queryByRole('textbox',{name:'Write a message'})).toBeNull();
 });
 it('clears cached text and disables sending when a read reports revocation',async()=>{
  const api=network();render(<ConnectInbox userId={A} csrfToken="csrf" onOpenJobs={()=>{}}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Message Beta'}));await screen.findByText('Hello from Beta');
  api.block();fireEvent.click(screen.getByRole('button',{name:'Refresh conversation'}));
  await screen.findByText('This conversation is unavailable.');expect(screen.queryByText('Hello from Beta')).toBeNull();
  expect((screen.getByRole('button',{name:'Send message'}) as HTMLButtonElement).disabled).toBe(true);
 });
 it('keeps an uncertain send for explicit idempotent retry without claiming delivery',async()=>{
  const api=network();render(<ConnectInbox userId={A} csrfToken="csrf" onOpenJobs={()=>{}}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Message Beta'}));await screen.findByText('Hello from Beta');api.failSend();
  fireEvent.change(screen.getByRole('textbox',{name:'Write a message'}),{target:{value:'Can you see this?'}});fireEvent.click(screen.getByRole('button',{name:'Send message'}));
  await screen.findByRole('button',{name:'Retry same message'});expect(screen.queryByText('Delivered')).toBeNull();
  const first=vi.mocked(fetch).mock.calls.find(([,init])=>init?.method==='POST');api.restore();fireEvent.click(screen.getByRole('button',{name:'Retry same message'}));
  await screen.findByText('Can you see this?');const writes=vi.mocked(fetch).mock.calls.filter(([,init])=>init?.method==='POST');
  expect(JSON.parse(String(writes.at(-1)?.[1]?.body)).clientId).toBe(JSON.parse(String(first?.[1]?.body)).clientId);
 });
 it('automatically loads new foreground text, pauses offline and resumes online',async()=>{
  const api=network();render(<ConnectInbox userId={A} csrfToken="csrf" onOpenJobs={()=>{}}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Message Beta'}));await screen.findByText('Hello from Beta');vi.useFakeTimers();
  // Resume under the fake clock; the initial render used real timers.
  await act(async()=>window.dispatchEvent(new Event('focus')));
  api.saved.push({...message,id:'m2',sequence:'2',body:'New incoming text'});
  await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});expect(screen.getByText('New incoming text')).toBeTruthy();
  vi.spyOn(navigator,'onLine','get').mockReturnValue(false);act(()=>window.dispatchEvent(new Event('offline')));
  api.saved.push({...message,id:'m3',sequence:'3',body:'After reconnect'});
  await act(async()=>{await vi.advanceTimersByTimeAsync(20000);});expect(screen.queryByText('After reconnect')).toBeNull();
  vi.spyOn(navigator,'onLine','get').mockReturnValue(true);await act(async()=>{window.dispatchEvent(new Event('online'));});expect(screen.getByText('After reconnect')).toBeTruthy();
 });
 it('does not lose a confirmed send when a foreground refresh happens during its request',async()=>{
  network();const ordinary=globalThis.fetch;let finish!:(r:Response)=>void;
  vi.stubGlobal('fetch',vi.fn((input,init)=>init?.method==='POST'?new Promise<Response>(r=>{finish=r;}):ordinary(input,init)));
  render(<ConnectInbox userId={A} csrfToken="csrf" onOpenJobs={()=>{}}/>);fireEvent.click(await screen.findByRole('button',{name:'Message Beta'}));await screen.findByText('Hello from Beta');
  fireEvent.change(screen.getByRole('textbox',{name:'Write a message'}),{target:{value:'slow message'}});fireEvent.click(screen.getByRole('button',{name:'Send message'}));
  await act(async()=>window.dispatchEvent(new Event('focus')));
  await act(async()=>finish(Response.json({ownerId:A,revision:2,message:{...message,id:'slow',sequence:'2',senderId:A,body:'slow message'}})));
  expect(screen.getByText('Saved to conversation.')).toBeTruthy();expect(screen.getByText('slow message')).toBeTruthy();
 });
 it('refuses another session account message response even for the same peer and revision',async()=>{
  vi.stubGlobal('fetch',vi.fn(async input=>String(input).endsWith('/connect/messages')?Response.json({ownerId:A,friends:[peer],truncated:false}):Response.json({ownerId:'other-account',revision:2,messages:[message],hasOlder:false,beforeCursor:'1'})));
  render(<ConnectInbox userId={A} csrfToken="csrf" onOpenJobs={()=>{}}/>);fireEvent.click(await screen.findByRole('button',{name:'Message Beta'}));
  await screen.findByText('Sign-in changed. Refresh your account to continue.');
  expect(screen.queryByText('Hello from Beta')).toBeNull();
  expect((screen.getByRole('button',{name:'Send message'}) as HTMLButtonElement).disabled).toBe(true);
 });
 it('can find an accepted friend beyond the first roster page by exact ID',async()=>{
  vi.stubGlobal('fetch',vi.fn(async input=>String(input).includes('ecoId=')?Response.json({ownerId:A,friends:[peer],truncated:false}):Response.json({ownerId:A,friends:[],truncated:true})));
  render(<ConnectInbox userId={A} csrfToken="csrf" onOpenJobs={()=>{}}/>);
  fireEvent.change(screen.getByRole('textbox',{name:'Find friend by EcoVibes ID'}),{target:{value:'@beta'}});fireEvent.click(screen.getByRole('button',{name:'Find friend'}));
  expect(await screen.findByRole('button',{name:'Message Beta'})).toBeTruthy();
 });
 it('retains the same uncertain message reference across a transient roster failure',async()=>{
  const api=network();let rosterFailed=false;const ordinary=globalThis.fetch;
  vi.stubGlobal('fetch',vi.fn((input,init)=>rosterFailed&&String(input).endsWith('/connect/messages')?Promise.reject(Error('Roster offline')):ordinary(input,init)));
  render(<ConnectInbox userId={A} csrfToken="csrf" onOpenJobs={()=>{}}/>);fireEvent.click(await screen.findByRole('button',{name:'Message Beta'}));await screen.findByText('Hello from Beta');api.failSend();
  fireEvent.change(screen.getByRole('textbox',{name:'Write a message'}),{target:{value:'Uncertain draft'}});fireEvent.click(screen.getByRole('button',{name:'Send message'}));await screen.findByRole('button',{name:'Retry same message'});
  const first=vi.mocked(fetch).mock.calls.find(([,init])=>init?.method==='POST');rosterFailed=true;fireEvent.click(screen.getByRole('button',{name:'Refresh messages'}));
  await screen.findByText('Roster offline');expect((screen.getByRole('button',{name:'Retry same message'}) as HTMLButtonElement).disabled).toBe(true);
  rosterFailed=false;api.restore();fireEvent.click(screen.getByRole('button',{name:'Refresh messages'}));
  await waitFor(()=>expect((screen.getByRole('button',{name:'Retry same message'}) as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByRole('button',{name:'Retry same message'}));
  await screen.findByText('Uncertain draft');const writes=vi.mocked(fetch).mock.calls.filter(([,init])=>init?.method==='POST');expect(JSON.parse(String(writes.at(-1)?.[1]?.body)).clientId).toBe(JSON.parse(String(first?.[1]?.body)).clientId);
 });
 it('keeps an acknowledged earlier retry before newer messages already loaded',async()=>{
  const api=network();render(<ConnectInbox userId={A} csrfToken="csrf" onOpenJobs={()=>{}}/>);fireEvent.click(await screen.findByRole('button',{name:'Message Beta'}));await screen.findByText('Hello from Beta');api.failSend();
  fireEvent.change(screen.getByRole('textbox',{name:'Write a message'}),{target:{value:'Earlier send'}});fireEvent.click(screen.getByRole('button',{name:'Send message'}));await screen.findByRole('button',{name:'Retry same message'});
  api.saved.push({...message,id:'m2',sequence:'2',senderId:A,body:'Earlier send'},{...message,id:'m3',sequence:'3',body:'Later incoming'});
  fireEvent.click(screen.getByRole('button',{name:'Refresh conversation'}));await screen.findByText('Later incoming');api.restore();fireEvent.click(screen.getByRole('button',{name:'Retry same message'}));await screen.findByText('Saved to conversation.');
  expect([...document.querySelectorAll('.direct-message-history article p')].map(e=>e.textContent)).toEqual(['Hello from Beta','Earlier send','Later incoming']);
 });
});
