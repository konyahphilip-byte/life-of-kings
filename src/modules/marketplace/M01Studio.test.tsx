import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import M01Studio from './M01Studio';
const seller={id:'00000000-0000-4000-8000-000000000001',eco_id:'native.seller',display_name:'Native Seller',roles:['seller']};
const shop={id:'00000000-0000-4000-8000-000000000002',name:'Life of Kings',slug:'life-of-kings',status:'draft',ownerEcoId:'native.seller'};
let calls:Array<{url:string,init?:RequestInit}>;
beforeEach(()=>{
 window.history.replaceState(null,'','/m01');
 calls=[];
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(input);calls.push({url,init});
  if(url.endsWith('/auth/me'))return Response.json({user:seller,csrfToken:'fixture-csrf'});
  if(url.endsWith('/studio/shops'))return Response.json({shops:[shop]});
  if(url.includes('/products'))return Response.json({products:[]});
  return Response.json({});
 }));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('exposes the four native seller workspaces',async()=>{
 render(<M01Studio/>);
 await screen.findByRole('heading',{name:'Add Product'});
 for(const name of ['Add Product','My Inventory','Buyer Enquiries','My Storefront'])expect(screen.getByRole('button',{name})).toBeTruthy();
});
it('starts a native product form without a Shopify catalogue selection',async()=>{
 render(<M01Studio/>);
 await screen.findByLabelText('Product title');
 expect(screen.getByLabelText('Product title').getAttribute('value')).toBe('');
 expect(screen.getByLabelText('Price (GH₵)')).toBeTruthy();
 expect(screen.getByLabelText('Category')).toBeTruthy();
 expect(screen.getByLabelText('Photos')).toBeTruthy();
 expect(screen.getByText('Optional Shopify import')).toBeTruthy();
});
it('does not treat photo selection as permission to publish',async()=>{
 render(<M01Studio/>);await screen.findByLabelText('Photos');
 expect(screen.getByLabelText('I have permission to use these photos')).toBeTruthy();
 expect(calls.some(c=>c.init?.method==='POST')).toBe(false);
 expect(screen.queryByText('Published')).toBeNull();
});
it('saves to the native authority with existing CSRF protection',async()=>{
 const id='00000000-0000-4000-8000-000000000003';
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(input);calls.push({url,init});
  if(url.endsWith('/auth/me'))return Response.json({user:seller,csrfToken:'fixture-csrf'});
  if(url.endsWith('/studio/shops'))return Response.json({shops:[shop]});
  if(init?.method==='POST')return Response.json({product:{id,shopId:shop.id,title:'Original tee',description:'',categoryId:'fashion',priceMinor:22000,stock:3,variants:[],gallery:[],collection:'',availability:'in_stock',revision:1,publication:'draft',moderation:'pending'}});
  return Response.json({products:[]});
 }));
 render(<M01Studio/>);
 fireEvent.change(await screen.findByLabelText('Product title'),{target:{value:'Original tee'}});
 fireEvent.change(screen.getByLabelText('Price (GH₵)'),{target:{value:'220'}});
 fireEvent.change(screen.getByLabelText('Quantity available'),{target:{value:'3'}});
 fireEvent.click(screen.getByRole('button',{name:'Save draft'}));
 await waitFor(()=>expect(calls.some(c=>c.init?.method==='POST'&&c.url.endsWith('/products'))).toBe(true));
 const saved=calls.find(c=>c.init?.method==='POST'&&c.url.endsWith('/products'))!;
 expect(new Headers(saved.init?.headers).get('X-CSRF-Token')).toBe('fixture-csrf');
 const body=JSON.parse(String(saved.init?.body));expect(body.priceMinor).toBe(22000);expect(body.title).toBe('Original tee');
 expect(calls.filter(c=>/orders|checkout|payments/.test(c.url))).toEqual([]);
});

it('blocks publication when the form differs from the approved saved revision',async()=>{
 const product={id:'00000000-0000-4000-8000-000000000003',shopId:shop.id,title:'Approved tee',description:'Reviewed description',categoryId:'fashion',priceMinor:22000,stock:3,availability:'in_stock',collection:'',variants:[],gallery:[{assetId:'00000000-0000-4000-8000-000000000004',alt:'Reviewed photo'}],revision:1,publication:'draft',moderation:'approved',approvedRevision:1};
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
  const url=String(input);
  if(url.endsWith('/auth/me'))return Response.json({user:seller,csrfToken:'fixture-csrf'});
  if(url.endsWith('/studio/shops'))return Response.json({shops:[shop]});
  if(url.endsWith('/products'))return Response.json({products:[product]});
  return Response.json({});
 }));
 render(<M01Studio/>);
 fireEvent.click(await screen.findByRole('button',{name:'My Inventory'}));
 fireEvent.click(await screen.findByRole('button',{name:'Edit product'}));
 fireEvent.click(screen.getByLabelText('I confirm current supply and approve public publication.'));
 expect((screen.getByRole('button',{name:'Publish approved product'}) as HTMLButtonElement).disabled).toBe(false);
 fireEvent.change(screen.getByLabelText('Product title'),{target:{value:'Unsaved replacement title'}});
 expect((screen.getByRole('button',{name:'Publish approved product'}) as HTMLButtonElement).disabled).toBe(true);
});

it('refreshes saved review state when returning to inventory',async()=>{
 const product={id:'00000000-0000-4000-8000-000000000003',shopId:shop.id,title:'Reviewed tee',description:'Actual saved draft',categoryId:'fashion',priceMinor:22000,stock:0,availability:'out_of_stock',collection:'',variants:[],gallery:[],revision:1,publication:'draft',moderation:'pending'};
 let approved=false;
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(input);
  if(url.endsWith('/auth/me'))return Response.json({user:{...seller,roles:['seller','admin']},csrfToken:'fixture-csrf'});
  if(url.endsWith('/studio/shops'))return Response.json({shops:[shop]});
  if(url.endsWith('/studio/reviews'))return Response.json({shops:[],products:[{...product,reviewContentHash:'a'.repeat(64),selfReview:true,reviewAuthorized:true,eligibility:{allowed:true}}]});
  if(init?.method==='POST'&&url.includes('/studio/reviews/products/')){approved=true;return Response.json({reviewed:true});}
  if(url.endsWith('/products'))return Response.json({products:[{...product,moderation:approved?'approved':'pending'}]});
  return Response.json({});
 }));
 render(<M01Studio/>);await screen.findByLabelText('Product title');
 fireEvent.click(screen.getByText('Review',{selector:'button'}));
 await screen.findByLabelText('Decision');
 fireEvent.change(screen.getByLabelText('Decision'),{target:{value:'approved'}});
 fireEvent.change(screen.getByLabelText('Reason for this decision'),{target:{value:'Reviewed the exact ordinary tee version.'}});
 fireEvent.click(screen.getByLabelText(/I am explicitly reviewing/));
 fireEvent.click(screen.getByText('Record review decision',{selector:'button'}));
 await screen.findByText('Exact-version review receipt recorded. Seller publication remains a separate step.');
 fireEvent.click(screen.getByText('My Inventory',{selector:'button'}));
 await screen.findByText(/draft\s*·\s*approved/);
});
