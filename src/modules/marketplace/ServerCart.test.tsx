import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import ServerCart from './ServerCart';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const product='33333333-3333-4333-8333-333333333333',orderId='44444444-4444-4444-8444-444444444444';
const cart=(ownerId=A,items=true)=>({ownerId,revision:1,items:items?[{productId:product,variantId:null,quantity:2,name:'Canonical item',variantTitle:null,unitPriceMinor:1200,available:true,reason:null}]:[],totalMinor:items?2400:0,currency:'GHS',quoteId:items?'a'.repeat(64):null,canCheckout:items,lastOrderId:items?null:orderId});
const order=(ownerId=A)=>({id:orderId,buyer_id:ownerId,total_minor:2400,status:'pending',payment_status:'unpaid'});
const props={ownerId:A,csrfToken:'synthetic-csrf',online:true,onOpenOrders:vi.fn()};
const path=(input:unknown)=>new URL(String(input),'https://example.test').pathname;
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('server account bag',()=>{
 it('shows the canonical total and announces an unpaid order only after the server confirms it',async()=>{
  let resolve!:(value:Response)=>void;const pending=new Promise<Response>(r=>resolve=r);
  const fetch=vi.fn(async(input:unknown,..._unused:RequestInit[])=>path(input).endsWith('/checkout')?pending:Response.json(cart()));vi.stubGlobal('fetch',fetch);
  render(<ServerCart {...props}/>);await screen.findByText('Canonical item');fireEvent.click(screen.getByRole('button',{name:'Place unpaid order'}));
  expect(screen.queryByText(/Saved order /)).toBeNull();resolve(Response.json({ownerId:A,order:order(),cart:cart(A,false)}));
  await screen.findByText(/Saved order /);expect(screen.getByText(/payment unpaid/)).toBeTruthy();
  const call=fetch.mock.calls.find(([u])=>path(u).endsWith('/checkout'))!;const body=JSON.parse(String(call[1]?.body));expect(body).toMatchObject({ownerId:A,revision:1,totalMinor:2400});expect(body.clientId).toMatch(/^[a-f0-9-]{36}$/);
 });
 it('keeps the same immutable request after a lost response, even after refreshing an empty server cart',async()=>{
  const bodies:unknown[]=[];let reads=0;
  vi.stubGlobal('fetch',vi.fn(async(input:unknown,init?:RequestInit)=>{if(path(input).endsWith('/checkout')){bodies.push(JSON.parse(String(init?.body)));if(bodies.length===1)throw Error('Network interrupted');return Response.json({ownerId:A,order:order(),cart:cart(A,false)});}return Response.json(++reads===1?cart():cart(A,false));}));
  render(<ServerCart {...props}/>);await screen.findByText('Canonical item');fireEvent.click(screen.getByRole('button',{name:'Place unpaid order'}));await screen.findByText('Network interrupted');
  expect(screen.queryByText(/Saved order /)).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Refresh account bag'}));await screen.findByText('No items in your account bag yet.');
  fireEvent.click(screen.getByRole('button',{name:'Retry same order request'}));await screen.findByText(/Saved order /);expect(bodies).toHaveLength(2);expect(bodies[1]).toEqual(bodies[0]);
 });
 it('retains quantities on server failure and exposes no completed-order message',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(input:unknown)=>path(input).endsWith('/checkout')?Response.json({error:{code:'internal_error',message:'Temporarily unavailable'}},{status:500}):Response.json(cart())));
  render(<ServerCart {...props}/>);await screen.findByText('Canonical item');fireEvent.click(screen.getByRole('button',{name:'Place unpaid order'}));await screen.findByText('Temporarily unavailable');
  expect(screen.getByText(/Quantity 2/)).toBeTruthy();expect(screen.queryByText(/Saved order /)).toBeNull();
 });
 it('requires reviewing the new canonical total after a price conflict',async()=>{
  let reads=0;vi.stubGlobal('fetch',vi.fn(async(input:unknown)=>path(input).endsWith('/checkout')?Response.json({error:{code:'cart_price_changed',message:'Review new price'}},{status:409}):Response.json(++reads===1?cart():{...cart(),totalMinor:2600,items:cart().items.map(i=>({...i,unitPriceMinor:1300}))})));
  render(<ServerCart {...props}/>);await screen.findByText('Canonical item');fireEvent.click(screen.getByRole('button',{name:'Place unpaid order'}));await screen.findByText('Review new price');expect(screen.getByText('Reviewed items total: GH₵26.00')).toBeTruthy();expect(screen.queryByText(/Saved order /)).toBeNull();
 });
 it('rejects a response belonging to another account',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(cart(B))));render(<ServerCart {...props}/>);await screen.findByText('Your account bag could not be confirmed. Reopen it.');expect(screen.queryByText('Canonical item')).toBeNull();
 });
 it('removes private cart and order feedback immediately when account props change',async()=>{
  let resolveB!:(r:Response)=>void;const slowB=new Promise<Response>(r=>resolveB=r);let reads=0;vi.stubGlobal('fetch',vi.fn(async()=>++reads===1?Response.json(cart()):slowB));
  const view=render(<ServerCart {...props}/>);await screen.findByText('Canonical item');view.rerender(<ServerCart {...props} ownerId={B}/>);
  expect(screen.queryByText('Canonical item')).toBeNull();resolveB(Response.json(cart(B,false)));await screen.findByText('No items in your account bag yet.');
 });
 it('never requests an order while offline',()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);render(<ServerCart {...props} online={false}/>);expect(screen.getByText(/Offline — ordering is paused/)).toBeTruthy();expect(fetch).not.toHaveBeenCalled();
 });
 it('only chooses current catalog IDs and waits for a saved-cart response',async()=>{
  const writes:unknown[]=[];vi.stubGlobal('fetch',vi.fn(async(input:unknown,init?:RequestInit)=>{
   if(path(input).endsWith('/products'))return Response.json([{id:product,name:'Canonical item',priceMinor:1200,stock:10,fulfillment_type:'own_inventory',variants:[]}]);
   if(init?.method==='PUT'){writes.push(JSON.parse(String(init.body)));return Response.json(cart());}return Response.json(cart(A,false));
  }));
  render(<ServerCart {...props}/>);await screen.findByText('No items in your account bag yet.');fireEvent.click(screen.getByRole('button',{name:'Choose current listings'}));await screen.findByLabelText('Current listing');fireEvent.change(screen.getByLabelText('Current listing'),{target:{value:product}});fireEvent.change(screen.getByLabelText('Quantity'),{target:{value:'2'}});fireEvent.click(screen.getByRole('button',{name:'Save item to account bag'}));await screen.findByText('Account bag saved.');expect(writes[0]).toEqual({ownerId:A,revision:1,items:[{productId:product,variantId:null,quantity:2}]});
 });
});
