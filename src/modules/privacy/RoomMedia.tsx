import {useEffect,useMemo,useRef,useState} from 'react';
import {GridLayout,ParticipantTile,useRoomContext,useTracks} from '@livekit/components-react';
import {RoomEvent,Track} from 'livekit-client';
import {MediaAccess,type DeviceKind} from './media-access';
import {callQuality,type CallDataMode} from '../connect/call-quality';
export default function RoomMedia({canPublish,mode,saver}:{canPublish:boolean;mode:string;saver:CallDataMode}){
 const room=useRoomContext(),quality=useMemo(()=>callQuality(saver),[saver]);
 const [,redraw]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState<DeviceKind|null>(null);
 const permitted=useRef(false);permitted.current=canPublish&&room.localParticipant.permissions?.canPublish===true&&room.state==='connected';
 const [access,setAccess]=useState<MediaAccess|null>(null);
 const tracks=useTracks([{source:Track.Source.Camera,withPlaceholder:true}],{onlySubscribed:false});
 useEffect(()=>{
  const access=new MediaAccess(()=>permitted.current,{publish:(track,kind)=>room.localParticipant.publishTrack(track,{...quality.options.publishDefaults,source:kind==='camera'?Track.Source.Camera:Track.Source.Microphone}),unpublish:track=>room.localParticipant.unpublishTrack(track,true)},reason=>{redraw(n=>n+1);if(reason)setError(reason);});setAccess(access);
  const stop=()=>access.stopAll();const visibility=()=>{if(document.visibilityState==='hidden')stop();};
  const permissions=()=>{if(!room.localParticipant.permissions?.canPublish)stop();};
  window.addEventListener('ecovibes:identity_changed',stop);window.addEventListener('ecovibes:stop_devices',stop);
  document.addEventListener('visibilitychange',visibility);room.on(RoomEvent.Disconnected,stop);room.on(RoomEvent.Reconnecting,stop);room.on(RoomEvent.ParticipantPermissionsChanged,permissions);
  return()=>{access.dispose();window.removeEventListener('ecovibes:identity_changed',stop);window.removeEventListener('ecovibes:stop_devices',stop);document.removeEventListener('visibilitychange',visibility);room.off(RoomEvent.Disconnected,stop);room.off(RoomEvent.Reconnecting,stop);room.off(RoomEvent.ParticipantPermissionsChanged,permissions);};
 },[room,quality]);
 useEffect(()=>{if(!canPublish)access?.stopAll();},[canPublish,access]);
 async function capture(kind:DeviceKind){if(!access)return;setBusy(kind);setError('');try{await access.capture(kind,kind==='camera'?{width:{ideal:saver==='standard'?1280:640},height:{ideal:saver==='standard'?720:360},frameRate:{ideal:saver==='standard'?24:15}}:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true});}catch(e){setError(e instanceof Error?e.message:'Device unavailable.');}finally{setBusy(null);}}
 async function share(kind:DeviceKind){if(!access)return;setBusy(kind);setError('');try{await access.share(kind);}catch{setError('Sharing could not be confirmed. Device access has stopped.');}finally{setBusy(null);}}
 return <div className="privacy-room">
  <GridLayout tracks={tracks}><ParticipantTile/></GridLayout>
  <p>Joining does not turn on your camera or microphone. Nothing is recorded by this interface. Other participants may still capture what you share.</p>
  {canPublish?(['microphone',...(mode==='voice'||!quality.allowCamera?[]:['camera'])] as DeviceKind[]).map(kind=><section key={kind} aria-label={kind==='camera'?'Camera access':'Microphone access'}>
   <h2>{kind==='camera'?'Camera':'Microphone'}</h2><p>{kind==='camera'?'The browser will ask to use your camera for this room.':'The browser will ask to use your microphone for this room.'} Allowing access captures locally first. Use Share separately to transmit it to room participants through the configured media server.</p>
   {access?.has(kind)?<><p role="status">{access?.isSharing(kind)?'Sharing with room participants':'Device active locally; not shared yet'}</p>{!access?.isSharing(kind)&&<button type="button" disabled={busy!==null} onClick={()=>void share(kind)}>Share {kind} with this room</button>}<button type="button" onClick={()=>access?.stop(kind)}>Stop {kind}</button></>:<button type="button" disabled={busy!==null} onClick={()=>void capture(kind)}>Allow {kind} access</button>}
  </section>):<p>You can listen or watch. This room has not granted permission to publish media.</p>}
  {!quality.allowCamera&&<p>Camera sharing is off in Extreme Saver. Microphone access is a separate choice.</p>}
  {error&&<p role="alert">{error}</p>}<p>Denied or revoked access? Open this site’s permissions in your browser settings. If status cannot be queried, leave and reopen the room after changing settings. No other permission is required to use text chat.</p>
 </div>;
}
