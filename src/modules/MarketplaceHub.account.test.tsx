import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import MarketplaceHub from './MarketplaceHub';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const props={account:{id:A,ecoId:'seller.a'},online:true,saver:'saver' as const,products:[],saved:[],onProductsChange:vi.fn(),onAddCart:vi.fn(),onToggleSaved:vi.fn(),onOpenWorkspace:vi.fn()};
const row={id:'33333333-3333-4333-8333-333333333333',name:'Private seller draft',category:'Private category',description:'',priceMinor:1200,costMinor:500,stock:3,variants:[],seller_id:A,source_type:'direct',fulfillment_type:'own_inventory'};
const path=(input:unknown)=>new URL(String(input),'https://example.test').pathname;
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('Marketplace seller account isolation',()=>{
 it('hides old private listing data immediately when account props change',async()=>{
  let who=A;vi.stubGlobal('fetch',vi.fn(async(input:unknown)=>path(input).endsWith('/auth/me')?Response.json({user:{id:who,roles:['seller']},csrfToken:'synthetic-'+who}):path(input).endsWith('/products')?Response.json(who===A?[row]:[]):path(input).endsWith('/catalog')?Response.json({items:[],nextCursor:null,checkedAt:'2026-11-05T10:00:00Z',currency:'GHS'}):Response.json([])));
  const view=render(<MarketplaceHub {...props}/>);fireEvent.click(screen.getByRole('tab',{name:'My listings'}));await screen.findByText('Private seller draft');who=B;view.rerender(<MarketplaceHub {...props} account={{id:B,ecoId:'seller.b'}}/>);expect(screen.queryByText('Private seller draft')).toBeNull();
 });
 it('ignores a late private listing response after switching accounts',async()=>{
  let who=A,resolve!:(r:Response)=>void,requested!:(r:void)=>void;const reached=new Promise<void>(r=>requested=r);
  vi.stubGlobal('fetch',vi.fn(async(input:unknown)=>{if(path(input).endsWith('/auth/me'))return Response.json({user:{id:who,roles:['seller']},csrfToken:'synthetic-'+who});if(path(input).endsWith('/products')&&who===A){requested();return new Promise<Response>(r=>resolve=r);}if(path(input).endsWith('/catalog'))return Response.json({items:[],nextCursor:null,checkedAt:'2026-11-05T10:00:00Z',currency:'GHS'});return Response.json([]);}));
  const view=render(<MarketplaceHub {...props}/>);fireEvent.click(screen.getByRole('tab',{name:'My listings'}));await reached;who=B;view.rerender(<MarketplaceHub {...props} account={{id:B,ecoId:'seller.b'}}/>);await act(async()=>{resolve(Response.json([row]));});expect(screen.queryByText('Private seller draft')).toBeNull();
 });
 it('does not upload a photo after its captured seller account changed during file reading',async()=>{
  let who=A,reader:{onload:(()=>void)|null;result:string}|null=null;const writes:string[]=[];
  vi.stubGlobal('FileReader',class{onload:(()=>void)|null=null;onerror=null;result='data:image/png;base64,c3ludGhldGlj';readAsDataURL(){reader=this;}abort(){}});
  vi.stubGlobal('fetch',vi.fn(async(input:unknown,init?:RequestInit)=>{if(init?.method==='POST')writes.push(path(input));if(path(input).endsWith('/auth/me'))return Response.json({user:{id:who,roles:['seller']},csrfToken:'synthetic-'+who});if(path(input).endsWith('/catalog'))return Response.json({items:[],nextCursor:null,checkedAt:'2026-11-05T10:00:00Z',currency:'GHS'});return Response.json([]);}));
  const view=render(<MarketplaceHub {...props}/>);fireEvent.click(screen.getByRole('tab',{name:'My listings'}));await screen.findByText('Your catalog is ready for its first listing');await act(async()=>{await Promise.resolve();});fireEvent.click(screen.getByRole('button',{name:'Add product'}));
  fireEvent.change(screen.getByLabelText('Product name'),{target:{value:'Captured seller product'}});fireEvent.change(screen.getByLabelText('Selling price · GHS'),{target:{value:'12'}});fireEvent.change(screen.getByLabelText('Category'),{target:{value:'Books'}});fireEvent.change(screen.getByLabelText(/Product photo/),{target:{files:[new File(['synthetic'],'private-photo.png',{type:'image/png'})]}});
  fireEvent.click(screen.getByRole('button',{name:/Save listing/}));expect(reader).not.toBeNull();who=B;view.rerender(<MarketplaceHub {...props} account={{id:B,ecoId:'seller.b'}}/>);await act(async()=>{reader!.onload?.();});expect(writes).toEqual([]);expect(screen.queryByText(/private-photo.png/)).toBeNull();
 });
});
