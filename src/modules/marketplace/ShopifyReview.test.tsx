import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import ShopifyReview from './ShopifyReview';
const product={id:'33333333-3333-4333-8333-333333333333',name:'Synthetic tee',reviewHash:'a'.repeat(64),status:'paused',variants:[{id:'v1',title:'M',priceMinor:22000,stock:4},{id:'v2',title:'L',priceMinor:22000,stock:null}]};
const ownerId='11111111-1111-4111-8111-111111111111';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function fill(){fireEvent.change(screen.getByLabelText('Category'),{target:{value:'fashion.clothing'}});fireEvent.change(screen.getByLabelText('Condition'),{target:{value:'new'}});fireEvent.change(screen.getByLabelText('EcoVibes quantity M'),{target:{value:'1'}});fireEvent.change(screen.getByLabelText('Pickup or dispatch area'),{target:{value:'Accra'}});fireEvent.change(screen.getByLabelText('Pickup/delivery terms and costs'),{target:{value:'Pickup free; delivery quoted before order'}});fireEvent.click(screen.getByLabelText(/I have confirmed supply/));}
describe('Shopify reviewed publication',()=>{
 it('starts with zero allocated stock and requires separate photo consent',async()=>{
  const request=vi.fn();render(<ShopifyReview {...{product,ownerId,request}} onDone={vi.fn()} onClose={vi.fn()}/>);expect((screen.getByLabelText('EcoVibes quantity M') as HTMLInputElement).value).toBe('0');fill();fireEvent.click(screen.getByLabelText('Include the source product photo'));fireEvent.click(screen.getByText('Publish reviewed listing'));await screen.findByRole('alert');expect(request).not.toHaveBeenCalled();
 });
 it('retries an immutable request after a lost response and waits for server confirmation',async()=>{
  const onDone=vi.fn();const request=vi.fn().mockRejectedValueOnce(Error('Connection lost')).mockImplementationOnce(async(_p:string,init:RequestInit)=>{const b=JSON.parse(String(init.body));return {response:Response.json({}),value:{ownerId,productId:product.id,publicationId:b.clientId,publishedAt:'2026-11-05T10:00:00Z',currentStatus:'active'}};});
  render(<ShopifyReview {...{product,ownerId,request,onDone}} onClose={vi.fn()}/>);fill();fireEvent.click(screen.getByText('Publish reviewed listing'));await screen.findByText('Connection lost');expect(onDone).not.toHaveBeenCalled();fireEvent.click(screen.getByText('Retry saved publication'));await screen.findByText('Confirming publication…').catch(()=>null);await act(async()=>{await Promise.resolve();});expect(request).toHaveBeenCalledTimes(2);expect(request.mock.calls[0][1].body).toBe(request.mock.calls[1][1].body);expect(Object.keys(JSON.parse(request.mock.calls[0][1].body))).toHaveLength(13);expect(onDone).toHaveBeenCalledWith(expect.stringContaining('Listing published'));
 });
 it('ignores a late publication result after the captured review unmounts',async()=>{
  let resolve!:(v:any)=>void;const onDone=vi.fn(),request=vi.fn(()=>new Promise<any>(r=>resolve=r));const view=render(<ShopifyReview {...{product,ownerId,request,onDone}} onClose={vi.fn()}/>);fill();fireEvent.click(screen.getByText('Publish reviewed listing'));expect(request).toHaveBeenCalledOnce();view.unmount();await act(async()=>resolve({response:Response.json({}),value:{ownerId,productId:product.id,currentStatus:'active'}}));expect(onDone).not.toHaveBeenCalled();
 });
});
