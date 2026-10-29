import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import PeopleProfile from './PeopleProfile';
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',PHOTO='00000000-0000-4000-8000-000000000010';
const identity={id:A,eco_id:'alpha',display_name:'Alpha'};
const empty={viewerId:A,ownerId:A,mediaEnabled:true,avatarAssetId:null,bannerAssetId:null,revision:0,updatedAt:null,counts:{friends:7,followers:12,following:4}};
const props={identity,csrfToken:'synthetic',dataMode:'saver',onAccount:vi.fn(),onFriends:vi.fn()};
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('synced profile editor',()=>{
 it('shows server counts and opens the photo and cover editor',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(empty)));render(<PeopleProfile {...props}/>);
  expect(await screen.findByText('12')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Edit profile photos'}));
  expect(screen.getByLabelText('Profile photo')).toBeTruthy();expect(screen.getByLabelText('Cover banner')).toBeTruthy();
  expect(screen.getByText(/visible to signed-in EcoVibes members/)).toBeTruthy();
 });
 it('does not invent zero counts or retain data returned for another owner',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...empty,ownerId:B})));render(<PeopleProfile {...props}/>);
  await screen.findByRole('alert');expect(screen.queryByText('12')).toBeNull();expect(screen.getByText(/Relationship counts are unavailable/)).toBeTruthy();
 });
 it('keeps a failed save open and does not show account-save success',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(_url,init)=>init?.method==='POST'?Response.json({error:{message:'Storage unavailable'}},{status:503}):Response.json({...empty,avatarAssetId:PHOTO})));
  render(<PeopleProfile {...props}/>);await screen.findByText('12');fireEvent.click(screen.getByRole('button',{name:'Edit profile photos'}));fireEvent.click(screen.getByLabelText('Remove profile photo'));fireEvent.click(screen.getByRole('button',{name:'Save profile photos'}));
  await screen.findByText('Storage unavailable');expect(screen.queryByText('Profile saved to your EcoVibes account.')).toBeNull();expect(screen.getByLabelText('Remove profile photo')).toBeTruthy();
 });
 it('binds save to the captured owner and waits for its verified result',async()=>{
  let finish!:(r:Response)=>void;vi.stubGlobal('fetch',vi.fn(async(input,init)=>String(input).includes('/media/')?new Response('',{status:404}):init?.method==='POST'?new Promise<Response>(r=>{finish=r;}):Response.json({...empty,avatarAssetId:PHOTO})));
  render(<PeopleProfile {...props}/>);await screen.findByText('12');fireEvent.click(screen.getByRole('button',{name:'Edit profile photos'}));fireEvent.click(screen.getByLabelText('Remove profile photo'));fireEvent.click(screen.getByRole('button',{name:'Save profile photos'}));
  expect(screen.queryByText('Profile saved to your EcoVibes account.')).toBeNull();
  const write=vi.mocked(fetch).mock.calls.find(([,init])=>init?.method==='POST');expect(JSON.parse(String(write?.[1]?.body))).toEqual({expectedOwnerId:A,avatarAssetId:null,bannerAssetId:null,revision:0});
  await act(async()=>finish(Response.json({...empty,revision:1})));await screen.findByText('Profile saved to your EcoVibes account.');
 });
 it('ignores a former owner response after unmount and never stores profile data in the browser',async()=>{
  let finish!:(r:Response)=>void;const store=vi.spyOn(Storage.prototype,'setItem');vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(r=>{finish=r;})));
  const view=render(<PeopleProfile {...props}/>);view.unmount();await act(async()=>finish(Response.json(empty)));expect(store).not.toHaveBeenCalled();expect(screen.queryByText('12')).toBeNull();
 });
 it('rejects an unsupported file before any upload or false success',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(empty)));render(<PeopleProfile {...props}/>);await screen.findByText('12');fireEvent.click(screen.getByRole('button',{name:'Edit profile photos'}));
  fireEvent.change(screen.getByLabelText('Profile photo'),{target:{files:[new File(['fake'],'clip.mp4',{type:'video/mp4'})]}});fireEvent.click(screen.getByRole('checkbox',{name:/upload and store.*profile/i}));fireEvent.click(screen.getByRole('button',{name:'Save profile photos'}));
  await screen.findByText(/Choose a JPG, PNG or WebP/);expect(vi.mocked(fetch).mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);
 });

 it('uploads a chosen photo once and reuses its confirmed asset when the profile save is retried',async()=>{
  let saves=0;
  vi.stubGlobal('fetch',vi.fn(async(input,init)=>{
   if(String(input).includes('/media/'))return new Response('',{status:404});
   if(init?.method!=='POST')return Response.json(empty);
   if(String(input).endsWith('/social/assets'))return Response.json({id:PHOTO});
   saves++;
   return saves===1?Response.json({error:{message:'Save acknowledgement unavailable'}},{status:503}):Response.json({...empty,avatarAssetId:PHOTO,revision:1});
  }));
  render(<PeopleProfile {...props}/>);await screen.findByText('12');
  fireEvent.click(screen.getByRole('button',{name:'Edit profile photos'}));
  fireEvent.change(screen.getByLabelText('Profile photo'),{target:{files:[new File(['synthetic-photo-bytes'],'photo.png',{type:'image/png'})]}});
  fireEvent.click(screen.getByRole('checkbox',{name:/upload and store.*profile/i}));
  fireEvent.click(screen.getByRole('button',{name:'Save profile photos'}));
  await screen.findByText('Save acknowledgement unavailable');
  expect(screen.queryByText('Profile saved to your EcoVibes account.')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Save profile photos'}));
  await screen.findByText('Profile saved to your EcoVibes account.');
  const uploads=vi.mocked(fetch).mock.calls.filter(([url,init])=>String(url).endsWith('/social/assets')&&init?.method==='POST');
  expect(uploads).toHaveLength(1);
  expect(JSON.parse(String(uploads[0][1]?.body))).toMatchObject({mimeType:'image/png',expectedOwnerId:A});
  const writes=vi.mocked(fetch).mock.calls.filter(([url,init])=>String(url).endsWith('/people/profiles/me')&&init?.method==='POST');
  expect(writes).toHaveLength(2);
  expect(writes[0][1]?.body).toBe(writes[1][1]?.body);
 });
 it('cannot let an old account save response replace a newly mounted account profile',async()=>{
  let finish!:(r:Response)=>void;let owner=A;
  vi.stubGlobal('fetch',vi.fn(async(input,init)=>{
   if(String(input).includes('/media/'))return new Response('',{status:404});
   if(init?.method==='POST')return new Promise<Response>(r=>{finish=r;});
   return Response.json({...empty,ownerId:owner,viewerId:owner,avatarAssetId:owner===A?PHOTO:null,counts:{friends:owner===A?7:2,followers:owner===A?12:3,following:4}});
  }));
  const first=render(<PeopleProfile {...props}/>);await screen.findByText('12');
  fireEvent.click(screen.getByRole('button',{name:'Edit profile photos'}));fireEvent.click(screen.getByLabelText('Remove profile photo'));fireEvent.click(screen.getByRole('button',{name:'Save profile photos'}));
  const oldWrite=vi.mocked(fetch).mock.calls.find(([,init])=>init?.method==='POST');
  first.unmount();owner=B;
  render(<PeopleProfile {...props} identity={{id:B,eco_id:'beta',display_name:'Beta'}}/>);await screen.findByText('3');
  expect(oldWrite?.[1]?.signal?.aborted).toBe(true);
  await act(async()=>finish(Response.json({...empty,revision:1})));
  expect(screen.queryByText('12')).toBeNull();expect(screen.getByRole('heading',{name:'Beta'})).toBeTruthy();
  expect(screen.queryByText('Profile saved to your EcoVibes account.')).toBeNull();
 });
 it('preserves the editor revision when another device refreshes the visible profile',async()=>{
  let reads=0;
  vi.stubGlobal('fetch',vi.fn(async(input,init)=>{
   if(String(input).includes('/media/'))return new Response('',{status:404});
   if(init?.method==='POST')return Response.json({error:{message:'Your profile changed on another device'}},{status:409});
   return Response.json({...empty,avatarAssetId:PHOTO,revision:++reads});
  }));
  render(<PeopleProfile {...props}/>);await screen.findByText('12');
  fireEvent.click(screen.getByRole('button',{name:'Edit profile photos'}));fireEvent.click(screen.getByLabelText('Remove profile photo'));
  fireEvent.click(screen.getByRole('button',{name:'Refresh profile'}));
  await act(async()=>{});fireEvent.click(screen.getByRole('button',{name:'Save profile photos'}));
  await screen.findByText('Your profile changed on another device');
  const write=vi.mocked(fetch).mock.calls.find(([,init])=>init?.method==='POST');
  expect(JSON.parse(String(write?.[1]?.body)).revision).toBe(1);
  expect(screen.queryByText('Profile saved to your EcoVibes account.')).toBeNull();
 });


 it('discards hidden selections and removal flags when the editor is closed',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(empty)));
  render(<PeopleProfile {...props}/>);await screen.findByText('12');
  fireEvent.click(screen.getByRole('button',{name:'Edit profile photos'}));
  fireEvent.change(screen.getByLabelText('Profile photo'),{target:{files:[new File(['photo'],'cancelled.png',{type:'image/png'})]}});
  fireEvent.click(screen.getByLabelText('Remove cover banner'));
  fireEvent.click(screen.getByRole('button',{name:'Close profile editor'}));
  fireEvent.click(screen.getByRole('button',{name:'Edit profile photos'}));
  expect((screen.getByLabelText('Profile photo') as HTMLInputElement).files?.length).toBe(0);
  expect((screen.getByLabelText('Remove cover banner') as HTMLInputElement).checked).toBe(false);
  expect((screen.getByRole('button',{name:'Save profile photos'}) as HTMLButtonElement).disabled).toBe(true);
  expect(vi.mocked(fetch).mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);
 });
 it('offers explicit conflict reload that discards the draft and uses the latest revision',async()=>{
  let reads=0,writes=0;
  vi.stubGlobal('fetch',vi.fn(async(input,init)=>{
   if(String(input).includes('/media/'))return new Response('',{status:404});
   if(init?.method==='POST')return ++writes===1?Response.json({error:{message:'Your profile changed on another device'}},{status:409}):Response.json({...empty,revision:3,counts:{friends:7,followers:13,following:4}});
   reads++;return Response.json({...empty,avatarAssetId:PHOTO,revision:reads===1?1:2,counts:{friends:7,followers:reads===1?12:13,following:4}});
  }));
  render(<PeopleProfile {...props}/>);await screen.findByText('12');
  fireEvent.click(screen.getByRole('button',{name:'Edit profile photos'}));fireEvent.click(screen.getByLabelText('Remove profile photo'));fireEvent.click(screen.getByRole('button',{name:'Save profile photos'}));
  await screen.findByText('Your profile changed on another device');
  fireEvent.click(screen.getByRole('button',{name:'Reload saved profile'}));await screen.findByText('13');
  expect(screen.queryByLabelText('Remove profile photo')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Edit profile photos'}));fireEvent.click(screen.getByLabelText('Remove profile photo'));fireEvent.click(screen.getByRole('button',{name:'Save profile photos'}));
  await screen.findByText('Profile saved to your EcoVibes account.');
  const revisions=vi.mocked(fetch).mock.calls.filter(([,init])=>init?.method==='POST').map(([,init])=>JSON.parse(String(init?.body)).revision);
  expect(revisions).toEqual([1,2]);
 });


 it('keeps selected files visible through a failed read and disables save until profile recovery',async()=>{
  let reads=0;
  vi.stubGlobal('fetch',vi.fn(async(input,init)=>{
   if(String(input).includes('/media/'))return new Response('',{status:404});
   if(init?.method==='POST')return String(input).endsWith('/social/assets')?Response.json({id:PHOTO}):Response.json({...empty,avatarAssetId:PHOTO,revision:1});
   return ++reads===2?Response.json({error:{message:'Profile connection interrupted'}},{status:503}):Response.json(empty);
  }));
  render(<PeopleProfile {...props}/>);await screen.findByText('12');
  fireEvent.click(screen.getByRole('button',{name:'Edit profile photos'}));
  fireEvent.change(screen.getByLabelText('Profile photo'),{target:{files:[new File(['chosen-photo'],'visible.png',{type:'image/png'})]}});
  fireEvent.click(screen.getByRole('checkbox',{name:/upload and store.*profile/i}));
  fireEvent.click(screen.getByRole('button',{name:'Refresh profile'}));await screen.findByText('Profile connection interrupted');
  expect((screen.getByLabelText('Profile photo') as HTMLInputElement).files?.length).toBe(1);
  expect((screen.getByRole('button',{name:'Save profile photos'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Refresh profile'}));await screen.findByText('12');
  expect((screen.getByLabelText('Profile photo') as HTMLInputElement).files?.length).toBe(1);
  fireEvent.click(screen.getByRole('button',{name:'Save profile photos'}));await screen.findByText('Profile saved to your EcoVibes account.');
  expect(vi.mocked(fetch).mock.calls.filter(([url,init])=>String(url).endsWith('/social/assets')&&init?.method==='POST')).toHaveLength(1);
 });

});
