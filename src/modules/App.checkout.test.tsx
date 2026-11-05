import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./money/MoneyTrust', () => ({ default: () => null }));
vi.mock('./HomeDepth', () => ({ default: () => null }));
vi.mock('./assistant/Sidekick', () => ({ default: () => null }));
vi.mock('./backend/BackendWorkspace', () => ({ default: () => <div>Account workspace entry</div> }));
vi.mock('./SocialHub', () => ({ PeopleToFollow: () => null, ReelsPage: () => null, StoriesStrip: () => null }));

const account = { id: 'bag-test-account', eco_id: 'bag.test', display_name: 'Bag Test', roles: ['customer'] };

describe('main Bag without a durable checkout', () => {
  beforeEach(() => {
    localStorage.clear();sessionStorage.clear();
    window.history.replaceState(null,'','/#money-trust');
    vi.stubGlobal('scrollTo',vi.fn());
    vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addListener:vi.fn(),removeListener:vi.fn()})));
  });
  afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();window.history.replaceState(null,'','/');});

  it.each([
    {signedIn:false,online:true},
    {signedIn:false,online:false},
    {signedIn:true,online:true},
    {signedIn:true,online:false},
  ])('preserves items and never reports an order: signedIn=$signedIn online=$online',async({signedIn,online})=>{
    vi.spyOn(navigator,'onLine','get').mockReturnValue(online);
    const key=signedIn?'ecovibes:v1:account:'+account.id:'ecovibes:v1';
    localStorage.setItem(key,JSON.stringify({cart:{x1:2}}));
    const fetch=vi.fn(async(input:RequestInfo|URL,_init?:RequestInit)=>{
      const path=new URL(String(input),window.location.origin).pathname;
      return Response.json(path.endsWith('/auth/me')?{user:signedIn?account:null,csrfToken:signedIn?'synthetic-csrf':null}:{});
    });
    vi.stubGlobal('fetch',fetch);
    const view=render(<App/>);
    if(signedIn)await screen.findByText('@bag.test');
    fireEvent.click(screen.getByRole('button',{name:/^Bag/}));
    expect(screen.getByText(/Qty 2/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:/Continue in sandbox|Open EcoVibes ID/}));
    expect(screen.queryByText(/Sandbox order created/)).toBeNull();
    await screen.findByText('Account workspace entry');
    await waitFor(()=>expect(JSON.parse(localStorage.getItem(key)||'{}').cart).toEqual({x1:2}));
    const mutations=fetch.mock.calls.filter(([input,init])=>!['GET','HEAD'].includes(String(init?.method||'GET').toUpperCase())&&/orders|checkout|payments|refund|transfers/.test(String(input)));
    expect(mutations).toEqual([]);
    fireEvent.click(screen.getByRole('button',{name:/^Bag/}));
    expect(screen.getByText(/Qty 2/)).toBeTruthy();
    expect(screen.getByText(/Checkout is not connected to this bag/)).toBeTruthy();
    view.unmount();
    window.history.replaceState(null,'','/#money-trust');
    render(<App/>);
    if(signedIn)await screen.findByText('@bag.test');
    fireEvent.click(screen.getByRole('button',{name:/^Bag/}));
    expect(screen.getByText(/Qty 2/)).toBeTruthy();
  });
});
