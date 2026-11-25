import {describe,it,expect} from 'vitest';
import {resolvePublicShop, canonicalPublicLink, validateSlugAssignment} from './routing.mjs';
import {createDraft,defaultTheme} from './design.mjs';
const shop={id:'lok-permanent-id',merchantId:'merchant-lok',canonicalSlug:'life-of-kings',status:'active',visibility:'public',publication:'published',products:[{id:'tee'}],collections:['streetwear'],messages:['enquiry-1'],staff:['founder'],customerAccess:'public-read-authenticated-enquiry'};
const registry={shops:[shop],slugs:[{slug:'life-of-kings',shopId:shop.id},{slug:'life-of-kings-old',shopId:shop.id}]};
describe('immutable shop identity / replaceable appearance / public route separation',()=>{
 it('switches Life of Kings away from Concept D and back with every business reference and public URL intact',()=>{
  const before=structuredClone(shop), route=resolvePublicShop('life-of-kings',registry), d=createDraft(defaultTheme(shop),shop);
  d.edit({templateId:'precision-showroom',templateVersion:'0.1.0',layout:'showroom'}); d.edit({templateId:'the-living-edit',templateVersion:'0.1.0',layout:'editorial'});
  expect(shop).toEqual(before); expect(resolvePublicShop('life-of-kings',registry)).toEqual(route);
  expect(shop.products).toEqual(before.products); expect(shop.collections).toEqual(before.collections);
  expect(shop.messages).toEqual(before.messages); expect(shop.staff).toEqual(before.staff); expect(shop.customerAccess).toEqual(before.customerAccess);
 });
 it('redirects old slugs to a local canonical path through immutable identity',()=>{
  expect(resolvePublicShop('life-of-kings-old',registry)).toEqual({status:308,shopId:shop.id,location:'/shop/life-of-kings'});
 });
 it.each(['draft','suspended','removed'])('does not expose an unavailable shop: %s',status=>{
  expect(resolvePublicShop('life-of-kings',{...registry,shops:[{...shop,status}]})).toEqual({status:404});
 });
 it('does not expose unpublished or private shops through either canonical or historical links',()=>{
  for(const patch of [{visibility:'private'},{publication:'draft'}])for(const slug of ['life-of-kings','life-of-kings-old'])
   expect(resolvePublicShop(slug,{...registry,shops:[{...shop,...patch}]})).toEqual({status:404});
 });
 it('fails closed on a hijacked alias or malformed canonical path',()=>{
  expect(resolvePublicShop('life-of-kings',{...registry,slugs:[...registry.slugs,{slug:'life-of-kings',shopId:'other'}]})).toEqual({status:404});
  expect(resolvePublicShop('life-of-kings',{...registry,shops:[{...shop,canonicalSlug:'//evil.test'}]})).toEqual({status:404});
 });
 it('reserves historical slugs permanently and rejects reserved or unsafe names',()=>{
  expect(()=>validateSlugAssignment('life-of-kings-old','other',registry.slugs)).toThrow('SLUG_TAKEN');
  for(const slug of ['admin','api','studio','../../evil','hello%2fthere','//evil.test','Life Of Kings'])expect(()=>validateSlugAssignment(slug,shop.id,[])).toThrow('INVALID_SLUG');
 });
 it('requires a verified HTTPS origin and a published projection before producing a public link',()=>{
  expect(canonicalPublicLink({origin:'https://ecovibes-api.onrender.com',verified:true},shop)).toBe('https://ecovibes-api.onrender.com/shop/life-of-kings');
  expect(()=>canonicalPublicLink({origin:'https://unknown.test',verified:false},shop)).toThrow('PUBLIC_ORIGIN_UNVERIFIED');
  for(const origin of ['javascript:alert(1)','https://good.test@evil.test','https://good.test/path','http://good.test'])expect(()=>canonicalPublicLink({origin,verified:true},shop)).toThrow('PUBLIC_ORIGIN_UNVERIFIED');
  expect(()=>canonicalPublicLink({origin:'https://ecovibes-api.onrender.com',verified:true},{...shop,publication:'draft'})).toThrow('SHOP_NOT_PUBLIC');
 });
});
