import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import BackendWorkspace from './BackendWorkspace';

const auth=vi.hoisted(()=>({getSession:vi.fn(),signUp:vi.fn()}));
vi.mock('../../lib/supabase',()=>({supabase:{auth}}));
let member:{id:string;eco_id:string;display_name:string;roles:string[]}|null;
beforeEach(()=>{
 sessionStorage.clear();vi.clearAllMocks();member={id:'synthetic-personal',eco_id:'personal.member',display_name:'Personal Member',roles:['customer']};
 auth.getSession.mockResolvedValue({data:{session:null},error:null});auth.signUp.mockResolvedValue({data:{session:null},error:null});
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>Response.json(String(input).endsWith('/auth/me')?{user:member,csrfToken:'synthetic-csrf'}:[])));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('personal accounts and optional business tools',()=>{
 it('lets a personal member go directly to messages without activating a business role',async()=>{
  const navigate=vi.fn();window.addEventListener('ecovibes:navigate',navigate);render(<BackendWorkspace/>);expect(await screen.findByText('Personal member')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Choose a starting point (optional)'),{target:{value:'personal'}});fireEvent.click(screen.getByRole('button',{name:'Continue'}));expect((navigate.mock.calls[0][0] as CustomEvent).detail).toBe('Messages');
  expect(vi.mocked(fetch).mock.calls.some(([path,options])=>String(path).endsWith('/identity/roles')||options?.method==='POST')).toBe(false);window.removeEventListener('ecovibes:navigate',navigate);
 });
 it('offers None of the above and does not remove existing business permissions',async()=>{
  member!.roles=['customer','provider','seller'];const navigate=vi.fn();window.addEventListener('ecovibes:navigate',navigate);render(<BackendWorkspace/>);await screen.findByText('Personal member');
  const select=screen.getByLabelText('Choose a starting point (optional)');expect(within(select).getByRole('option',{name:'None of the above — personal use'})).toBeTruthy();fireEvent.change(select,{target:{value:'none'}});fireEvent.click(screen.getByRole('button',{name:'Continue'}));expect((navigate.mock.calls[0][0] as CustomEvent).detail).toBe('Home');expect(screen.getByText('provider')).toBeTruthy();expect(screen.getByText('seller')).toBeTruthy();expect(vi.mocked(fetch).mock.calls.some(([,options])=>options?.method&&options.method!=='GET')).toBe(false);window.removeEventListener('ecovibes:navigate',navigate);
 });
 it.each([['seller','Marketplace'],['provider','Quick&Handi']])('opens the %s area without activating its business role',async(choice,destination)=>{
  const navigate=vi.fn();window.addEventListener('ecovibes:navigate',navigate);render(<BackendWorkspace/>);await screen.findByText('Personal member');
  fireEvent.change(screen.getByLabelText('Choose a starting point (optional)'),{target:{value:choice}});fireEvent.click(screen.getByRole('button',{name:'Continue'}));expect((navigate.mock.calls[0][0] as CustomEvent).detail).toBe(destination);
  expect(vi.mocked(fetch).mock.calls.some(([,options])=>options?.method&&options.method!=='GET')).toBe(false);window.removeEventListener('ecovibes:navigate',navigate);
 });
 it('keeps signup purpose optional and separate from security roles',async()=>{
  member=null;render(<BackendWorkspace/>);await waitFor(()=>expect(auth.getSession).toHaveBeenCalled());const form=screen.getByRole('button',{name:'Create EcoVibes account'}).closest('form')!;
  for(const [label,value] of [['Display name','Personal Member'],['EcoVibes ID','personal.member'],['Email','personal@example.invalid'],['Password','Synthetic-only-password-123']])fireEvent.change(within(form).getByLabelText(label==='EcoVibes ID'?/^EcoVibes ID/:label),{target:{value}});
  const purpose=within(form).getByLabelText('What would you like to try first? (optional)');expect((purpose as HTMLSelectElement).required).toBe(false);fireEvent.change(purpose,{target:{value:'none'}});fireEvent.submit(form);await waitFor(()=>expect(auth.signUp).toHaveBeenCalledOnce());
  const data=auth.signUp.mock.calls[0][0].options.data;expect(data.usage_purpose).toBe('none');expect(data.roles).toBeUndefined();expect(data.role).toBeUndefined();expect(vi.mocked(fetch).mock.calls.some(([path])=>String(path).endsWith('/identity/roles'))).toBe(false);
 });
});
