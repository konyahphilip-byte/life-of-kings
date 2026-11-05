import {describe,it,expect,vi} from 'vitest';
import {orderQuote} from './orders.mjs';
import {cartItems,createCartService} from './cart.mjs';
const assert=(ok,status,code,message)=>{if(!ok)throw Object.assign(Error(message),{status,code});};
describe('account cart input and availability boundary',()=>{
 it('normalizes duplicate canonical IDs without changing the input',()=>{const items=[{productId:'p',quantity:1},{productId:'p',quantity:2}];const before=JSON.stringify(items);expect(cartItems(items,assert)).toEqual([{productId:'p',variantId:null,quantity:3}]);expect(JSON.stringify(items)).toBe(before);});
 it('permits an empty absolute cart update',()=>expect(cartItems([],assert)).toEqual([]));
 it.each([null,[null],[{productId:'p',quantity:1,price:1}],[{productId:'p',quantity:1000001}]])('rejects unsupported items %#',value=>expect(()=>cartItems(value,assert)).toThrow(expect.objectContaining({status:400})));
 it.each([{available:false},{enabled:()=>false}])('denies missing or disabled server capability before touching data',async options=>{const q=vi.fn();const svc=createCartService({assert,q,...options});await expect(svc.route({user:{id:'A'}},'GET','/marketplace/cart',{},new URLSearchParams())).rejects.toMatchObject({status:503});expect(q).not.toHaveBeenCalled();});
 it('denies unauthenticated access and private account selectors',async()=>{const q=vi.fn(),svc=createCartService({assert,q});await expect(svc.route({user:null},'GET','/marketplace/cart',{},new URLSearchParams())).rejects.toMatchObject({status:401});await expect(svc.route({user:{id:'A'}},'GET','/marketplace/cart',{},new URLSearchParams('ownerId=B'))).rejects.toMatchObject({status:400});expect(q).not.toHaveBeenCalled();});
});

it('review fingerprints detect item-price changes even when the total is unchanged',()=>{const a=[{productId:'p',quantity:1,unitPriceMinor:1200},{productId:'q',quantity:1,unitPriceMinor:800}];expect(orderQuote(a)).toBe(orderQuote([...a].reverse()));expect(orderQuote(a)).not.toBe(orderQuote([{...a[0],unitPriceMinor:1300},{...a[1],unitPriceMinor:700}]));});
