import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import NotificationCenter from './NotificationCenter';
const notice={id:'00000000-0000-4000-8000-000000000010',type:'direct_message',title:'New message',body:'You have a new private message.',target_type:'direct_message',target_id:'peer',read_at:null,created_at:'2026-10-28T12:00:00Z'};
const summary={ownerId:'A',items:[notice],unread:1,truncated:false};
const props={userId:'A',csrfToken:'synthetic',online:true,onNavigate:vi.fn()};
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
describe('account notification bell',()=>{
 it('shows saved unread notices and navigates without pretending to enable push',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(summary)));render(<NotificationCenter {...props}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Notifications, 1 unread'}));
  expect(await screen.findByText('You have a new private message.')).toBeTruthy();
  expect(screen.getByText(/Lock-screen alerts are not connected/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Open'}));expect(props.onNavigate).toHaveBeenCalledWith('Messages');
 });
 it('does not invent an all-caught-up result on failure or expose a different owner',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...summary,ownerId:'B'})));render(<NotificationCenter {...props}/>);
  fireEvent.click(screen.getByRole('button',{name:'Notifications'}));
  await screen.findByRole('alert');expect(screen.queryByText('New message')).toBeNull();expect(screen.queryByText('No saved notifications yet.')).toBeNull();
 });
 it('keeps unread state on failed mark-read and uses an owned server write',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(_url,init)=>init?.method==='POST'?Response.json({error:{}},{status:503}):Response.json(summary)));
  render(<NotificationCenter {...props}/>);fireEvent.click(await screen.findByRole('button',{name:'Notifications, 1 unread'}));
  fireEvent.click(await screen.findByRole('button',{name:'Mark read'}));await screen.findByRole('alert');
  expect(screen.getByRole('button',{name:'Notifications, 1 unread'})).toBeTruthy();
  const write=vi.mocked(fetch).mock.calls.find(([,init])=>init?.method==='POST');expect(write?.[1]?.headers).toMatchObject({'X-CSRF-Token':'synthetic'});
 });
 it('ignores late old-account data and does not request private notices as a guest',async()=>{
  let finish!:(r:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(r=>{finish=r;})));
  const view=render(<NotificationCenter {...props}/>);view.rerender(<NotificationCenter {...props} userId={null} csrfToken=""/>);
  await act(async()=>finish(Response.json(summary)));fireEvent.click(screen.getByRole('button',{name:'Notifications'}));
  expect(screen.getByText('Sign in to see your saved notifications.')).toBeTruthy();expect(screen.queryByText('New message')).toBeNull();expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
 });
 it('releases mark-read controls when a summary refresh overlaps a failed write',async()=>{
  let finish!:(r:Response)=>void;
  vi.stubGlobal('fetch',vi.fn(async(_url,init)=>init?.method==='POST'?new Promise<Response>(r=>{finish=r;}):Response.json(summary)));
  render(<NotificationCenter {...props}/>);fireEvent.click(await screen.findByRole('button',{name:'Notifications, 1 unread'}));
  fireEvent.click(await screen.findByRole('button',{name:'Mark read'}));
  fireEvent.click(screen.getByRole('button',{name:'Refresh notifications'}));
  await act(async()=>finish(Response.json({error:{}},{status:503})));
  expect((screen.getByRole('button',{name:'Mark read'}) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByRole('button',{name:'Notifications, 1 unread'})).toBeTruthy();
 });
 it('polls only in the foreground and online',async()=>{
  vi.useFakeTimers();let visible='visible',online=true;
  vi.spyOn(document,'visibilityState','get').mockImplementation(()=>visible as DocumentVisibilityState);vi.spyOn(navigator,'onLine','get').mockImplementation(()=>online);
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(summary)));render(<NotificationCenter {...props}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  visible='hidden';act(()=>document.dispatchEvent(new Event('visibilitychange')));await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  visible='visible';online=false;act(()=>window.dispatchEvent(new Event('offline')));await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  online=true;act(()=>window.dispatchEvent(new Event('online')));await act(async()=>{await vi.advanceTimersByTimeAsync(0);});expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
 });
 it('does not let a late mark-read outcome restart an old online polling chain',async()=>{
  vi.useFakeTimers();let finish!:(r:Response)=>void;
  vi.stubGlobal('fetch',vi.fn(async(_url,init)=>init?.method==='POST'?new Promise<Response>(r=>{finish=r;}):Response.json(summary)));
  const view=render(<NotificationCenter {...props}/>);await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  fireEvent.click(screen.getByRole('button',{name:'Notifications, 1 unread'}));await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  fireEvent.click(screen.getByRole('button',{name:'Mark read'}));view.rerender(<NotificationCenter {...props} online={false}/>);
  const calls=vi.mocked(fetch).mock.calls.length;
  await act(async()=>{finish(Response.json({ok:true}));await vi.advanceTimersByTimeAsync(60000);});
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(calls);
 });
});
