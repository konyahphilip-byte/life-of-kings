import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import Sidekick from './Sidekick';
import ChalePersonalization from './ChalePersonalization';
import {saveChaleUI} from './chale-ui';

const props={onNavigate:vi.fn(),page:'Home' as const,userId:'test-account',csrfToken:'synthetic',dataMode:'saver' as const,online:true};
describe('Chale launcher and settings',()=>{
 beforeEach(()=>{
  localStorage.clear();saveChaleUI({launcher:'compact',edge:'right',showCharacter:false});
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>Response.json(String(input).endsWith('/ai/chat')?{text:'A useful answer.',source:'model'}:{configured:true,enabled:false})));
 });
 afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
 it('defaults to compact, hides the launcher while open, and restores focus on close',async()=>{
  render(<Sidekick {...props}/>);
  const launch=screen.getByRole('button',{name:'Ask Chale AI'});
  expect(launch.classList.contains('chale-launcher-compact')).toBe(true);
  fireEvent.click(launch);
  expect(screen.queryByRole('button',{name:'Ask Chale AI'})).toBeNull();
  fireEvent.keyDown(window,{key:'Escape'});
  await waitFor(()=>expect(document.activeElement).toBe(launch));
 });
 it('falls back to the launcher when opened programmatically from the page body',()=>{
  render(<Sidekick {...props}/>);
  act(()=>window.dispatchEvent(new Event('ecovibes:assistant_open')));
  fireEvent.keyDown(window,{key:'Escape'});
  expect(document.activeElement).toBe(screen.getByRole('button',{name:'Ask Chale AI'}));
 });
 it('hides over an outside form and returns after editing',async()=>{
  render(<><label>Job details<input aria-label="Job details"/></label><button>Done</button><Sidekick {...props}/></>);
  const input=screen.getByRole('textbox',{name:'Job details'});
  act(()=>input.focus());
  expect(screen.queryByRole('button',{name:'Ask Chale AI'})).toBeNull();
  act(()=>screen.getByRole('button',{name:'Done'}).focus());
  await waitFor(()=>expect(screen.getByRole('button',{name:'Ask Chale AI'})).toBeTruthy());
 });
 it('restores access through Personalization when the launcher is hidden',async()=>{
  saveChaleUI({launcher:'hidden',edge:'left',showCharacter:false});
  render(<><ChalePersonalization/><Sidekick {...props}/></>);
  expect(screen.queryByRole('button',{name:'Ask Chale AI'})).toBeNull();
  const opener=screen.getByRole('button',{name:'Open Chale AI'});
  act(()=>opener.focus());fireEvent.click(opener);
  expect(screen.getByRole('dialog',{name:'Chale AI'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Close Chale AI'}));
  await waitFor(()=>expect(document.activeElement).toBe(opener));
  fireEvent.change(screen.getByLabelText('Chale launcher'),{target:{value:'compact'}});
  expect(screen.getByRole('button',{name:'Ask Chale AI'}).getAttribute('data-edge')).toBe('left');
 });
 it('retains AI replies while optional character visibility is disabled mid-request',async()=>{
  let reply!:(r:Response)=>void;
  vi.stubGlobal('fetch',vi.fn((input:RequestInfo|URL)=>String(input).endsWith('/ai/chat')?new Promise(resolve=>{reply=resolve;}):Promise.resolve(Response.json({configured:true,enabled:false}))));
  saveChaleUI({launcher:'compact',edge:'right',showCharacter:true});
  render(<><ChalePersonalization/><Sidekick {...props}/></>);
  fireEvent.click(screen.getByRole('button',{name:'Ask Chale AI'}));
  fireEvent.change(screen.getByRole('textbox',{name:'Ask Chale AI'}),{target:{value:'Help me prepare for an interview'}});
  fireEvent.click(screen.getByRole('button',{name:'Send question'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'Show Chale 3D Character'}));
  await act(async()=>reply(Response.json({text:'Your conversation stays available.',source:'model'})));
  expect(screen.getByText('Your conversation stays available.')).toBeTruthy();
  expect((screen.getByRole('checkbox',{name:'Show Chale 3D Character'}) as HTMLInputElement).checked).toBe(false);
  expect(screen.getByText(/The 3D character is not available in this build/)).toBeTruthy();
 });
 it('applies cross-tab display changes without closing or clearing chat',async()=>{
  render(<Sidekick {...props}/>);
  fireEvent.click(screen.getByRole('button',{name:'Ask Chale AI'}));
  localStorage.setItem('ecovibes:chale-ui:v1',JSON.stringify({launcher:'labelled',edge:'left',showCharacter:false}));
  act(()=>window.dispatchEvent(new StorageEvent('storage',{key:'ecovibes:chale-ui:v1'})));
  expect(screen.getByRole('dialog',{name:'Chale AI'}).getAttribute('data-edge')).toBe('left');
 });
 it('keeps the panel within the reported visual viewport when the keyboard opens',()=>{
  const viewport=Object.assign(new EventTarget(),{height:430,offsetTop:0});
  vi.stubGlobal('innerHeight',844);vi.stubGlobal('visualViewport',viewport);
  render(<Sidekick {...props}/>);fireEvent.click(screen.getByRole('button',{name:'Ask Chale AI'}));
  const panel=screen.getByRole('dialog',{name:'Chale AI'});
  expect(panel.classList.contains('chale-keyboard')).toBe(true);
  expect(panel.style.getPropertyValue('--chale-viewport-height')).toBe('430px');
  expect(panel.style.getPropertyValue('--chale-keyboard-inset')).toBe('414px');
  act(()=>{viewport.height=844;viewport.dispatchEvent(new Event('resize'));});
  expect(panel.classList.contains('chale-keyboard')).toBe(false);
 });
});
