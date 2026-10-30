import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import App from './App';

vi.mock('./assistant/Sidekick',()=>({default:()=>null}));
beforeEach(()=>{
 localStorage.clear();sessionStorage.clear();window.history.replaceState(null,'','/');
 vi.stubGlobal('scrollTo',vi.fn());vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}}));
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>String(input).endsWith('/auth/me')?Response.json({user:null,csrfToken:null}):Response.json({error:{message:'Synthetic API outage'}},{status:503})));
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
const navigate=(detail:unknown)=>act(()=>window.dispatchEvent(new CustomEvent('ecovibes:navigate',{detail})));
describe('actual app navigation recovery',()=>{
 it('keeps the current screen mounted when mobile Create opens its composer',()=>{
  render(<App/>);navigate('Profile');const nav=screen.getByRole('navigation',{name:'Main navigation'});fireEvent.click(within(nav).getByRole('button',{name:'Create'}));expect(screen.getByRole('heading',{name:'Share a moment'})).toBeTruthy();expect(screen.getByRole('heading',{name:'Guest preview'})).toBeTruthy();expect(window.location.hash).toBe('#profile');
 });
 it('closes the composer on browser Back and preserves its local draft',async()=>{
  render(<App/>);navigate('Create');fireEvent.click(screen.getByRole('button',{name:/Write a post/}));const field=await screen.findByPlaceholderText('What’s on your mind?');fireEvent.change(field,{target:{value:'Unsent local draft'}});
  act(()=>{window.history.replaceState(null,'','/#profile');window.dispatchEvent(new PopStateEvent('popstate'));});expect(screen.queryByRole('heading',{name:'Share a moment'})).toBeNull();navigate('Create');fireEvent.click(screen.getByRole('button',{name:/Write a post/}));expect((screen.getByPlaceholderText('What’s on your mind?') as HTMLTextAreaElement).value).toBe('Unsent local draft');fireEvent.click(screen.getByRole('button',{name:'Close'}));expect(window.location.hash).toBe('#create');expect(screen.getByRole('button',{name:/List a product/})).toBeTruthy();
 });
 it('preserves the existing Create options and their real navigation',async()=>{
  render(<App/>);navigate('Create');expect(await screen.findByRole('heading',{name:'Create'})).toBeTruthy();expect(screen.getByRole('button',{name:/Share a photo/})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:/List a product/}));expect(await screen.findByRole('heading',{name:'One account. Shared services.'})).toBeTruthy();
 });
 it('shows an understandable unsupported destination instead of a blank page',async()=>{
  render(<App/>);navigate({screen:'unknown',secret:'must-not-display'});
  const alert=await screen.findByRole('alert');expect(alert.textContent).toContain('destination');expect(alert.textContent).not.toContain('must-not-display');
  fireEvent.click(within(alert).getByRole('button',{name:'Back to Home'}));expect(screen.getByRole('heading',{name:/Welcome to EcoVibes/})).toBeTruthy();
 });
 it('opens a messages deep link and follows browser Back to another valid screen',async()=>{
  window.history.replaceState(null,'','/#messages');render(<App/>);expect(await screen.findByRole('heading',{name:'Messages'})).toBeTruthy();
  act(()=>{window.history.replaceState(null,'','/#profile');window.dispatchEvent(new PopStateEvent('popstate'));});expect(screen.getByRole('heading',{name:'Guest preview'})).toBeTruthy();
 });
 it('keeps unknown deep links actionable without echoing arbitrary URL text',async()=>{
  window.history.replaceState(null,'','/#unknown-private-value');render(<App/>);
  const alert=await screen.findByRole('alert');expect(alert.textContent).not.toContain('unknown-private-value');expect(within(alert).getByRole('button',{name:'Back to Home'})).toBeTruthy();
 });
 it('writes a stable destination for ordinary navigation and handles hash changes',async()=>{
  render(<App/>);navigate('Waste');expect(window.location.hash).toBe('#waste');
  act(()=>{window.history.replaceState(null,'','/#settings');window.dispatchEvent(new HashChangeEvent('hashchange'));});expect(screen.getByRole('heading',{name:'Settings'})).toBeTruthy();
 });
});
