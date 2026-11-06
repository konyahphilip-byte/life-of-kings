import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import App from './App';

vi.mock('./assistant/Sidekick',()=>({default:()=>null}));
vi.mock('./HomeDepth',()=>({default:()=>null}));
vi.mock('./SocialHub',()=>({PeopleToFollow:()=>null,ReelsPage:()=>null,StoriesStrip:()=>null}));
vi.mock('./connect/NotificationCenter',()=>({default:()=>null}));
beforeEach(()=>{
 localStorage.clear();sessionStorage.clear();
 vi.stubGlobal('scrollTo',vi.fn());
 vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener:()=>{},removeEventListener:()=>{}}));
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>String(input).endsWith('/auth/me')?Response.json({user:null,csrfToken:null}):Response.json({error:{message:'Unavailable'}},{status:503})));
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();window.history.replaceState(null,'','/');});
function open(hash:string){window.history.replaceState(null,'','/#'+hash);render(<App/>);}
function writes(){return vi.mocked(fetch).mock.calls.filter(([,init])=>!['GET','HEAD'].includes(String(init?.method||'GET').toUpperCase()));}
describe('evidence-backed shell states',()=>{
 it('explains unavailable opportunity alerts without claiming a saved subscription or review',async()=>{
  open('opportunities');
  fireEvent.click(await screen.findByRole('button',{name:'About alerts'}));
  const notice=screen.getByRole('status');
  expect(notice.textContent).toContain('No alert subscription was created');
  expect(notice.querySelector('.lucide-check')).toBeNull();
  expect(screen.queryByText('Opportunity alerts enabled')).toBeNull();
  expect(screen.queryByText(/Each listing is reviewed/)).toBeNull();
  expect(screen.getByText(/Example opportunities/)).toBeTruthy();
  expect(writes()).toEqual([]);
 });
 it('does not invent a reward balance or earned badges while retaining illustrative badges',async()=>{
  open('rewards');
  const main=screen.getByRole('main');
  expect(await within(main).findByText('No earned balance available')).toBeTruthy();
  expect(main.querySelectorAll('.badge-card.earned')).toHaveLength(0);
  expect(main.querySelector('.reward-progress')).toBeNull();
  expect(main.textContent).not.toMatch(/240|60 pts|Milestones you’ve earned/);
  expect(within(main).getByRole('heading',{name:'Badge examples'})).toBeTruthy();
  expect(writes()).toEqual([]);
 });
 it('labels communities as examples without invented membership counts or a creation confirmation',async()=>{
  open('communities');
  expect(await screen.findByRole('heading',{name:'Communities'})).toBeTruthy();
  const main=screen.getByRole('main');
  expect(main.textContent).not.toMatch(/1\.2k members|840 members|2\.1k members|690 members/);
  fireEvent.click(within(main).getByRole('button',{name:'Start a community'}));
  expect(screen.getByRole('status').textContent).toContain('No community was created');
  expect(writes()).toEqual([]);
 });
 it('does not claim a game launch notification has been scheduled',async()=>{
  open('gaming');
  fireEvent.click(await screen.findByRole('button',{name:'Notify me'}));
  expect(screen.getByRole('status').textContent).toContain('No subscription was created');
  expect(writes()).toEqual([]);
 });
});

