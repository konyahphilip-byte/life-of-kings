import {StrictMode} from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {RoomEvent} from 'livekit-client';
import RoomMedia from './RoomMedia';
const {room}=vi.hoisted(()=>({room:{state:'connected',localParticipant:{permissions:{canPublish:true},publishTrack:vi.fn(async()=>{}),unpublishTrack:vi.fn(async()=>{})},on:vi.fn(),off:vi.fn()}}));
vi.mock('@livekit/components-react',()=>({useRoomContext:()=>room,useTracks:()=>[],GridLayout:()=>null,ParticipantTile:()=>null}));
let track:EventTarget&{kind:string;readyState:string;stop:ReturnType<typeof vi.fn>};let capture:ReturnType<typeof vi.fn>;
beforeEach(()=>{
 room.localParticipant.permissions.canPublish=true;room.localParticipant.publishTrack.mockClear();room.localParticipant.unpublishTrack.mockClear();room.on.mockClear();room.off.mockClear();
 track=Object.assign(new EventTarget(),{kind:'audio',readyState:'live',stop:vi.fn()});capture=vi.fn(async()=>({getTracks:()=>[track]}));
 Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:capture},configurable:true});Object.defineProperty(navigator,'permissions',{value:{query:vi.fn(async()=>Object.assign(new EventTarget(),{state:'granted'}))},configurable:true});vi.stubGlobal('isSecureContext',true);
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('room capture integration',()=>{
 it('survives StrictMode setup, requests one device only, and never publishes before Share',async()=>{
  render(<StrictMode><RoomMedia canPublish mode="video" saver="saver"/></StrictMode>);expect(capture).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Allow microphone access'}));await screen.findByText('Device active locally; not shared yet');
  expect(capture).toHaveBeenCalledWith({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});expect(room.localParticipant.publishTrack).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Share microphone with this room'}));await screen.findByText('Sharing with room participants');
  act(()=>window.dispatchEvent(new Event('ecovibes:stop_devices')));expect(track.stop).toHaveBeenCalled();expect(room.localParticipant.unpublishTrack).toHaveBeenCalledWith(track,true);
 });
 it('denies a viewer capture and offers no unrelated camera control in Extreme Saver',async()=>{
  const view=render(<RoomMedia canPublish={false} mode="video" saver="extreme"/>);expect(screen.queryByRole('button',{name:/Allow/})).toBeNull();expect(capture).not.toHaveBeenCalled();
  view.rerender(<RoomMedia canPublish mode="video" saver="extreme"/>);expect(screen.queryByRole('button',{name:'Allow camera access'})).toBeNull();
  room.localParticipant.permissions.canPublish=false;fireEvent.click(screen.getByRole('button',{name:'Allow microphone access'}));await screen.findByRole('alert');expect(capture).not.toHaveBeenCalled();
 });
 it.each(['ecovibes:identity_changed','ecovibes:stop_devices'])('stops owned tracks on %s',async event=>{
  render(<RoomMedia canPublish mode="voice" saver="saver"/>);fireEvent.click(screen.getByRole('button',{name:'Allow microphone access'}));await screen.findByText('Device active locally; not shared yet');act(()=>window.dispatchEvent(new Event(event)));expect(track.stop).toHaveBeenCalled();
 });
 it.each([RoomEvent.Reconnecting,RoomEvent.ParticipantPermissionsChanged])('stops an active capture on room event %s',async event=>{
  render(<RoomMedia canPublish mode="voice" saver="saver"/>);fireEvent.click(screen.getByRole('button',{name:'Allow microphone access'}));await screen.findByText('Device active locally; not shared yet');
  room.localParticipant.permissions.canPublish=false;const listener=room.on.mock.calls.find(([name])=>name===event)?.[1] as (()=>void)|undefined;expect(listener).toBeTypeOf('function');act(()=>listener!());expect(track.stop).toHaveBeenCalled();expect(screen.queryByText('Device active locally; not shared yet')).toBeNull();
 });
 it('disposes a late browser grant after component unmount',async()=>{
  let done!:(value:unknown)=>void;capture.mockImplementation(()=>new Promise(r=>{done=r;}));const view=render(<RoomMedia canPublish mode="voice" saver="saver"/>);
  fireEvent.click(screen.getByRole('button',{name:'Allow microphone access'}));await waitFor(()=>expect(done).toBeTypeOf('function'));view.unmount();await act(async()=>done({getTracks:()=>[track]}));expect(track.stop).toHaveBeenCalled();expect(room.localParticipant.publishTrack).not.toHaveBeenCalled();

 });
});
