import {describe,expect,it} from 'vitest';
import {destinationUrl,isDestination,readNavigation} from './navigation';
describe('safe screen destinations',()=>{
 it('does not copy account callback credentials into new unrelated history entries',()=>{
  expect(destinationUrl('Messages',{pathname:'/',search:'?code=synthetic-private&recovery=1&campaign=ghana'})).toBe('/?campaign=ghana#messages');
 });
 it('allows an explicit implemented destination after leaving a callback URL',()=>{
  expect(readNavigation({hash:'#home',search:'?recovery=1'})).toEqual({page:'Home',composer:false,unavailable:false});expect(readNavigation({hash:'#messages',search:'?code=synthetic'})).toEqual({page:'Messages',composer:false,unavailable:false});
 });
 it('does not accept arbitrary event payloads as renderable pages',()=>{
  expect(isDestination({page:'Profile'})).toBe(false);expect(isDestination('__proto__')).toBe(false);expect(isDestination(null)).toBe(false);expect(isDestination('Waste')).toBe(true);
 });
 it('preserves a valid old deep link and distinguishes an unknown destination',()=>{
  expect(readNavigation({hash:'#money-trust',search:''})).toEqual({page:'Money & Trust',composer:false,unavailable:false});expect(readNavigation({hash:'#not-a-route',search:''})).toEqual({page:'Home',composer:false,unavailable:true});
 });
 it('keeps the existing Create page as a normal deep-linkable destination',()=>{
  expect(readNavigation({hash:'#create',search:''})).toEqual({page:'Create',composer:false,unavailable:false});
 });
 it.each([{hash:'',search:'?recovery=1'},{hash:'#access_token=synthetic-secret&refresh_token=private',search:''},{hash:'',search:'?code=private-code'}])('keeps provider callbacks on the existing account screen without propagating credentials',location=>{
  const result=readNavigation(location);expect(result).toEqual({page:'EcoVibes ID',composer:false,unavailable:false});expect(JSON.stringify(result)).not.toContain('private');expect(JSON.stringify(result)).not.toContain('synthetic-secret');
 });
 it('produces a stable same-origin location without changing query parameters',()=>{
  expect(destinationUrl('Waste',{pathname:'/app',search:'?campaign=ghana'})).toBe('/app?campaign=ghana#waste');
 });
});
