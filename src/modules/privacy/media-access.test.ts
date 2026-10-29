import {afterEach,describe,expect,it,vi} from 'vitest';
import {MediaAccess,permissionState} from './media-access';

function fixture(state='prompt'){
 const permission=new EventTarget() as EventTarget&{state:string};permission.state=state;
 const track=new EventTarget() as EventTarget&{kind:string;readyState:string;stop:ReturnType<typeof vi.fn>};track.kind='audio';track.readyState='live';track.stop=vi.fn(()=>{track.readyState='ended';});
 const stream={getTracks:()=>[track]};
 const nav={permissions:{query:vi.fn(async()=>permission)},mediaDevices:{getUserMedia:vi.fn(async()=>stream)}} as unknown as Navigator;
 const transport={publish:vi.fn(async()=>{}),unpublish:vi.fn(async()=>{})};let allowed=true;
 const access=new MediaAccess(()=>allowed,transport,()=>{},nav,true);
 return {permission,track,stream,nav,transport,access,revoke:()=>{allowed=false;access.stopAll();}};
}
afterEach(()=>vi.restoreAllMocks());
describe('minimum device access and separate sharing',()=>{
 it('does not capture on construction; captures audio alone and shares only after a separate action',async()=>{
  const f=fixture();expect(f.nav.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  await f.access.capture('microphone',{echoCancellation:true});
  expect(f.nav.mediaDevices.getUserMedia).toHaveBeenCalledWith({audio:{echoCancellation:true},video:false});
  expect(f.transport.publish).not.toHaveBeenCalled();await f.access.share('microphone');
  expect(f.transport.publish).toHaveBeenCalledWith(f.track,'microphone');f.access.dispose();expect(f.track.stop).toHaveBeenCalled();
 });
 it('checks a saved denial on every attempted use and never dispatches a media prompt',async()=>{
  const f=fixture('denied');await expect(f.access.capture('camera')).rejects.toThrow(/settings/i);
  expect(f.nav.mediaDevices.getUserMedia).not.toHaveBeenCalled();expect(f.transport.publish).not.toHaveBeenCalled();
 });
 it('treats a platform denial as terminal for this controller instead of repeatedly prompting',async()=>{
  const f=fixture();vi.mocked(f.nav.mediaDevices.getUserMedia).mockRejectedValue(new DOMException('private details','NotAllowedError'));
  await expect(f.access.capture('camera')).rejects.toThrow(/settings/i);await expect(f.access.capture('camera')).rejects.toThrow(/settings/i);
  expect(f.nav.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
 });
 it('stops capture and unpublishes immediately when permission is revoked',async()=>{
  const f=fixture('granted');await f.access.capture('microphone');await f.access.share('microphone');
  f.permission.state='denied';f.permission.dispatchEvent(new Event('change'));
  expect(f.track.stop).toHaveBeenCalled();expect(f.transport.unpublish).toHaveBeenCalledWith(f.track);expect(f.access.has('microphone')).toBe(false);
 });
 it('disposes a late platform grant after leaving instead of retaining the device',async()=>{
  const f=fixture();let done!:(value:MediaStream)=>void;vi.mocked(f.nav.mediaDevices.getUserMedia).mockImplementation(()=>new Promise(r=>{done=r;}));
  const pending=f.access.capture('microphone');await vi.waitFor(()=>expect(done).toBeTypeOf('function'));f.access.dispose();done(f.stream as unknown as MediaStream);
  await expect(pending).rejects.toThrow(/stopped/i);expect(f.track.stop).toHaveBeenCalled();expect(f.transport.publish).not.toHaveBeenCalled();
 });
 it('checks room authority again before publishing and after a pending publish',async()=>{
  const f=fixture();await f.access.capture('microphone');let done!:()=>void;f.transport.publish.mockImplementation(()=>new Promise<void>(r=>{done=r;}));
  const sharing=f.access.share('microphone');await vi.waitFor(()=>expect(done).toBeTypeOf('function'));f.revoke();done();await expect(sharing).rejects.toThrow(/stopped/i);
  expect(f.track.stop).toHaveBeenCalled();expect(f.transport.unpublish).toHaveBeenCalledWith(f.track);
 });
 it('camera selection never requests the microphone, and ended tracks cannot be shared',async()=>{
  const f=fixture();f.track.kind='video';await f.access.capture('camera',{width:640});
  expect(f.nav.mediaDevices.getUserMedia).toHaveBeenCalledWith({audio:false,video:{width:640}});
  f.track.readyState='ended';f.track.dispatchEvent(new Event('ended'));await expect(f.access.share('camera')).rejects.toThrow();expect(f.transport.publish).not.toHaveBeenCalled();
 });
 it('reports unknown when the browser cannot query status, and unavailable without capture support',async()=>{
  const f=fixture();vi.mocked(f.nav.permissions.query).mockRejectedValue(new TypeError('unsupported descriptor'));
  expect(await permissionState('camera',f.nav,true)).toBe('unknown');expect(await permissionState('camera',{} as Navigator,true)).toBe('unavailable');
 });
 it('recovers only after the browser reports a later grant in settings',async()=>{
  const f=fixture();vi.mocked(f.nav.mediaDevices.getUserMedia).mockRejectedValueOnce(new DOMException('denied','NotAllowedError'));
  await expect(f.access.capture('microphone')).rejects.toThrow();f.permission.state='granted';await f.access.capture('microphone');expect(f.access.has('microphone')).toBe(true);f.access.dispose();
 });
 it('stops a muted device instead of retaining an interrupted sensitive capture',async()=>{
  const f=fixture('granted');await f.access.capture('microphone');f.track.dispatchEvent(new Event('mute'));expect(f.track.stop).toHaveBeenCalled();expect(f.access.has('microphone')).toBe(false);
 });
});
