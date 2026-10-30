import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {afterEach,describe,expect,it,vi} from 'vitest';
import LocationTracking,{locationPresentation} from './LocationTracking';
const job={id:'11111111-1111-4111-8111-111111111111',title:'Own collection'};
function setup(role='collector',state='not_started'){
 const snapshot={ownerId:'owner',jobId:job.id,role,state,canPublish:role==='collector',sessionId:null,expiresAt:null,sequence:0,lastUpdateAt:null,point:null,serverTime:new Date().toISOString(),staleAfterMs:30000,locationRetentionMs:90000};
 const fetcher=vi.fn(async()=>({ok:true,json:async()=>snapshot}));vi.stubGlobal('fetch',fetcher);
 const watch=vi.fn(),clear=vi.fn(),query=vi.fn(async()=>({state:'denied'}));
 Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition:watch,clearWatch:clear}});
 Object.defineProperty(navigator,'permissions',{configurable:true,value:{query}});
 return{snapshot,fetcher,watch,query};
}
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('collection location permission UI',()=>{
 it.each(['offline','hidden','pagehide','unmount'])('stops native capture immediately on %s',async action=>{
  const x=setup();x.query.mockResolvedValue({state:'prompt'});x.watch.mockReturnValue(7);
  x.fetcher.mockImplementation(async(_url?:unknown,init?:RequestInit)=>({ok:true,json:async()=>init?.method==='POST'?{...x.snapshot,sessionId:'lease-one',state:'waiting'}:x.snapshot}) as never);
  const view=render(<LocationTracking ownerId="owner" csrf="csrf" jobs={[job]} saver="saver"/>);
  const start=await screen.findByRole('button',{name:'Start device location'});fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(start);await waitFor(()=>expect(x.watch).toHaveBeenCalledOnce());
  if(action==='unmount')view.unmount();else if(action==='hidden'){vi.spyOn(document,'hidden','get').mockReturnValue(true);fireEvent(document,new Event('visibilitychange'));}else{if(action==='offline')vi.spyOn(navigator,'onLine','get').mockReturnValue(false);fireEvent(window,new Event(action));}
  expect(navigator.geolocation.clearWatch).toHaveBeenCalledWith(7);
 });
 it.each(['live','stopped'])('stops device capture when another tab replaces its lease with a %s session',async state=>{
  const x=setup();x.query.mockResolvedValue({state:'prompt'});x.watch.mockReturnValue(7);
  x.fetcher.mockImplementation(async(_url?:unknown,init?:RequestInit)=>({ok:true,json:async()=>init?.method==='POST'?{...x.snapshot,sessionId:'lease-one',state:'waiting'}:x.snapshot}) as never);
  render(<LocationTracking ownerId="owner" csrf="csrf" jobs={[job]} saver="saver"/>);
  const start=await screen.findByRole('button',{name:'Start device location'});fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(start);await waitFor(()=>expect(x.watch).toHaveBeenCalledOnce());
  Object.assign(x.snapshot,{sessionId:'lease-two',state});fireEvent.click(screen.getByRole('button',{name:'Refresh collection location'}));
  await waitFor(()=>expect(navigator.geolocation.clearWatch).toHaveBeenCalledWith(7));
 });
 it('marks stale points and hides expired points without waiting for another poll',()=>{
  const {snapshot}=setup('customer','live'),stamp=new Date().toISOString();Object.assign(snapshot,{point:{latitude:5.6,longitude:-.18,accuracy:10,capturedAt:stamp,receivedAt:stamp},serverTime:stamp,expiresAt:new Date(Date.parse(stamp)+120000).toISOString()});
  expect(locationPresentation(snapshot as unknown as Parameters<typeof locationPresentation>[0],31000).state).toBe('stale');expect(locationPresentation(snapshot as unknown as Parameters<typeof locationPresentation>[0],91000).point).toBeNull();expect(locationPresentation(snapshot as unknown as Parameters<typeof locationPresentation>[0],121000)).toEqual({state:'expired',point:null});
 });
 it('does not request device access on opening and requires separate sharing consent',async()=>{
  const x=setup();render(<LocationTracking ownerId="owner" csrf="csrf" jobs={[job]} saver="saver"/>);
  const start=await screen.findByRole('button',{name:'Start device location'});expect(start).toBeDisabled();expect(x.query).not.toHaveBeenCalled();expect(x.watch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(start);await screen.findByText(/Location is blocked/);
  expect(x.fetcher).toHaveBeenCalledOnce();expect(x.watch).not.toHaveBeenCalled();
 });
 it('does not ask customers for location permission',async()=>{
  const x=setup('customer');render(<LocationTracking ownerId="owner" csrf="csrf" jobs={[job]} saver="standard"/>);
  await screen.findByText(/has not started location sharing/);expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();expect(x.query).not.toHaveBeenCalled();
 });
 it('clears prior account results and ignores a delayed response after account change',async()=>{
  const x=setup('customer');let resolve!:(x:unknown)=>void;x.fetcher.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}) as never);
  const view=render(<LocationTracking key="owner" ownerId="owner" csrf="csrf" jobs={[job]} saver="saver"/>);
  await waitFor(()=>expect(x.fetcher).toHaveBeenCalledOnce());view.rerender(<LocationTracking key="other" ownerId="other" csrf="new" jobs={[]} saver="saver"/>);
  resolve({ok:true,json:async()=>({...x.snapshot,state:'live',point:{latitude:5.6,longitude:-.18,accuracy:5,capturedAt:new Date().toISOString(),receivedAt:new Date().toISOString()}})});
  await waitFor(()=>expect(screen.getByText(/assigned collections appear here/)).toBeInTheDocument());expect(screen.queryByText(/5.60000/)).not.toBeInTheDocument();
 });
 it('does not show stale coordinates after a failed refresh',async()=>{
  const x=setup('customer','live');Object.assign(x.snapshot,{point:{latitude:5.6,longitude:-.18,accuracy:10,capturedAt:new Date().toISOString(),receivedAt:new Date().toISOString()},expiresAt:new Date(Date.now()+60000).toISOString(),sessionId:'lease'});
  render(<LocationTracking ownerId="owner" csrf="csrf" jobs={[job]} saver="saver"/>);await screen.findByText(/5.60000/);
  x.fetcher.mockRejectedValueOnce(Error('offline'));fireEvent.click(screen.getByRole('button',{name:'Refresh collection location'}));
  await screen.findByText(/could not be confirmed/);expect(screen.queryByText(/5.60000/)).not.toBeInTheDocument();
 });
});
