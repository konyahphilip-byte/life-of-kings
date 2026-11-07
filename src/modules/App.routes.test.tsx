import {act,cleanup,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import App from './App';
// These functional route checks use the real screens. Compile their modules
// before the cases; controlled lazy loading/error behavior is tested separately
// in ScreenBoundary.test.tsx rather than timing the local Vite transformer.
import './Communications';
import './backend/BackendWorkspace';
import './EcoLanguageSettings';
import './money/MoneyTrust';

vi.mock('./assistant/Sidekick',()=>({default:()=>null}));
beforeEach(()=>{
 localStorage.clear();sessionStorage.clear();vi.stubGlobal('scrollTo',vi.fn());vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}}));
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>String(input).endsWith('/auth/me')?Response.json({user:null,csrfToken:null}):Response.json({error:{code:'test_outage',message:'Service temporarily unavailable'}},{status:503})));
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();window.history.replaceState(null,'','/');});
describe('real page smoke coverage with unavailable APIs and no account',()=>{
 it.each([
  ['#home',/Welcome to EcoVibes/],['#explore','Explore'],['#create','Create'],['#messages','Messages'],['#calls','Calls & Live'],['#reels','Reels'],['#profile','Guest preview'],['#marketplace','Good things, made by good people.'],['#opportunities','Opportunities'],['#gaming','Gaming'],['#communities','Communities'],['#quick-handi',/Quick.*Handi/],['#waste','Waste, put to better use.'],['#account','One account. Shared services.'],['#rewards','Rewards'],['#wallet','Wallet'],['#money-trust','Money & Trust'],['#settings','Settings'],
 ])('renders %s with a purposeful screen instead of an empty root',async(hash,title)=>{
  window.history.replaceState(null,'','/'+hash);await act(async()=>{render(<App/>);});expect(await screen.findByRole('heading',{name:title,level:1})).toBeTruthy();expect(document.querySelector('.screen-recovery[role="alert"]')).toBeNull();
 });
});
