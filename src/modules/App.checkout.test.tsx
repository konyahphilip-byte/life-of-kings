import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./money/MoneyTrust', () => ({ default: () => null }));
vi.mock('./HomeDepth', () => ({ default: () => null }));
vi.mock('./assistant/Sidekick', () => ({ default: () => null }));
vi.mock('./backend/BackendWorkspace', () => ({ default: () => <div>Account workspace entry</div> }));
vi.mock('./SocialHub', () => ({ PeopleToFollow: () => null, ReelsPage: () => null, StoriesStrip: () => null }));

// Keep accessible-name assertions while avoiding expensive searches through unrelated screens.
const bagButton=()=>within(screen.getByRole('banner')).getByRole('button',{name:/^Bag/});
async function resultForActiveTest<T>(signal:AbortSignal,pending:Promise<T>):Promise<T>{
  const value=await pending;signal.throwIfAborted();return value;
}

const account = { id: 'bag-test-account', eco_id: 'bag.test', display_name: 'Bag Test', roles: ['customer'] };

describe('main Bag without a durable checkout', () => {
  let testSignal:AbortSignal;
  beforeEach(({signal}) => {
    testSignal=signal;
    localStorage.clear();sessionStorage.clear();
    window.history.replaceState(null,'','/#money-trust');
    vi.stubGlobal('scrollTo',vi.fn());
    Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute('open','');}});
    Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.removeAttribute('open');}});
    vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addListener:vi.fn(),removeListener:vi.fn()})));
  });
  afterEach(()=>{vi.unstubAllEnvs();cleanup();Reflect.deleteProperty(HTMLDialogElement.prototype,'showModal');Reflect.deleteProperty(HTMLDialogElement.prototype,'close');vi.unstubAllGlobals();vi.restoreAllMocks();window.history.replaceState(null,'','/');});

  it.each([false,true])('emergency Bag fallback preserves the $0 basket without financial success',async(signedIn)=>{
    const signal=testSignal;
    vi.stubEnv('VITE_BAG_UNAVAILABLE','1');
    const key=signedIn?'ecovibes:v1:account:'+account.id:'ecovibes:v1';
    localStorage.setItem(key,JSON.stringify({cart:{x1:2}}));
    const fetch=vi.fn(async(input:RequestInfo|URL,_init?:RequestInit)=>Response.json(String(input).endsWith('/auth/me')?{user:signedIn?account:null,csrfToken:signedIn?'synthetic-csrf':null}:{}));
    vi.stubGlobal('fetch',fetch);
    render(<App/>);
    if(signedIn)await resultForActiveTest(signal,screen.findByText('@bag.test'));
    fireEvent.click(bagButton());
    const bag=screen.getByRole('dialog',{name:'Your bag 2'});
    expect(within(bag).getByText(/Your bag is temporarily unavailable/)).toBeTruthy();
    expect(within(bag).queryByText(/Qty/)).toBeNull();
    expect(within(bag).queryByRole('button',{name:/Continue in sandbox/})).toBeNull();
    fireEvent.click(within(bag).getByRole('button',{name:'Open EcoVibes ID'}));
    await resultForActiveTest(signal,screen.findByText('Account workspace entry'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(JSON.parse(localStorage.getItem(key)!).cart).toEqual({x1:2});
    expect(screen.queryByText(/Sandbox order created/)).toBeNull();
    expect(fetch.mock.calls.filter(([url,init])=>!['GET','HEAD'].includes(String(init?.method||'GET').toUpperCase())&&/orders|checkout|payments|refund|transfers/.test(String(url)))).toEqual([]);
  });

  it.each([
    {signedIn:false,online:true},
    {signedIn:false,online:false},
    {signedIn:true,online:true},
    {signedIn:true,online:false},
  ])('preserves items and never reports an order: signedIn=$signedIn online=$online',async({signedIn,online})=>{
    // Capture this test's signal; the next beforeEach must never retarget an old continuation.
    const signal=testSignal;
    vi.spyOn(navigator,'onLine','get').mockReturnValue(online);
    const key=signedIn?'ecovibes:v1:account:'+account.id:'ecovibes:v1';
    localStorage.setItem(key,JSON.stringify({cart:{x1:2}}));
    const fetch=vi.fn(async(input:RequestInfo|URL,_init?:RequestInit)=>{
      const path=new URL(String(input),window.location.origin).pathname;
      return Response.json(path.endsWith('/auth/me')?{user:signedIn?account:null,csrfToken:signedIn?'synthetic-csrf':null}:{});
    });
    vi.stubGlobal('fetch',fetch);
    const view=render(<App/>);
    if(signedIn)await resultForActiveTest(signal,screen.findByText('@bag.test'));
    fireEvent.click(bagButton());
    expect(screen.getByRole('dialog',{name:'Your bag 2'})).toBeTruthy();
    expect(screen.getByText(/Qty 2/)).toBeTruthy();
    expect(screen.getByText(/Checkout is not connected to this bag/)).toBeTruthy();
    expect(screen.getByText(/This subtotal is not a payment quote/)).toBeTruthy();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:/Continue in sandbox|Open EcoVibes ID/}));
    expect(screen.queryByText(/Sandbox order created/)).toBeNull();
    await resultForActiveTest(signal,screen.findByText('Account workspace entry'));
    await resultForActiveTest(signal,waitFor(()=>expect(JSON.parse(localStorage.getItem(key)||'{}').cart).toEqual({x1:2})));
    const mutations=fetch.mock.calls.filter(([input,init])=>!['GET','HEAD'].includes(String(init?.method||'GET').toUpperCase())&&/orders|checkout|payments|refund|transfers/.test(String(input)));
    expect(mutations).toEqual([]);
    fireEvent.click(bagButton());
    expect(screen.getByText(/Qty 2/)).toBeTruthy();
    expect(screen.getByText(/Checkout is not connected to this bag/)).toBeTruthy();
    view.unmount();
    window.history.replaceState(null,'','/#money-trust');
    render(<App/>);
    if(signedIn)await resultForActiveTest(signal,screen.findByText('@bag.test'));
    fireEvent.click(bagButton());
    expect(screen.getByText(/Qty 2/)).toBeTruthy();
  });
  it('preserves each account basket through A → B → A, then reload',async()=>{
    const other={...account,id:'bag-test-other',eco_id:'other.test'};
    let current=account;
    for(const [owner,cart] of [[account.id,{x1:2}],[other.id,{x2:3}]] as const)localStorage.setItem('ecovibes:v1:account:'+owner,JSON.stringify({cart}));
    const request=vi.fn(async(input:RequestInfo|URL)=>Response.json(String(input).endsWith('/auth/me')?{user:current,csrfToken:'synthetic'}:{}));
    vi.stubGlobal('fetch',request);
    const view=render(<App/>);await screen.findByText('@bag.test');
    fireEvent.click(bagButton());expect(screen.getByText(/Qty 2/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Close bag'}));
    current=other;act(()=>window.dispatchEvent(new Event('ecovibes:identity_changed')));await screen.findByText('@other.test');
    fireEvent.click(bagButton());expect(screen.getByText(/Qty 3/)).toBeTruthy();expect(screen.queryByText(/Qty 2/)).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Open EcoVibes ID'}));await screen.findByText('Account workspace entry');
    current=account;act(()=>window.dispatchEvent(new Event('ecovibes:identity_changed')));await screen.findByText('@bag.test');
    fireEvent.click(bagButton());expect(screen.getByText(/Qty 2/)).toBeTruthy();expect(screen.queryByText(/Qty 3/)).toBeNull();
    view.unmount();window.history.replaceState(null,'','/#money-trust');render(<App/>);await screen.findByText('@bag.test');
    fireEvent.click(bagButton());expect(screen.getByText(/Qty 2/)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('ecovibes:v1:account:'+other.id)!).cart).toEqual({x2:3});
    expect(request.mock.calls.filter(([url])=>/orders|checkout|payments|refund|transfers/.test(String(url)))).toEqual([]);
  });

  it('keeps the saved account basket private when identity cannot be checked offline',async()=>{
    const key='ecovibes:v1:account:'+account.id;
    localStorage.setItem(key,JSON.stringify({cart:{x1:2}}));
    vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
    vi.stubGlobal('fetch',vi.fn(async()=>{throw new TypeError('Synthetic network unavailable');}));
    const view=render(<App/>);fireEvent.click(bagButton());
    expect(screen.getByText('Your bag is taking a breather')).toBeTruthy();expect(screen.queryByText(/Qty 2/)).toBeNull();
    expect(JSON.parse(localStorage.getItem(key)!).cart).toEqual({x1:2});
    view.unmount();
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>Response.json(String(input).endsWith('/auth/me')?{user:account,csrfToken:'synthetic'}:{})));
    render(<App/>);await screen.findByText('@bag.test');fireEvent.click(bagButton());
    expect(screen.getByText(/Qty 2/)).toBeTruthy();
  });

  it('keeps keyboard navigation inside the Bag and restores its opener on cancel',()=>{
    localStorage.setItem('ecovibes:v1',JSON.stringify({cart:{x1:2}}));
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({user:null,csrfToken:null})));
    render(<App/>);const opener=bagButton();opener.focus();fireEvent.click(opener);
    const dialog=screen.getByRole('dialog'),first=screen.getByRole('button',{name:'Close bag'}),last=screen.getByRole('button',{name:'Open EcoVibes ID'});
    first.focus();fireEvent.keyDown(first,{key:'Tab',shiftKey:true});expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last,{key:'Tab'});expect(document.activeElement).toBe(first);
    fireEvent(dialog,new Event('cancel',{bubbles:false,cancelable:true}));expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(opener);
  });

  it.each([
    {label:'next remaining product',cart:{x1:2,x2:1,x3:2,x4:1},remove:'Coastline print set',next:'Remove Everyday carry tote'},
    {label:'preceding product after removing the last row',cart:{x1:2,x2:1,x3:2,x4:1},remove:'Hand-thrown cup',next:'Remove Field notes · Vol. 01'},
    {label:'empty-state action after the final product',cart:{x1:2},remove:'Coastline print set',next:'Explore the marketplace'},
  ])('restores focus to the $label after removing a focused row',({cart,remove,next})=>{
    localStorage.setItem('ecovibes:v1',JSON.stringify({cart}));
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({user:null,csrfToken:null})));
    render(<App/>);
    const opener=bagButton();opener.focus();fireEvent.click(opener);
    const control=screen.getByRole('button',{name:'Remove '+remove});control.focus();fireEvent.click(control);
    expect(screen.queryByRole('button',{name:'Remove '+remove})).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button',{name:next}));
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    fireEvent(screen.getByRole('dialog'),new Event('cancel',{bubbles:false,cancelable:true}));
    expect(document.activeElement).toBe(opener);
  });

  it('retains the complete calculated GH₵540.00 subtotal for the six-unit fixture',()=>{
    const cart={x1:2,x2:1,x3:2,x4:1};
    localStorage.setItem('ecovibes:v1',JSON.stringify({cart}));
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({user:null,csrfToken:null})));
    render(<App/>);fireEvent.click(bagButton());
    expect(screen.getByRole('dialog',{name:'Your bag 6'})).toBeTruthy();
    expect(screen.getByText('GH₵540.00',{exact:true})).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('ecovibes:v1')!).cart).toEqual(cart);
  });

  it('rejects a settled result after the owning test is aborted',async()=>{
    const controller=new AbortController(),reason=new Error('Expired test journey'),resume=vi.fn();
    let release!:()=>void;
    const pending=new Promise<void>(resolve=>{release=resolve;});
    const continuation=resultForActiveTest(controller.signal,pending).then(resume);
    controller.abort(reason);release();
    await expect(continuation).rejects.toBe(reason);
    expect(resume).not.toHaveBeenCalled();
  });

});
