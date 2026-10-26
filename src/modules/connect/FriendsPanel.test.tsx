import { act,cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import { afterEach,describe,expect,it,vi } from 'vitest';
import FriendsPanel,{ FriendActions } from './FriendsPanel';

const person={id:'peer',eco_id:'akonyah',display_name:'Arnelle',followed:false,followsYou:false};
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
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
