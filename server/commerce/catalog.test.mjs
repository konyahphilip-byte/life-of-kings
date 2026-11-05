import {describe,it,expect} from 'vitest';
import {catalogInput,catalogCursor,createCatalog} from './catalog.mjs';
const assert=(ok,status,code,message)=>{if(!ok)throw Object.assign(Error(message),{status,code});};
const query=text=>catalogInput(new URLSearchParams(text),assert);
describe('public marketplace catalog boundary',()=>{
 it('supports a deny-only switch without querying listings',async()=>{let reads=0;const cat=createCatalog({all:async()=>{reads++;return[];},assert,publicProduct:x=>x,now:()=>'',enabled:()=>false});await expect(cat({},new URLSearchParams())).rejects.toMatchObject({status:503,code:'catalog_unavailable'});expect(reads).toBe(0);});
 it('uses bounded native catalog defaults',()=>{expect(query('')).toMatchObject({limit:12,sort:'newest',source:'',inStock:false});});
 it('accepts exact public filters without private selectors',()=>{expect(query('q=Fridge&seller=%40Makola.shop&minPrice=100&maxPrice=5000&source=direct&inStock=1')).toMatchObject({q:'Fridge',seller:'makola.shop',minPrice:100,maxPrice:5000,source:'direct',inStock:true});});
 it.each(['limit=0','limit=25','minPrice=-1','minPrice=5&maxPrice=1','sort=sql','source=unknown','mine=1','buyerId=private','q=a&q=b','cursor=broken'])('rejects unsupported or ambiguous input: %s',text=>{expect(()=>query(text)).toThrow();});
 it('binds a keyset cursor to its search and sort, not a caller account',()=>{
  const first=query('q=tomatoes&sort=price_low');const cursor=catalogCursor({id:'11111111-1111-4111-8111-111111111111',created_at:'2026-11-05T10:00:00.000Z',price_minor:300},first);
  expect(query('q=tomatoes&sort=price_low&cursor='+cursor).after.id).toBe('11111111-1111-4111-8111-111111111111');
  expect(()=>query('q=phones&sort=price_low&cursor='+cursor)).toThrow();
 });
 it('accepts PostgreSQL timestamp objects in pagination',()=>{
  const input=query('');expect(query('cursor='+catalogCursor({id:'11111111-1111-4111-8111-111111111111',created_at:new Date('2026-11-05T10:00:00Z'),price_minor:100},input)).after.stamp).toBe('2026-11-05T10:00:00.000Z');
 });
});
