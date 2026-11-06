import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {CHALE_UI_KEY,readChaleUI,saveChaleUI} from './chale-ui';

describe('Chale display preferences',()=>{
 beforeEach(()=>{localStorage.clear();saveChaleUI({launcher:'compact',edge:'right',showCharacter:false});});
 afterEach(()=>vi.restoreAllMocks());
 it('defaults to a compact launcher without an active character',()=>{
  localStorage.removeItem(CHALE_UI_KEY);
  expect(readChaleUI()).toEqual({launcher:'compact',edge:'right',showCharacter:false});
 });
 it('persists only non-sensitive display fields',()=>{
  saveChaleUI({launcher:'hidden',edge:'left',showCharacter:true,privateToken:'discard'} as never);
  expect(JSON.parse(localStorage.getItem(CHALE_UI_KEY)!)).toEqual({launcher:'hidden',edge:'left',showCharacter:true});
 });
 it('rejects malformed or unsupported stored choices',()=>{
  for(const raw of ['invalid','null','[]','{"launcher":"off","edge":"outside","showCharacter":"false"}']){
   localStorage.setItem(CHALE_UI_KEY,raw);
   expect(readChaleUI()).toEqual({launcher:'compact',edge:'right',showCharacter:false});
  }
 });
 it('keeps a tab-local choice and reports failure when saving is unavailable',()=>{
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('unavailable');});
  expect(saveChaleUI({launcher:'hidden',edge:'left',showCharacter:false})).toBe(false);
  expect(readChaleUI().launcher).toBe('hidden');
 });
});
