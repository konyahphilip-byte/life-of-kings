import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProviderPortal from './ProviderPortal';

const profile = {id:'owner',ecoId:'test.owner',name:'Test Cleaner',providerType:'individual',category:'Cleaning',service:'House cleaning',area:'Tema',description:'House cleaning by appointment for homes.',priceMinor:12000,pricing:'quote',countryCode:'GH',verificationState:'unverified',revision:1};
const reply = (value: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(value), {status,headers:{'Content-Type':'application/json'}}));
const props = {identityId:'owner',open:true,onClose:vi.fn(),onOpen:vi.fn(),onProfile:vi.fn(),onJobs:vi.fn()};
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks()});

describe('provider onboarding',()=>{
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
    finishOld(new Response(JSON.stringify({profile})));
    await waitFor(()=>expect((screen.getByLabelText('Name customers will see') as HTMLInputElement).value).toBe(''));
    expect(screen.queryByText('Test Cleaner')).toBeNull();
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
});
