import { act,cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import { afterEach,describe,expect,it,vi } from 'vitest';
import FriendsPanel,{ FriendActions } from './FriendsPanel';

const person={id:'peer',eco_id:'akonyah',display_name:'Arnelle',followed:false,followsYou:false};
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
function respond(body:unknown,status=200){return new Response(JSON.stringify(body),{status});}
describe('friends request controls',()=>{
 it('sends an explicit CSRF-protected request, then shows request sent',async()=>{
  let posted:RequestInit|undefined;
  vi.stubGlobal('fetch',vi.fn(async(_input,init)=>{if(init?.method==='POST'){posted=init;return respond({state:'outgoing',revision:1,actions:['cancel','block']});}return respond({state:'none',revision:0,actions:['request','block']});}));
  render(<FriendActions userId="me" csrfToken="synthetic" person={person}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Add friend'}));
  await screen.findByText('Request sent');
  expect(JSON.parse(String(posted?.body))).toEqual({action:'request',revision:0});
  expect(new Headers(posted?.headers).get('X-CSRF-Token')).toBe('synthetic');expect(posted?.credentials).toBe('include');
 });
 it('shows incoming accept and decline and never starts a call on acceptance',async()=>{
  const paths:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(input,init)=>{paths.push(String(input));return respond(init?.method==='POST'?{state:'friends',revision:2,actions:['remove','block']}:{state:'incoming',revision:1,actions:['accept','decline','block']});}));
  render(<FriendActions userId="me" csrfToken="synthetic" person={person}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Accept'}));await screen.findByText('Friends');
  expect(paths.every(path=>path.startsWith('/api/v1/people/friends/'))).toBe(true);
 });
 it('clears old actions on account change and ignores a late write result',async()=>{
  let resolve!:(r:Response)=>void;
  vi.stubGlobal('fetch',vi.fn(async(_url,init)=>init?.method==='POST'?new Promise<Response>(r=>{resolve=r;}):respond({state:'none',revision:0,actions:['request']})));
  const view=render(<FriendActions userId="first" csrfToken="one" person={person}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Add friend'}));
  view.rerender(<FriendActions userId="second" csrfToken="two" person={person}/>);
  await screen.findByRole('button',{name:'Add friend'});
  await act(async()=>resolve(respond({state:'outgoing',revision:1,actions:['cancel']})));
  expect(screen.queryByText('Request sent')).toBeNull();
 });
 it('loads only the signed-in account inbox and exposes explicit refresh and accept',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>respond({incoming:[{...person,state:'incoming',revision:1,actions:['accept','decline','block']}],outgoing:[],friends:[],blocked:[],truncated:{}})));
  render(<FriendsPanel userId="me" csrfToken="synthetic" onSelect={vi.fn()}/>);
  const region=within(await screen.findByRole('region',{name:'Friends & requests'}));
  await region.findByText('@akonyah');expect(region.getByRole('button',{name:'Accept'})).toBeTruthy();expect(region.getByRole('button',{name:'Refresh friends'})).toBeTruthy();
 });
 it('keeps guest inbox private without sending requests',()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);render(<FriendsPanel userId={null} csrfToken="" onSelect={vi.fn()}/>);
  expect(screen.queryByRole('button',{name:'Accept'})).toBeNull();expect(fetcher).not.toHaveBeenCalled();
 });
 it('reports a failed state lookup without presenting an add action',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>respond({error:{message:'Connection unavailable'}},503)));
  render(<FriendActions userId="me" csrfToken="synthetic" person={person}/>);
  await screen.findByText('Connection unavailable');expect(screen.queryByRole('button',{name:'Add friend'})).toBeNull();
 });
 it('clears an old lookup failure when refreshing the connection succeeds',async()=>{
  let attempt=0;vi.stubGlobal('fetch',vi.fn(async()=>++attempt===1?respond({error:{message:'Connection unavailable'}},503):respond({state:'none',revision:0,actions:['request']})));
  render(<FriendActions userId="me" csrfToken="synthetic" person={person}/>);
  await screen.findByText('Connection unavailable');fireEvent.click(screen.getByRole('button',{name:'Refresh connection'}));
  await screen.findByRole('button',{name:'Add friend'});expect(screen.queryByText('Connection unavailable')).toBeNull();
 });
});

