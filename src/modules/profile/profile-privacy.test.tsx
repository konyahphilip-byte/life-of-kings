import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import PeopleProfile from './PeopleProfile';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('requires separate upload consent for the selected file, and resets it when the choice changes',async()=>{
 const id='00000000-0000-4000-8000-000000000001';
 const request=vi.fn(async()=>Response.json({viewerId:id,ownerId:id,mediaEnabled:true,avatarAssetId:null,bannerAssetId:null,revision:0,updatedAt:null,counts:{friends:0,followers:0,following:0}}));vi.stubGlobal('fetch',request);
 render(<PeopleProfile identity={{id,eco_id:'alpha',display_name:'Alpha'}} csrfToken="test" dataMode="saver" onAccount={()=>{}} onFriends={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Edit profile photos'}));
 fireEvent.change(screen.getByLabelText('Profile photo'),{target:{files:[new File(['photo'],'first.png',{type:'image/png'})]}});
 expect((screen.getByRole('button',{name:'Save profile photos'}) as HTMLButtonElement).disabled).toBe(true);
 expect(request.mock.calls.length).toBe(1);
 fireEvent.click(screen.getByRole('checkbox',{name:/upload and store.*profile/i}));
 expect((screen.getByRole('button',{name:'Save profile photos'}) as HTMLButtonElement).disabled).toBe(false);
 fireEvent.change(screen.getByLabelText('Profile photo'),{target:{files:[new File(['other'],'second.png',{type:'image/png'})]}});
 expect((screen.getByRole('button',{name:'Save profile photos'}) as HTMLButtonElement).disabled).toBe(true);
});
