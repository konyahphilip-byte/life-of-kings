import {lazy,Suspense} from 'react';
import {createRoot,type RootOptions} from 'react-dom/client';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {ScreenBoundary,ScreenPending} from './ScreenBoundary';
import * as ScreenModule from './ScreenBoundary';
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers();});
describe('recoverable screen states',()=>{
 it('recovers a transient Home failure when Back to Home keeps the same page key',()=>{
  vi.spyOn(console,'error').mockImplementation(()=>{});let broken=true;function Home(){if(broken)throw Error('temporary');return <h1>Home restored</h1>;}
  render(<ScreenBoundary screen="Home" online onHome={()=>{broken=false;}}><Home/></ScreenBoundary>);fireEvent.click(screen.getByRole('button',{name:'Back to Home'}));expect(screen.getByRole('heading',{name:'Home restored'})).toBeTruthy();
 });
 it('keeps the actual React root error reporter from logging private exception text',async()=>{
  const output=vi.spyOn(console,'error').mockImplementation(()=>{}),container=document.createElement('div');document.body.append(container);
  const options='screenErrorOptions' in ScreenModule?ScreenModule.screenErrorOptions as RootOptions:undefined,root=createRoot(container,options);
  function Broken(){throw Error('private-form-value=synthetic-secret');return null;}
  try{await act(async()=>root.render(<ScreenBoundary screen="Home" onHome={()=>{}}><Broken/></ScreenBoundary>));expect(output.mock.calls.length).toBeGreaterThan(0);expect(output.mock.calls.flat().map(String).join('\n')).not.toContain('synthetic-secret');}
  finally{await act(async()=>root.unmount());container.remove();}
 });
 it('contains a rejected lazy module and keeps safe recovery actions without exposing error details',async()=>{
  vi.spyOn(console,'error').mockImplementation(()=>{});const Broken=lazy(()=>Promise.reject(Error('private transaction text'))),home=vi.fn(),reload=vi.fn();
  render(<ScreenBoundary screen="Calls & Live" online onHome={home} onReload={reload}><Suspense fallback={<p>Opening call screen</p>}><Broken/></Suspense></ScreenBoundary>);
  const alert=await screen.findByRole('alert');expect(alert.textContent).toContain('could not be opened');expect(alert.textContent).not.toContain('private transaction text');
  fireEvent.click(screen.getByRole('button',{name:'Reload app'}));expect(reload).toHaveBeenCalledOnce();fireEvent.click(screen.getByRole('button',{name:'Back to Home'}));expect(home).toHaveBeenCalledOnce();
 });
 it('offers escape when a lazy screen never finishes, and stops its timer on unmount',async()=>{
  vi.useFakeTimers();const home=vi.fn(),reload=vi.fn();const view=render(<ScreenPending screen="EcoVibes ID" online onHome={home} onReload={reload}/>);
  expect(screen.getByRole('status').textContent).toContain('Opening');await act(()=>vi.advanceTimersByTimeAsync(15000));expect(screen.getByRole('status').textContent).toContain('longer');fireEvent.click(screen.getByRole('button',{name:'Back to Home'}));expect(home).toHaveBeenCalledOnce();view.unmount();expect(vi.getTimerCount()).toBe(0);
 });
 it('distinguishes an offline screen load and disables reload while offline',()=>{
  render(<ScreenPending screen="Settings" online={false} onHome={()=>{}}/>);expect(screen.getByRole('status').textContent).toContain('offline');expect((screen.getByRole('button',{name:'Reload app'}) as HTMLButtonElement).disabled).toBe(true);
 });
});
