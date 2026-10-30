import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {DepthScene,DepthToggle,useDepthView} from './DepthView';
import {EcoVibesAfricaOSHome} from './EcoVibesAfricaOSHome';

let reduced=false;
function Example({saver='standard'}:{saver?:'standard'|'saver'|'extreme'}){const view=useDepthView(saver);return <><DepthToggle view={view}/><DepthScene kind="collection" depth={view.depth}/></>;}
beforeEach(()=>{reduced=false;localStorage.clear();vi.stubGlobal('matchMedia',()=>({matches:reduced,addEventListener:()=>{},removeEventListener:()=>{}}));vi.stubGlobal('CSS',{supports:()=>true});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('optional lightweight spatial scenes',()=>{
 it('switches to flat view and remembers only a non-sensitive visual preference',()=>{const {container,unmount}=render(<Example/>);expect(container.querySelector('[data-depth="3d"]')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Use 2D view'}));expect(container.querySelector('[data-depth="2d"]')).toBeTruthy();unmount();render(<Example/>);expect(screen.getByRole('button',{name:'Use 3D view'})).toBeTruthy();expect(localStorage.getItem('ecovibes:depth-view:v1')).toBe('flat');});
 it.each(['saver','extreme'] as const)('keeps %s flat even if depth was chosen previously',saver=>{localStorage.setItem('ecovibes:depth-view:v1','depth');const {container}=render(<Example saver={saver}/>);expect(container.querySelector('[data-depth="2d"]')).toBeTruthy();expect(screen.queryByRole('button',{name:'Use 2D view'})).toBeNull();expect(screen.getByText(/Data Saver/)).toBeTruthy();});
 it('uses the flat illustration when reduced motion or CSS 3D support prevents depth',()=>{reduced=true;const {container,unmount}=render(<Example/>);expect(container.querySelector('[data-depth="3d"]')).toBeNull();unmount();reduced=false;vi.stubGlobal('CSS',{supports:()=>false});render(<Example/>);expect(document.querySelector('[data-depth="3d"]')).toBeNull();});
 it('keeps every Home pillar and Chale reachable when the scene is flat',()=>{const navigate=vi.fn(),ask=vi.fn();render(<EcoVibesAfricaOSHome saver="extreme" onNavigate={navigate} onAskAI={ask}/>);for(const [name,target] of [['Connect','Communities'],['Create','Reels'],['Play','Gaming'],['Trade','Marketplace'],['Grow','Opportunities'],['Earn','Money & Trust']]){fireEvent.click(screen.getByRole('button',{name:new RegExp('^'+name)}));expect(navigate).toHaveBeenLastCalledWith(target);}fireEvent.click(screen.getByRole('button',{name:'Ask Chale AI'}));expect(ask).toHaveBeenCalledOnce();expect(document.querySelector('[data-depth="3d"]')).toBeNull();});
});
