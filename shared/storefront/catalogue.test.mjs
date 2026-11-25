import {describe,it,expect} from 'vitest';
import {publicListings} from './catalogue.mjs';
const merchant={id:'m1',status:'active',visibility:'public'},shop={id:'s1',merchantId:'m1',status:'active',visibility:'public',publication:'published'};
const listing={id:'p1',shopId:'s1',merchantId:'m1',title:'Source tee',description:'Cotton tee',currency:'GHS',categoryId:'fashion',publication:'published',moderation:'approved',status:'active',priceMinor:22000,availability:'unconfirmed',imageId:'image1',costMinor:123,supplierSecret:'private'};
function read(records,extra={}){return publicListings({listings:records,shops:[shop],merchants:[merchant],eligibleCategories:['fashion'],...extra})}
describe('one authoritative listing / all public surfaces',()=>{
 it('returns one reusable public projection and omits private fields',()=>{
  const result=read([listing]); expect(result).toHaveLength(1);
  expect(read([listing],{shopId:'s1',listingId:'p1'})).toEqual(result);
  expect(read([listing],{listingId:'other-product'})).toEqual([]);
  expect(result[0]).not.toHaveProperty('costMinor');expect(result[0]).not.toHaveProperty('supplierSecret');
 });
 it('reflects updates from the same source without copying or separate submission',()=>{
  const source=structuredClone(listing);source.priceMinor=24000;source.title='Updated tee';source.description='Revised description';source.currency='GHS';source.imageId='image2';source.availability='confirm_with_seller';
  const a=read([source]);expect(a[0]).toMatchObject({priceMinor:24000,title:'Updated tee',description:'Revised description',currency:'GHS',imageId:'image2',availability:'confirm_with_seller'});
  expect(read([source],{shopId:'s1'})).toEqual(a);
 });
 it.each([{publication:'draft'},{publication:'unpublished'},{status:'archived'},{status:'removed'},{moderation:'rejected'},{moderation:'pending'},{categoryId:'animals'}])('excludes every ineligible listing from the reusable projection: %j',patch=>{
  expect(read([{...listing,...patch}])).toEqual([]);
  expect(read([{...listing,...patch}],{shopId:'s1',listingId:'p1'})).toEqual([]);
 });
 it('removes suspended and hidden merchants/shops and rejects ownership mismatches',()=>{
  for(const extra of [{merchants:[{...merchant,visibility:'private'}]},{merchants:[{...merchant,status:'suspended'}]},{shops:[{...shop,visibility:'private'}]},{shops:[{...shop,status:'suspended'}]},{shops:[{...shop,merchantId:'other'}]}])expect(read([listing],extra)).toEqual([]);
 });
 it('isolates shops even under one merchant and rejects duplicate authoritative identities',()=>{
  expect(read([listing],{shopId:'s2'})).toEqual([]);
  expect(()=>read([listing,{...listing,shopId:'s2'}])).toThrow('DUPLICATE_LISTING');
 });
 it('requires explicit eligibility and no appearance configuration can change visibility',()=>{
  expect(read([{...listing,moderation:undefined}])).toEqual([]);
  expect(read([listing],{theme:{templateId:'other',publication:'draft'}})).toEqual(read([listing]));
 });
});
