import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {StoriesStrip,ReelsPage} from '../SocialHub';
import Sidekick from '../assistant/Sidekick';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function server(){const writes:RequestInit[]=[];vi.stubGlobal('fetch',vi.fn(async(input,init)=>{
 if(init?.method==='POST')writes.push(init);
 const path=String(input);
 return Response.json(path.endsWith('/auth/me')?{user:{id:'alpha'},csrfToken:'test'}:path.endsWith('/stories')?{stories:[]}:path.endsWith('/reels')?{reels:[]}:path.endsWith('/social/assets')?{id:'asset'}:path.endsWith('/ai/chat')?{text:'Synthetic model answer',source:'model'}:{configured:true});
}));return writes;}
describe('selected files and processing choices',()=>{
 it('clears a viewed followers-only Story immediately on sign-out',async()=>{
  const story={id:'private-story',author_id:'alpha',text:'Private synthetic Story',asset_id:null,visibility:'followers',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),eco_id:'alpha',display_name:'Alpha',view_count:0,viewed:true};
  let signedIn=true;vi.stubGlobal('fetch',vi.fn(async(input)=>Response.json(String(input).endsWith('/auth/me')?{user:signedIn?{id:'alpha'}:null,csrfToken:'test'}:{stories:[story]})));
  render(<StoriesStrip onSignIn={()=>{}}/>);fireEvent.click((await screen.findByText('Alpha')).closest('button')!);expect(screen.getByText('Private synthetic Story')).toBeTruthy();
  signedIn=false;act(()=>window.dispatchEvent(new Event('ecovibes:identity_changed')));expect(screen.queryByText('Private synthetic Story')).toBeNull();expect(screen.queryByText('Alpha')).toBeNull();
 });
 it('ignores former-account Story responses after sign-out',async()=>{
  let finish!:(response:Response)=>void,signedIn=true;vi.stubGlobal('fetch',vi.fn(async(input)=>String(input).endsWith('/stories')?new Promise<Response>(r=>{finish=r;}):Response.json({user:signedIn?{id:'alpha'}:null,csrfToken:'test'})));
  render(<StoriesStrip onSignIn={()=>{}}/>);await act(async()=>{});signedIn=false;act(()=>window.dispatchEvent(new Event('ecovibes:identity_changed')));
  await act(async()=>finish(Response.json({stories:[{id:'old',display_name:'Former private author',asset_id:null,view_count:0}]})));expect(screen.queryByText('Former private author')).toBeNull();
 });
 it.each(['story','reel'])('does not upload a selected %s without separate consent; cancelling drops it',async kind=>{
  const writes=server();const view=render(kind==='story'?<StoriesStrip onSignIn={()=>{}}/>:<ReelsPage onSignIn={()=>{}}/>);
  await act(async()=>{});fireEvent.click(screen.getByRole('button',{name:kind==='story'?/Your status/:/Post a Reel/}));
  const file=view.container.querySelector('input[type=file]')!;
  fireEvent.change(file,{target:{files:[new File(['private fixture'],'chosen.'+(kind==='story'?'png':'mp4'),{type:kind==='story'?'image/png':'video/mp4'})]}});
  const submit=screen.getByRole('button',{name:kind==='story'?'Post status':'Post Reel'});
  expect((submit as HTMLButtonElement).disabled).toBe(true);expect(writes).toHaveLength(0);
  fireEvent.click(screen.getByRole('checkbox',{name:/upload and store/i}));expect((submit as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:kind==='story'?'Close Story editor':'Close Reel editor'}));
  fireEvent.click(screen.getByRole('button',{name:kind==='story'?/Your status/:/Post a Reel/}));
  expect((view.container.querySelector('input[type=file]') as HTMLInputElement).files?.length).toBe(0);expect(writes).toHaveLength(0);
 });
 it('keeps local guidance available without sending a question, then sends only after model consent',async()=>{
  const writes=server();render(<Sidekick page="Home" userId="alpha" csrfToken="test" online dataMode="saver" onNavigate={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:/Ask Chale AI/}));
  fireEvent.change(screen.getByRole('textbox',{name:'Ask Chale AI'}),{target:{value:'Help me prepare for an interview'}});fireEvent.click(screen.getByRole('button',{name:'Send question'}));
  await screen.findByText(/model processing is off/i);expect(writes).toHaveLength(0);
  fireEvent.click(screen.getByRole('checkbox',{name:/Allow model processing/}));
  fireEvent.change(screen.getByRole('textbox',{name:'Ask Chale AI'}),{target:{value:'Help me prepare for an interview'}});fireEvent.click(screen.getByRole('button',{name:'Send question'}));
  await screen.findByText('Synthetic model answer');expect(writes).toHaveLength(1);
  act(()=>window.dispatchEvent(new Event('ecovibes:revoke_ai')));expect(screen.queryByText('Synthetic model answer')).toBeNull();
  expect((screen.getByRole('checkbox',{name:/Allow model processing/}) as HTMLInputElement).checked).toBe(false);
 });
 it('does not transfer AI consent to another signed-in account',async()=>{
  server();const props={page:'Home' as const,userId:'alpha',csrfToken:'test',online:true,dataMode:'saver' as const,onNavigate:()=>{}};
  const view=render(<Sidekick {...props}/>);fireEvent.click(screen.getByRole('button',{name:/Ask Chale AI/}));fireEvent.click(screen.getByRole('checkbox',{name:/Allow model processing/}));
  view.rerender(<Sidekick {...props} userId="beta"/>);expect((screen.getByRole('checkbox',{name:/Allow model processing/}) as HTMLInputElement).checked).toBe(false);
 });
});
