export type DeviceKind='camera'|'microphone';
export type DeviceState=PermissionState|'unknown'|'unavailable';
const settings='Access is unavailable. You can change this site’s camera or microphone permission in browser settings. Other EcoVibes features still work.';
export async function permissionState(kind:DeviceKind,nav:Navigator=navigator,secure=window.isSecureContext):Promise<DeviceState>{
 if(!secure||!nav.mediaDevices?.getUserMedia)return 'unavailable';
 try{return (await nav.permissions.query({name:kind as PermissionName})).state;}catch{return 'unknown';}
}
type Transport={publish:(track:MediaStreamTrack,kind:DeviceKind)=>Promise<unknown>;unpublish:(track:MediaStreamTrack)=>Promise<unknown>};
type Capture={stream:MediaStream;track:MediaStreamTrack;remove:()=>void;sharing:boolean};
/** Owns only explicit user captures. No enumeration, recording, analytics or persistent device data. */
export class MediaAccess{
 private captures=new Map<DeviceKind,Capture>();
 private revisions={camera:0,microphone:0};
 private pending=new Set<DeviceKind>();
 private denied=new Set<DeviceKind>();
 private disposed=false;
 constructor(private allowed:()=>boolean,private transport:Transport,private changed:(reason?:string)=>void,private nav:Navigator=navigator,private secure=window.isSecureContext){}
 has(kind:DeviceKind){return this.captures.get(kind)?.track.readyState==='live';}
 isSharing(kind:DeviceKind){return this.captures.get(kind)?.sharing===true;}
 async capture(kind:DeviceKind,constraints:MediaTrackConstraints={}){
  if(this.disposed||!this.allowed())throw Error('Device access stopped: room permission is unavailable.');
  if(this.pending.has(kind)||this.has(kind))return;
  this.pending.add(kind);const revision=++this.revisions[kind];let permission:PermissionStatus|undefined;
  try{
   if(!this.secure||!this.nav.mediaDevices?.getUserMedia)throw Error('Camera and microphone need a supported browser and a secure HTTPS connection.');
   try{permission=await this.nav.permissions.query({name:kind as PermissionName});}catch{/* Safari may support capture without a permission query. */}
   if(permission?.state==='granted')this.denied.delete(kind);
   if(permission?.state==='denied'||this.denied.has(kind))throw Error(settings);
   if(this.disposed||revision!==this.revisions[kind]||!this.allowed())throw Error('Device access stopped.');
   const stream=await this.nav.mediaDevices.getUserMedia(kind==='camera'?{audio:false,video:constraints}:{audio:constraints,video:false});
   if(this.disposed||revision!==this.revisions[kind]||!this.allowed()||(permission?.state as string)==='denied'){
    stream.getTracks().forEach(track=>track.stop());throw Error('Device access stopped.');
   }
   const tracks=stream.getTracks(),track=tracks.find(t=>t.kind===(kind==='camera'?'video':'audio'));
   tracks.filter(t=>t!==track).forEach(t=>t.stop());
   if(!track||track.readyState!=='live'){tracks.forEach(t=>t.stop());throw Error('The selected device is unavailable.');}
   const ended=()=>{this.stop(kind);this.changed('Device access ended or was interrupted. You can continue without it.');};
   const revoked=()=>{if(permission?.state!=='granted')ended();};
   track.addEventListener('ended',ended);track.addEventListener('mute',ended);permission?.addEventListener('change',revoked);
   this.captures.set(kind,{stream,track,sharing:false,remove:()=>{track.removeEventListener('ended',ended);track.removeEventListener('mute',ended);permission?.removeEventListener('change',revoked);}});
   this.changed();
  }catch(error){
   if(error instanceof DOMException&&['NotAllowedError','SecurityError','PermissionDeniedError'].includes(error.name)){this.denied.add(kind);throw Error(settings);}
   if(error instanceof DOMException)throw Error('The selected device is unavailable or in use. You can continue without it.');
   throw error;
  }finally{this.pending.delete(kind);}
 }
 async share(kind:DeviceKind){
  const capture=this.captures.get(kind),revision=this.revisions[kind];
  if(this.disposed||!this.allowed()||!capture||capture.track.readyState!=='live')throw Error('Device sharing stopped. Check room and device permission first.');
  if(capture.sharing)return;
  // Recheck browser permission at the protected operation, even after a preview grant.
  const state=await permissionState(kind,this.nav,this.secure);
  if(state==='denied'||state==='unavailable'){this.stop(kind);throw Error(settings);}
  if(this.disposed||!this.allowed()||revision!==this.revisions[kind])throw Error('Device sharing stopped.');
  try{
   await this.transport.publish(capture.track,kind);
   if(this.disposed||!this.allowed()||revision!==this.revisions[kind]||capture.track.readyState!=='live'){
    void this.transport.unpublish(capture.track).catch(()=>{});capture.track.stop();throw Error('Device sharing stopped.');
   }
   capture.sharing=true;this.changed();
  }catch(error){this.stop(kind);throw error;}
 }
 stop(kind:DeviceKind){
  this.revisions[kind]++;const capture=this.captures.get(kind);this.captures.delete(kind);
  if(capture){capture.remove();capture.stream.getTracks().forEach(t=>t.stop());void this.transport.unpublish(capture.track).catch(()=>{});}
  this.changed();
 }
 stopAll(){this.stop('camera');this.stop('microphone');}
 dispose(){this.disposed=true;this.stopAll();}
}
