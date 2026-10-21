import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProviderPortal from './ProviderPortal';

const profile = {id:'owner',ecoId:'test.owner',name:'Test Cleaner',providerType:'individual',category:'Cleaning',service:'House cleaning',area:'Tema',description:'House cleaning by appointment for homes.',priceMinor:12000,pricing:'quote',countryCode:'GH',verificationState:'unverified',revision:1};
const reply = (value: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(value), {status,headers:{'Content-Type':'application/json'}}));
const props = {identityId:'owner',open:true,onClose:vi.fn(),onOpen:vi.fn(),onProfile:vi.fn(),onJobs:vi.fn()};
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks()});

describe('provider onboarding',()=>{
  it('requires edited service details to be saved before requesting review',async()=>{
    const fetcher=vi.fn((url:string,init:RequestInit={})=>{
      if(url.endsWith('/auth/me'))return reply({user:{id:'owner'},csrfToken:'synthetic'});
      if(url.endsWith('/providers/me/submit'))return reply({profile:{...profile,verificationState:'pending',revision:2}});
      if(url.endsWith('/providers/me'))return reply({profile:init.method==='PUT'?{...profile,area:'Tema Community 1',revision:2}:profile});
      return reply({providers:[]});
    });
    vi.stubGlobal('fetch',fetcher);
    render(<ProviderPortal {...props}/>);
    await screen.findByRole('button',{name:'Save service'});
    fireEvent.change(screen.getByLabelText('Town or service area'),{target:{value:'Tema Community 1'}});
    fireEvent.change(screen.getByLabelText('Information for the review team'),{target:{value:'Review the updated service area.'}});
    const submit=screen.getByRole('button',{name:'Submit for staff review'});
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    // Submitting the form directly must also preserve the saved-profile boundary.
    fireEvent.submit(submit.closest('form')!);
    expect(fetcher.mock.calls.some(([url])=>url.endsWith('/providers/me/submit'))).toBe(false);
    fireEvent.click(screen.getByRole('button',{name:'Save service'}));
    await screen.findByText(/Service saved to your EcoVibes account/);
    expect((screen.getByRole('button',{name:'Submit for staff review'}) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button',{name:'Submit for staff review'}));
    expect(await screen.findByText('pending',{selector:'strong'})).toBeTruthy();
  });
  it('does not restore an old approved listing when discovery finishes after an edit',async()=>{
    let finishDirectory!: (value:Response)=>void;
    const directory=new Promise<Response>(resolve=>{finishDirectory=resolve});
    const approved={...profile,verificationState:'approved'};
    vi.stubGlobal('fetch',vi.fn((url:string,init:RequestInit={})=>{
      if(url.endsWith('/auth/me'))return reply({user:{id:'owner'},csrfToken:'synthetic'});
      if(url.endsWith('/providers/me'))return reply({profile:init.method==='PUT'?{...profile,revision:2}:approved});
      return directory;
    }));
    render(<ProviderPortal {...props}/>);
    await screen.findByRole('button',{name:'Save service'});
    fireEvent.change(screen.getByLabelText('Town or service area'),{target:{value:'Tema Community 1'}});
    fireEvent.click(screen.getByRole('button',{name:'Save service'}));
    await screen.findByText(/Service saved to your EcoVibes account/);
    finishDirectory(new Response(JSON.stringify({providers:[approved,{...approved,id:'other',name:'Other Cleaner'}]})));
    await screen.findByRole('heading',{name:'Other Cleaner'});
    expect(screen.queryByRole('heading',{name:'Test Cleaner'})).toBeNull();
    expect(screen.getByRole('button',{name:'Submit for staff review'})).toBeTruthy();
  });
  it('loads the owner profile when public discovery is unavailable',async()=>{
    vi.stubGlobal('fetch',vi.fn((url:string)=>{
      if(url.endsWith('/auth/me'))return reply({user:{id:'owner'},csrfToken:'synthetic'});
      if(url.endsWith('/providers/me'))return reply({profile});
      return reply({error:{message:'Directory unavailable'}},503);
    }));
    render(<ProviderPortal {...props}/>);
    expect(await screen.findByRole('button',{name:'Save service'})).toBeTruthy();
    expect((screen.getByLabelText('Name customers will see') as HTMLInputElement).value).toBe('Test Cleaner');
    expect(screen.getByText('The public service directory is unavailable. You can still manage your own service.')).toBeTruthy();
  });
  it('asks anonymous visitors to sign in and never offers a local-only save',async()=>{
    vi.stubGlobal('fetch',vi.fn((url:string)=>reply(url.endsWith('/auth/me')?{user:null,csrfToken:null}:{providers:[]})));
    render(<ProviderPortal {...props} identityId={null}/>);
    expect(await screen.findByRole('button',{name:'Sign in or create account'})).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Save service'})).toBeNull();
  });
  it('saves to the account with CSRF and submits for staff review',async()=>{
    const fetcher=vi.fn((url:string,init:RequestInit={})=>{
      if(url.endsWith('/auth/me'))return reply({user:{id:'owner'},csrfToken:'synthetic-csrf'});
      if(url.endsWith('/providers/me/submit'))return reply({profile:{...profile,verificationState:'pending'},verification:{id:'review'}});
      if(url.endsWith('/providers/me'))return reply({profile:init.method==='PUT'?profile:null});
      return reply({providers:[]});
    });
    vi.stubGlobal('fetch',fetcher);
    render(<ProviderPortal {...props}/>);
    await screen.findByRole('button',{name:'Save service'});
    for(const [label,value] of [['Name customers will see','Test Cleaner'],['Main service','House cleaning'],['Town or service area','Tema'],['Describe your service','House cleaning by appointment for homes.'],['Indicative price · GHS','120']])fireEvent.change(screen.getByLabelText(label),{target:{value}});
    fireEvent.click(screen.getByRole('button',{name:'Save service'}));
    await screen.findByRole('button',{name:'Submit for staff review'});
    const put=fetcher.mock.calls.find(([,init])=>init?.method==='PUT');
    expect((put?.[1]?.headers as Record<string,string>)['X-CSRF-Token']).toBe('synthetic-csrf');
    expect(JSON.parse(String(put?.[1]?.body)).priceMinor).toBe(12000);
    fireEvent.change(screen.getByLabelText('Information for the review team'),{target:{value:'Synthetic reviewer-only evidence.'}});
    fireEvent.click(screen.getByRole('button',{name:'Submit for staff review'}));
    expect(await screen.findByText('pending',{selector:'strong'})).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Submit for staff review'})).toBeNull();
  });
  it('does not show an old account response after switching identities',async()=>{
    let finishOld: (value:Response)=>void=()=>{};
    const old=new Promise<Response>(resolve=>{finishOld=resolve});
    let identity='owner';
    vi.stubGlobal('fetch',vi.fn((url:string)=>{
      if(url.endsWith('/auth/me'))return reply({user:{id:identity},csrfToken:'synthetic'});
      if(url.endsWith('/providers/me'))return identity==='owner'?old:reply({profile:null});
      return reply({providers:[]});
    }));
    const view=render(<ProviderPortal {...props}/>);
    await waitFor(()=>expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).endsWith('/providers/me'))).toBe(true));
    identity='other';view.rerender(<ProviderPortal {...props} identityId="other"/>);
    await screen.findByRole('button',{name:'Save service'});
    finishOld(new Response(JSON.stringify({profile,review:{status:'rejected',feedback:'Previous account private feedback.',submittedAt:'2026-10-15T10:00:00Z',reviewedAt:'2026-10-15T11:00:00Z'}})));
    await waitFor(()=>expect((screen.getByLabelText('Name customers will see') as HTMLInputElement).value).toBe(''));
    expect(screen.queryByText('Test Cleaner')).toBeNull();
    expect(screen.queryByText('Previous account private feedback.')).toBeNull();
  });
  it('shows a failed save without claiming success',async()=>{
    vi.stubGlobal('fetch',vi.fn((url:string,init:RequestInit={})=>{
      if(url.endsWith('/auth/me'))return reply({user:{id:'owner'},csrfToken:'synthetic'});
      if(init.method==='PUT')return reply({error:{message:'Session expired. Sign in again.'}},403);
      if(url.endsWith('/providers/me'))return reply({profile});
      return reply({providers:[]});
    }));
    render(<ProviderPortal {...props}/>);
    fireEvent.click(await screen.findByRole('button',{name:'Save service'}));
    expect((await screen.findByRole('alert')).textContent).toContain('Session expired');
    expect(screen.queryByText(/Service saved to your EcoVibes account/)).toBeNull();
  });
  it('shows rejection feedback to the owner and clears it after changing the saved profile',async()=>{
    vi.stubGlobal('fetch',vi.fn((url:string,init:RequestInit={})=>{
      if(url.endsWith('/auth/me'))return reply({user:{id:'owner'},csrfToken:'synthetic'});
      if(url.endsWith('/providers/me'))return reply(init.method==='PUT'?{profile:{...profile,revision:2},review:null}:{profile:{...profile,verificationState:'rejected'},review:{status:'rejected',feedback:'Please clarify the service area.',submittedAt:'2026-10-15T10:00:00Z',reviewedAt:'2026-10-15T11:00:00Z'}});
      return reply({providers:[]});
    }));
    render(<ProviderPortal {...props}/>);
    expect(await screen.findByText('Please clarify the service area.')).toBeTruthy();
    expect(screen.getByRole('heading',{name:'Changes requested'})).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Town or service area'),{target:{value:'Tema Community 1'}});
    fireEvent.click(screen.getByRole('button',{name:'Save service'}));
    await screen.findByText(/Service saved to your EcoVibes account/);
    expect(screen.queryByText('Please clarify the service area.')).toBeNull();
    expect(screen.getByRole('button',{name:'Submit for staff review'})).toBeTruthy();
  });
  it('preserves the approved directory listing and feedback on an unchanged save',async()=>{
    const approved={...profile,verificationState:'approved'};
    vi.stubGlobal('fetch',vi.fn((url:string)=>{
      if(url.endsWith('/auth/me'))return reply({user:{id:'owner'},csrfToken:'synthetic'});
      if(url.endsWith('/providers/me'))return reply({profile:approved,review:{status:'approved',feedback:'Service details reviewed.',submittedAt:'2026-10-15T10:00:00Z',reviewedAt:'2026-10-15T11:00:00Z'}});
      return reply({providers:[approved]});
    }));
    render(<ProviderPortal {...props}/>);
    fireEvent.click(await screen.findByRole('button',{name:'Save service'}));
    await screen.findByText('Service saved. Your approved listing is still available.');
    expect(screen.getByRole('heading',{name:'Test Cleaner'})).toBeTruthy();
    expect(screen.getByText('Service details reviewed.')).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Submit for staff review'})).toBeNull();
  });
  it('refreshes pending review into a decision and renders feedback as plain text',async()=>{
    let reviewed=false;
    const feedback='<img src=x onerror=alert(1)> Please update the service area.';
    vi.stubGlobal('fetch',vi.fn((url:string)=>{
      if(url.endsWith('/auth/me'))return reply({user:{id:'owner'},csrfToken:'synthetic'});
      if(url.endsWith('/providers/me'))return reply({profile:{...profile,verificationState:reviewed?'rejected':'pending'},review:{status:reviewed?'rejected':'pending',feedback:reviewed?feedback:null,submittedAt:'2026-10-15T10:00:00Z',reviewedAt:reviewed?'2026-10-15T11:00:00Z':null}});
      return reply({providers:[]});
    }));
    render(<ProviderPortal {...props}/>);
    await screen.findByRole('heading',{name:'Review pending'});
    reviewed=true; fireEvent.click(screen.getByRole('button',{name:'Refresh saved profile'}));
    expect(await screen.findByText(feedback)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('button',{name:'Submit for staff review'})).toBeTruthy();
  });
});
