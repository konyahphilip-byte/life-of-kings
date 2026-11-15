import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute('open','');}});
    Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.removeAttribute('open');}});
    vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addListener:vi.fn(),removeListener:vi.fn()})));
  });
  afterEach(()=>{cleanup();Reflect.deleteProperty(HTMLDialogElement.prototype,'showModal');Reflect.deleteProperty(HTMLDialogElement.prototype,'close');vi.unstubAllGlobals();vi.restoreAllMocks();window.history.replaceState(null,'','/');});

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
    expect(screen.getByRole('dialog',{name:'Your bag 2'})).toBeTruthy();
    expect(screen.getByText(/Qty 2/)).toBeTruthy();
    expect(screen.getByText(/Checkout is not connected to this bag/)).toBeTruthy();
    expect(screen.getByText(/This subtotal is not a payment quote/)).toBeTruthy();
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
  it('preserves each account basket through A → B → A, then reload',async()=>{
    const other={...account,id:'bag-test-other',eco_id:'other.test'};
    let current=account;
    for(const [owner,cart] of [[account.id,{x1:2}],[other.id,{x2:3}]] as const)localStorage.setItem('ecovibes:v1:account:'+owner,JSON.stringify({cart}));
    const request=vi.fn(async(input:RequestInfo|URL)=>Response.json(String(input).endsWith('/auth/me')?{user:current,csrfToken:'synthetic'}:{}));
    vi.stubGlobal('fetch',request);
    const view=render(<App/>);await screen.findByText('@bag.test');
    fireEvent.click(screen.getByRole('button',{name:/^Bag/}));expect(screen.getByText(/Qty 2/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Close bag'}));
    current=other;act(()=>window.dispatchEvent(new Event('ecovibes:identity_changed')));await screen.findByText('@other.test');
    fireEvent.click(screen.getByRole('button',{name:/^Bag/}));expect(screen.getByText(/Qty 3/)).toBeTruthy();expect(screen.queryByText(/Qty 2/)).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Open EcoVibes ID'}));await screen.findByText('Account workspace entry');
    current=account;act(()=>window.dispatchEvent(new Event('ecovibes:identity_changed')));await screen.findByText('@bag.test');
    fireEvent.click(screen.getByRole('button',{name:/^Bag/}));expect(screen.getByText(/Qty 2/)).toBeTruthy();expect(screen.queryByText(/Qty 3/)).toBeNull();
    view.unmount();window.history.replaceState(null,'','/#money-trust');render(<App/>);await screen.findByText('@bag.test');
    fireEvent.click(screen.getByRole('button',{name:/^Bag/}));expect(screen.getByText(/Qty 2/)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('ecovibes:v1:account:'+other.id)!).cart).toEqual({x2:3});
    expect(request.mock.calls.filter(([url])=>/orders|checkout|payments|refund|transfers/.test(String(url)))).toEqual([]);
  });

  it('keeps the saved account basket private when identity cannot be checked offline',async()=>{
    const key='ecovibes:v1:account:'+account.id;
    localStorage.setItem(key,JSON.stringify({cart:{x1:2}}));
    vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
    vi.stubGlobal('fetch',vi.fn(async()=>{throw new TypeError('Synthetic network unavailable');}));
    const view=render(<App/>);fireEvent.click(screen.getByRole('button',{name:/^Bag/}));
    expect(screen.getByText('Your bag is taking a breather')).toBeTruthy();expect(screen.queryByText(/Qty 2/)).toBeNull();
    expect(JSON.parse(localStorage.getItem(key)!).cart).toEqual({x1:2});
    view.unmount();
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>Response.json(String(input).endsWith('/auth/me')?{user:account,csrfToken:'synthetic'}:{})));
    render(<App/>);await screen.findByText('@bag.test');fireEvent.click(screen.getByRole('button',{name:/^Bag/}));
    expect(screen.getByText(/Qty 2/)).toBeTruthy();
  });

  it('keeps keyboard navigation inside the Bag and restores its opener on cancel',()=>{
    localStorage.setItem('ecovibes:v1',JSON.stringify({cart:{x1:2}}));
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({user:null,csrfToken:null})));
    render(<App/>);const opener=screen.getByRole('button',{name:/^Bag/});opener.focus();fireEvent.click(opener);
    const dialog=screen.getByRole('dialog'),first=screen.getByRole('button',{name:'Close bag'}),last=screen.getByRole('button',{name:'Open EcoVibes ID'});
    first.focus();fireEvent.keyDown(first,{key:'Tab',shiftKey:true});expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last,{key:'Tab'});expect(document.activeElement).toBe(first);
    fireEvent(dialog,new Event('cancel',{bubbles:false,cancelable:true}));expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(opener);
  });

});
