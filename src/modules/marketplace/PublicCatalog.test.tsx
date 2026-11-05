import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import PublicCatalog from './PublicCatalog';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const item={id:'33333333-3333-4333-8333-333333333333',name:'Seller tomatoes',description:'Seller-entered description',category:'Vegetables',currency:'GHS',priceMinor:1200,stock:5,variants:[],sellerEcoId:'makola.shop',sellerIsCurrentUser:false,fulfillment_type:'own_inventory',source_type:'direct',image_url:null as string|null,location:'Accra'};
const page=(items=[item],nextCursor:string|null=null)=>({items,nextCursor,checkedAt:'2026-11-05T10:00:00.000Z',currency:'GHS'});
const props={account:{id:A,ecoId:'buyer.a'},online:true,saver:'saver' as const,onOpenWorkspace:vi.fn(),onStartSelling:vi.fn()};
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('native public catalog',()=>{
 it('renders only server records with truthful source and stock, then prepares a cart review without creating an order',async()=>{
  const fetch=vi.fn(async(_input:unknown)=>Response.json(page()));vi.stubGlobal('fetch',fetch);const open=vi.fn();window.addEventListener('ecovibes:open-account-bag',open);
  try{render(<PublicCatalog {...props}/>);await screen.findByText('Seller tomatoes');expect(screen.getByText('Native EcoVibes listing')).toBeTruthy();expect(screen.getByText('5 in stock at last check')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Review in account bag'}));expect((open.mock.calls[0][0] as CustomEvent).detail).toEqual({ownerId:A,productId:item.id});expect(fetch.mock.calls.every(([url])=>String(url).includes('/marketplace/catalog?'))).toBe(true);}finally{window.removeEventListener('ecovibes:open-account-bag',open);}
 });
 it('distinguishes empty data from a provider failure and never substitutes samples',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:{message:'Catalog temporarily unavailable'}},{status:503})));render(<PublicCatalog {...props}/>);
  await screen.findByText(/Catalog temporarily unavailable/);expect(screen.queryByText('No matching published listings')).toBeNull();expect(screen.queryByText('Seller tomatoes')).toBeNull();
 });
 it('offers native selling when the real catalog is empty',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(page([]))));render(<PublicCatalog {...props}/>);await screen.findByText('No matching published listings');fireEvent.click(screen.getByRole('button',{name:'Add my products'}));expect(props.onStartSelling).toHaveBeenCalled();
 });
 it('loads the next bounded page without duplicating existing products',async()=>{
  let calls=0;vi.stubGlobal('fetch',vi.fn(async()=>Response.json(++calls===1?page([item],'next-page'):page([item,{...item,id:B,name:'Seller books'}]))));render(<PublicCatalog {...props}/>);await screen.findByText('Seller tomatoes');fireEvent.click(screen.getByRole('button',{name:'Load more listings'}));await screen.findByText('Seller books');expect(screen.getAllByText('Seller tomatoes')).toHaveLength(1);
 });
 it('clears prior results on account change and ignores late old-account responses',async()=>{
  let resolve!:(r:Response)=>void;let calls=0;vi.stubGlobal('fetch',vi.fn(async()=>++calls===1?new Promise<Response>(r=>resolve=r):Response.json(page([]))));
  const view=render(<PublicCatalog {...props}/>);view.rerender(<PublicCatalog {...props} account={{id:B,ecoId:'buyer.b'}}/>);await screen.findByText('No matching published listings');resolve(Response.json(page()));await Promise.resolve();expect(screen.queryByText('Seller tomatoes')).toBeNull();
 });
 it('pauses offline without requesting catalog or checkout data',()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);render(<PublicCatalog {...props} online={false}/>);expect(screen.getByText(/Ordering is paused/)).toBeTruthy();expect(fetch).not.toHaveBeenCalled();
 });
 it('waits for an explicit low-data image action, and never embeds remote store images',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(page([{...item,image_url:'/social/assets/'+B},{...item,id:B,name:'Remote photo item',image_url:'https://external.example/photo.png'}]))));render(<PublicCatalog {...props}/>);
  await screen.findByText('Seller tomatoes');expect(document.querySelector('img')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Load photo of Seller tomatoes'}));expect(document.querySelectorAll('img')).toHaveLength(1);expect(document.querySelector('img')?.getAttribute('src')).toContain('/social/assets/'+B);expect(document.querySelector('img[src^="https://external"]')).toBeNull();
 });
 it('disables unavailable items and does not equate publication with verification',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(page([{...item,stock:0,source_type:'shopify'}]))));render(<PublicCatalog {...props}/>);await screen.findByText('Out of stock');expect(screen.getByText('Shopify-imported listing')).toBeTruthy();expect(screen.getByRole('button',{name:'Review in account bag'}).hasAttribute('disabled')).toBe(true);expect(screen.getByText(/Publication does not imply seller verification/)).toBeTruthy();
 });
});
