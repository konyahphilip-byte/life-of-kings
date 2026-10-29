import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import PrivacyPermissions from './PrivacyPermissions';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('checks individual browser status without requesting access and explains settings recovery',async()=>{
 const mic=new EventTarget() as EventTarget&{state:string};mic.state='granted';
 const camera=new EventTarget() as EventTarget&{state:string};camera.state='denied';
 const capture=vi.fn();Object.defineProperty(navigator,'permissions',{value:{query:vi.fn(async({name})=>name==='camera'?camera:mic)},configurable:true});Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:capture},configurable:true});vi.stubGlobal('isSecureContext',true);
 render(<PrivacyPermissions/>);await screen.findByText('Blocked in browser');await screen.findByText('Allowed in browser');expect(capture).not.toHaveBeenCalled();
 mic.state='denied';act(()=>mic.dispatchEvent(new Event('change')));expect(screen.queryByText('Allowed in browser')).toBeNull();
 const stop=vi.fn(),revoke=vi.fn();window.addEventListener('ecovibes:stop_devices',stop);window.addEventListener('ecovibes:revoke_ai',revoke);
 fireEvent.click(screen.getByRole('button',{name:'Stop active camera and microphone'}));fireEvent.click(screen.getByRole('button',{name:'Turn off Chale model processing'}));
 expect(stop).toHaveBeenCalledOnce();expect(revoke).toHaveBeenCalledOnce();expect(capture).not.toHaveBeenCalled();window.removeEventListener('ecovibes:stop_devices',stop);window.removeEventListener('ecovibes:revoke_ai',revoke);
});
