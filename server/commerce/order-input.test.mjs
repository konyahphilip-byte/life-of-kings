import {describe,it,expect} from 'vitest';
import {normalizeOrderItems} from './order-input.mjs';

describe('commerce order input boundary',()=>{
 it.each([null,[],{},true,{items:[]},{items:[null]},{items:[[]]},{items:[true]},{items:[{}]},{items:[{productId:'',quantity:1}]},{items:[{productId:'x'.repeat(181),quantity:1}]}])('rejects malformed envelope/line %#',body=>{
  expect(()=>normalizeOrderItems(body)).toThrow(expect.objectContaining({status:400,code:'invalid_items'}));
 });
 it.each([null,true,'1',0,-1,1.5,Infinity,Number.MAX_SAFE_INTEGER+1])('rejects unsafe quantity %s',quantity=>{
  expect(()=>normalizeOrderItems({items:[{productId:'p',quantity}]})).toThrow(expect.objectContaining({status:400,code:'invalid_amount'}));
 });
 it('enforces the 30 submitted-line limit before combining duplicates',()=>{
  expect(()=>normalizeOrderItems({items:Array.from({length:31},()=>({productId:'p',quantity:1}))})).toThrow(expect.objectContaining({status:400}));
 });
 it.each([{},[],true,' '.repeat(2),'x'.repeat(181)])('rejects invalid variants %#',variantId=>{
  expect(()=>normalizeOrderItems({items:[{productId:'p',quantity:1,variantId}]})).toThrow(expect.objectContaining({status:400}));
 });
 it('combines duplicate variants without mixing different variants or mutating input',()=>{
  const items=[{productId:'p',variantId:' large ',quantity:2},{productId:'p',variantId:'large',quantity:1},{productId:'p',variantId:'small',quantity:1}];
  const before=JSON.stringify(items);items.forEach(Object.freeze);Object.freeze(items);
  expect([...normalizeOrderItems({items})]).toEqual([['p',[{variantId:'large',qty:3},{variantId:'small',qty:1}]]]);
  expect(JSON.stringify(items)).toBe(before);
 });
 it('uses the same product lock order for reversed client input',()=>{
  const a={productId:'z',quantity:1},b={productId:'a',quantity:1};
  expect([...normalizeOrderItems({items:[a,b]}).keys()]).toEqual(['a','z']);
  expect([...normalizeOrderItems({items:[b,a]}).keys()]).toEqual(['a','z']);
 });
 it('rejects overflow across duplicate and distinct variant quantities',()=>{
  for(const variantId of[null,'other'])expect(()=>normalizeOrderItems({items:[{productId:'p',quantity:Number.MAX_SAFE_INTEGER},{productId:'p',quantity:1,variantId}]})).toThrow(expect.objectContaining({status:400,code:'invalid_quantity'}));
 });
 it('retains the existing absent/empty variant convention and ignores client price/actor',()=>{
  expect([...normalizeOrderItems({items:[{productId:'p',quantity:1},{productId:'p',quantity:1,variantId:''}],priceMinor:1,buyerId:'not-authoritative'})]).toEqual([['p',[{variantId:null,qty:2}]]]);
 });
});
