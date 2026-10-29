import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import MarketplaceHub from '../MarketplaceHub';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function setup(){const writes:Array<{path:string;body:unknown}>=[];vi.stubGlobal('fetch',vi.fn(async(input,init)=>{const path=String(input);if(init?.method==='POST')writes.push({path,body:JSON.parse(String(init.body))});return Response.json(path.endsWith('/auth/me')?{user:{id:'alpha',roles:['seller']},csrfToken:'test'}:path.endsWith('/social/assets')?{id:'00000000-0000-4000-8000-000000000010'}:init?.method==='POST'?{id:'product',imported:1}:[]);}));
 const view=render(<MarketplaceHub products={[]} onProductsChange={()=>{}} onAddCart={()=>{}} onToggleSaved={()=>{}} saved={[]} onOpenWorkspace={()=>{}}/>);return {writes,view};}
it('requires product-photo consent even if form submit is invoked directly',async()=>{
 const {writes,view}=setup();await act(async()=>{});fireEvent.click(screen.getByRole('tab',{name:/My listings/}));fireEvent.click(screen.getByRole('button',{name:'Add product'}));
 fireEvent.change(screen.getByLabelText('Product name'),{target:{value:'Synthetic product'}});fireEvent.change(screen.getByLabelText('Selling price · GHS'),{target:{value:'10'}});
 fireEvent.change(view.container.querySelector('input[type=file]')!,{target:{files:[new File(['fixture'],'photo.png',{type:'image/png'})]}});
 fireEvent.submit(screen.getByLabelText('Product name').closest('form')!);expect(writes).toHaveLength(0);
 fireEvent.click(screen.getByRole('checkbox',{name:/upload and store/}));fireEvent.submit(screen.getByLabelText('Product name').closest('form')!);
 await waitFor(()=>expect(writes).toHaveLength(2));expect(writes[0].body).toMatchObject({expectedOwnerId:'alpha',mimeType:'image/png'});expect(writes[1].body).toMatchObject({expectedOwnerId:'alpha'});
});
it('previews only the selected CSV locally; switching the selection resets upload consent',async()=>{
 const {writes,view}=setup();await act(async()=>{});fireEvent.click(screen.getByRole('tab',{name:/My listings/}));fireEvent.click(screen.getByRole('button',{name:/Import spreadsheet/}));
 const input=view.container.querySelector('input[type=file]')!;
 fireEvent.change(input,{target:{files:[new File(['name,price\nFixture,10'],'catalog.csv',{type:'text/csv'})]}});await screen.findByText(/1 rows/);
 expect((screen.getByRole('button',{name:'Import 1 products'}) as HTMLButtonElement).disabled).toBe(true);expect(writes).toHaveLength(0);
 fireEvent.click(screen.getByRole('checkbox',{name:/upload and store/}));expect((screen.getByRole('button',{name:'Import 1 products'}) as HTMLButtonElement).disabled).toBe(false);
 fireEvent.change(input,{target:{files:[new File(['name,price\nNew,20'],'second.csv',{type:'text/csv'})]}});await screen.findByText(/1 rows/);expect((screen.getByRole('button',{name:'Import 1 products'}) as HTMLButtonElement).disabled).toBe(true);expect(writes).toHaveLength(0);
});
it('never uploads a photo whose consent was withdrawn while the local file read was pending',async()=>{
 const {writes,view}=setup();await act(async()=>{});let reader!:FileReader;
 const read=vi.spyOn(FileReader.prototype,'readAsDataURL').mockImplementation(function(this:FileReader){reader=this;});
 fireEvent.click(screen.getByRole('tab',{name:/My listings/}));fireEvent.click(screen.getByRole('button',{name:'Add product'}));
 fireEvent.change(screen.getByLabelText('Product name'),{target:{value:'Cancelled product'}});fireEvent.change(screen.getByLabelText('Selling price · GHS'),{target:{value:'10'}});
 fireEvent.change(view.container.querySelector('input[type=file]')!,{target:{files:[new File(['fixture'],'private.png',{type:'image/png'})]}});fireEvent.click(screen.getByRole('checkbox',{name:/upload and store/}));fireEvent.submit(screen.getByLabelText('Product name').closest('form')!);
 fireEvent.click(screen.getByRole('checkbox',{name:/upload and store/}));fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
 await act(async()=>{Object.defineProperty(reader,'result',{value:'data:image/png;base64,cHJpdmF0ZQ==',configurable:true});reader.dispatchEvent(new ProgressEvent('load'));});expect(writes).toHaveLength(0);read.mockRestore();
});