const emptyInbox={incoming:[],outgoing:[],friends:[],blocked:[],truncated:{}};
const withIncoming={...emptyInbox,incoming:[{...person,state:'incoming',revision:1,actions:['accept','decline','block']}]};
function foreground(){
 vi.useFakeTimers();let visibility:DocumentVisibilityState='visible',online=true;
 vi.spyOn(document,'visibilityState','get').mockImplementation(()=>visibility);
 vi.spyOn(navigator,'onLine','get').mockImplementation(()=>online);
 return {hide:()=>{visibility='hidden';document.dispatchEvent(new Event('visibilitychange'));},show:()=>{visibility='visible';document.dispatchEvent(new Event('visibilitychange'));},offline:()=>{online=false;window.dispatchEvent(new Event('offline'));},online:()=>{online=true;window.dispatchEvent(new Event('online'));}};
}
async function tick(ms=0){await act(async()=>{await vi.advanceTimersByTimeAsync(ms);});}
describe('foreground request updates',()=>{
 it('shows a newly received request without manually refreshing',async()=>{
  foreground();let received=false;
  vi.stubGlobal('fetch',vi.fn(async()=>respond(received?withIncoming:emptyInbox)));
  render(<FriendsPanel userId="me" csrfToken="synthetic" onSelect={vi.fn()}/>);await tick();
  expect(screen.queryByText('@akonyah')).toBeNull();received=true;await tick(15_000);
  expect(screen.getByText('@akonyah')).toBeTruthy();expect(screen.getByRole('button',{name:'Accept'})).toBeTruthy();
 });
 it('pauses periodic checks while hidden or offline and checks again on return',async()=>{
  const page=foreground();let reads=0;
  vi.stubGlobal('fetch',vi.fn(async()=>{reads++;return respond(emptyInbox);}));
  render(<FriendsPanel userId="me" csrfToken="synthetic" onSelect={vi.fn()}/>);await tick();expect(reads).toBe(1);
  page.hide();await tick(60_000);expect(reads).toBe(1);page.show();await tick();expect(reads).toBe(2);
  page.offline();await tick(60_000);expect(reads).toBe(2);page.online();await tick();expect(reads).toBe(3);
 });
 it('backs off after a failed refresh and recovers without reloading the page',async()=>{
  foreground();let reads=0;
  vi.stubGlobal('fetch',vi.fn(async()=>{reads++;return reads===2?respond({error:{message:'Temporarily unavailable'}},503):respond(reads>2?withIncoming:emptyInbox);}));
  render(<FriendsPanel userId="me" csrfToken="synthetic" onSelect={vi.fn()}/>);await tick();await tick(15_000);
  expect(screen.getByText('Temporarily unavailable')).toBeTruthy();expect(reads).toBe(2);
  await tick(15_000);expect(reads).toBe(2);await tick(15_000);expect(reads).toBe(3);expect(screen.getByText('@akonyah')).toBeTruthy();
 });
 it('bounds a stalled refresh and never overlaps periodic requests',async()=>{
  foreground();let reads=0,active=0,maxActive=0;
  vi.stubGlobal('fetch',vi.fn(async(_input,init)=>{
   reads++;if(reads!==2)return respond(emptyInbox);
   active++;maxActive=Math.max(maxActive,active);
   return new Promise<Response>((_resolve,reject)=>{init?.signal?.addEventListener('abort',()=>{active--;reject(new DOMException('Aborted','AbortError'));},{once:true});});
  }));
  render(<FriendsPanel userId="me" csrfToken="synthetic" onSelect={vi.fn()}/>);await tick();await tick(15_000);expect(reads).toBe(2);
  await tick(9_000);expect(reads).toBe(2);await tick(1_000);expect(active).toBe(0);expect(screen.getByRole('status')).toBeTruthy();
  await tick(30_000);expect(reads).toBe(3);expect(maxActive).toBe(1);
 });
 it('stops automatic checks after authentication fails until a return or explicit retry',async()=>{
  foreground();let reads=0;vi.stubGlobal('fetch',vi.fn(async()=>++reads===1?respond({error:{message:'Sign in again'}},401):respond(withIncoming)));
  render(<FriendsPanel userId="me" csrfToken="synthetic" onSelect={vi.fn()}/>);await tick();expect(screen.getByText('Sign in again')).toBeTruthy();
  await tick(120_000);expect(reads).toBe(1);window.dispatchEvent(new Event('focus'));await tick();expect(reads).toBe(2);expect(screen.getByText('@akonyah')).toBeTruthy();
 });
 it('resumes automatic updates after an explicit successful retry',async()=>{
  foreground();let reads=0;vi.stubGlobal('fetch',vi.fn(async()=>++reads===1?respond({error:{message:'Sign in again'}},401):respond(reads>2?withIncoming:emptyInbox)));
  render(<FriendsPanel userId="me" csrfToken="synthetic" onSelect={vi.fn()}/>);await tick();
  fireEvent.click(screen.getByRole('button',{name:'Refresh friends'}));await tick();await tick(15_000);
  expect(screen.getByText('@akonyah')).toBeTruthy();
 });
 it('discards a prior account response and stops all checks after sign-out',async()=>{
  foreground();let resolve!:(value:Response)=>void,reads=0;
  vi.stubGlobal('fetch',vi.fn(async()=>++reads===1?new Promise<Response>(r=>{resolve=r;}):respond(emptyInbox)));
  const view=render(<FriendsPanel userId="first" csrfToken="one" onSelect={vi.fn()}/>);await tick();
  view.rerender(<FriendsPanel userId="second" csrfToken="two" onSelect={vi.fn()}/>);await tick();
  await act(async()=>resolve(respond(withIncoming)));expect(screen.queryByText('@akonyah')).toBeNull();
  view.rerender(<FriendsPanel userId={null} csrfToken="" onSelect={vi.fn()}/>);const atSignout=reads;await tick(60_000);expect(reads).toBe(atSignout);
 });
});
