import {afterEach,describe,expect,it,vi} from 'vitest';
import {createLocationPublisher} from './location-publisher';

function fixture(permission='prompt'){
 let position:PositionCallback=()=>{},failure:PositionErrorCallback=()=>{};
 const status={state:permission,onchange:null as null|(()=>void)};
 const geo={watchPosition:vi.fn((ok:PositionCallback,no?:PositionErrorCallback|null,_options?:PositionOptions)=>{position=ok;failure=no||(()=>{});return 7;}),clearWatch:vi.fn()};
 const api={start:vi.fn(async():Promise<{sessionId:string;sequence:number;expiresAt?:string}>=>({sessionId:'session',sequence:0})),point:vi.fn(async()=>({state:'live'})),stop:vi.fn(async()=>{})};
 const change=vi.fn();const publisher=createLocationPublisher({ownerId:'collector',mode:'saver',geo,permission:async()=>status as unknown as PermissionStatus,api,onChange:change,available:()=>true,clock:()=>Date.now()});
 const send=(accuracy=12)=>position({coords:{latitude:5.6,longitude:-.18,accuracy},timestamp:Date.now()} as GeolocationPosition);
 return{publisher,api,geo,status,change,send,fail:()=>failure({code:1} as GeolocationPositionError)};
}
afterEach(()=>vi.useRealTimers());
describe('foreground device location publisher',()=>{
 it('stops if a granted permission is reset to ask, but permits the initial prompt to be granted',async()=>{
  const x=fixture('granted');await x.publisher.start(true,true);x.status.state='prompt';x.status.onchange?.();expect(x.geo.clearWatch).toHaveBeenCalledWith(7);expect(x.publisher.isActive()).toBe(false);
  const y=fixture('prompt');await y.publisher.start(true,true);y.status.state='granted';y.status.onchange?.();expect(y.publisher.isActive()).toBe(true);await y.publisher.stop();
 });
 it('stops device capture at the acknowledged session expiry',async()=>{
  vi.useFakeTimers();const x=fixture();x.api.start.mockResolvedValue({sessionId:'session',sequence:0,expiresAt:new Date(Date.now()+2000).toISOString()});await x.publisher.start(true,true);await vi.advanceTimersByTimeAsync(2000);expect(x.geo.clearWatch).toHaveBeenCalledWith(7);expect(x.publisher.isActive()).toBe(false);
 });
 it('requires separate sharing consent and current server authority before any device access',async()=>{
  const x=fixture();await x.publisher.start(false,true);await x.publisher.start(true,false);
  expect(x.geo.watchPosition).not.toHaveBeenCalled();expect(x.api.start).not.toHaveBeenCalled();
 });
 it('does not pressure a denied permission or start a server lease',async()=>{
  const x=fixture('denied');await x.publisher.start(true,true);await x.publisher.start(true,true);
  expect(x.geo.watchPosition).not.toHaveBeenCalled();expect(x.api.start).not.toHaveBeenCalled();expect(x.change).toHaveBeenCalledWith(expect.stringContaining('blocked'));
 });
 it('waits for server acknowledgement before the native location prompt',async()=>{
  const x=fixture();let resolve!:(x:{sessionId:string;sequence:number})=>void;x.api.start.mockImplementation(()=>new Promise(r=>{resolve=r;}));
  const pending=x.publisher.start(true,true);await Promise.resolve();expect(x.geo.watchPosition).not.toHaveBeenCalled();
  resolve({sessionId:'session',sequence:0});await pending;expect(x.geo.watchPosition).toHaveBeenCalledOnce();
  expect(x.geo.watchPosition.mock.calls[0][2]).toMatchObject({enableHighAccuracy:false,maximumAge:0});await x.publisher.stop();
 });
 it('publishes genuine callbacks with accuracy and acknowledges only server success',async()=>{
  const x=fixture();await x.publisher.start(true,true);x.send(800);await vi.waitFor(()=>expect(x.api.point).toHaveBeenCalledOnce());
  expect(x.api.point).toHaveBeenCalledWith(expect.objectContaining({expectedOwnerId:'collector',sessionId:'session',sequence:1,latitude:5.6,longitude:-.18,accuracy:800}));
  await x.publisher.stop();expect(x.geo.clearWatch).toHaveBeenCalledWith(7);expect(x.api.stop).toHaveBeenCalledWith(expect.objectContaining({expectedOwnerId:'collector',sessionId:'session'}));
 });
 it('stops on permission revocation and ignores late device callbacks',async()=>{
  const x=fixture();await x.publisher.start(true,true);x.status.state='denied';x.status.onchange?.();await Promise.resolve();x.send();
  expect(x.geo.clearWatch).toHaveBeenCalledWith(7);expect(x.api.point).not.toHaveBeenCalled();
 });
 it('stops on a native denial without retrying the system prompt',async()=>{
  const x=fixture();await x.publisher.start(true,true);x.fail();await Promise.resolve();await x.publisher.start(true,true);
  expect(x.geo.watchPosition).toHaveBeenCalledOnce();expect(x.api.point).not.toHaveBeenCalled();
 });
 it('does not publish a late result when stopped during server admission',async()=>{
  const x=fixture();let resolve!:(x:{sessionId:string;sequence:number})=>void;x.api.start.mockImplementation(()=>new Promise(r=>{resolve=r;}));
  const pending=x.publisher.start(true,true);await Promise.resolve();await x.publisher.stop();resolve({sessionId:'session',sequence:0});await pending;
  expect(x.geo.watchPosition).not.toHaveBeenCalled();expect(x.api.stop).toHaveBeenCalled();
 });
 it('never continues or says shared after a failed coordinate request',async()=>{
  const x=fixture();x.api.point.mockRejectedValue(Error('network'));await x.publisher.start(true,true);x.send();
  await vi.waitFor(()=>expect(x.geo.clearWatch).toHaveBeenCalled());x.send();expect(x.api.point).toHaveBeenCalledOnce();
  expect(x.change).not.toHaveBeenCalledWith('Location shared with your customer.');
 });
 it('does not overlap sends or retain an offline position queue',async()=>{
  const x=fixture();let release!:()=>void;x.api.point.mockImplementation(()=>new Promise(r=>{release=()=>r({state:'live'});}));
  await x.publisher.start(true,true);x.send();x.send();x.send();expect(x.api.point).toHaveBeenCalledOnce();await x.publisher.stop();release();await Promise.resolve();x.send();expect(x.api.point).toHaveBeenCalledOnce();
 });
});
