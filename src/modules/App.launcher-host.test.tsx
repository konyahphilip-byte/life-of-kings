import {act,cleanup,render} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const homeRender=vi.hoisted(()=>vi.fn());
vi.mock('./assistant/Sidekick',()=>({default:()=>null}));
vi.mock('./EcoVibesAfricaOSHome',()=>({EcoVibesAfricaOSHome:()=>{homeRender();return null;}}));
// This test measures App's header-attachment renders, not news/feed rendering.
// App.routes.test.tsx retains the actual full screens and API-outage assertions.
vi.mock('./HappeningNow',()=>({default:()=>null}));
vi.mock('./Recommendations',()=>({default:()=>null}));
vi.mock('../data/seed',async original=>({...await original<typeof import('../data/seed')>(),initialPosts:[],products:[]}));
import App from './App';
beforeEach(()=>{localStorage.clear();sessionStorage.clear();homeRender.mockClear();window.history.replaceState(null,'','/');vi.stubGlobal('scrollTo',vi.fn());vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}}));vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>String(input).endsWith('/auth/me')?Response.json({user:null,csrfToken:null}):Response.json({error:{message:'Synthetic API outage'}},{status:503})));});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();window.history.replaceState(null,'','/');});
it('does not rerender Home solely to attach the Chale header host',async()=>{await act(async()=>{render(<App/>);});expect(homeRender).toHaveBeenCalledTimes(1);});
