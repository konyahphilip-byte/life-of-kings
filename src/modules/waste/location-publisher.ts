export type SaverMode='standard'|'saver'|'extreme';
type Lease={sessionId:string;sequence:number;expiresAt?:string|null};
type Point={expectedOwnerId:string;sessionId:string;sequence:number;latitude:number;longitude:number;accuracy:number;capturedAt:number};
type Options={ownerId:string;mode:SaverMode;geo:Pick<Geolocation,'watchPosition'|'clearWatch'>;
 permission:()=>Promise<PermissionStatus|null>;available:()=>boolean;clock?:()=>number;
 api:{start:(body:{expectedOwnerId:string;requestId:string;requestedAt:number;shareWithCustomer:true})=>Promise<Lease>;point:(body:Point)=>Promise<{state:string}>;stop:(body:{expectedOwnerId:string;sessionId:string})=>Promise<unknown>};onChange:(message:string)=>void};

// Coordinates and pending points live in this controller's memory only. Every
// remote write carries the captured owner and lease; it never reads a new account.
export function createLocationPublisher(options:Options){
 const {ownerId,mode,geo,api,onChange,permission,available}=options,clock=options.clock||Date.now;
 const interval={standard:6000,saver:12000,extreme:25000}[mode];
 let generation=0,active=false,watch:number|null=null,lease:Lease|null=null,permissionStatus:PermissionStatus|null=null,denied=false;
 let pointTimer:ReturnType<typeof setTimeout>|null=null,expiryTimer:ReturnType<typeof setTimeout>|null=null;
 let pending:GeolocationPosition|null=null,sending=false,lastSent=0;
 function clearLocal(){
  generation++;active=false;if(watch!==null)geo.clearWatch(watch);watch=null;
  if(pointTimer)clearTimeout(pointTimer);if(expiryTimer)clearTimeout(expiryTimer);pointTimer=expiryTimer=null;
  if(permissionStatus)permissionStatus.onchange=null;permissionStatus=null;pending=null;
 }
 async function stop(message='Device location stopped.'){
  const captured=lease;lease=null;clearLocal();onChange(message);
  if(!captured)return;
  try{await api.stop({expectedOwnerId:ownerId,sessionId:captured.sessionId});}
  catch{onChange(`${message} Server confirmation is unavailable; its sharing expiry still applies.`);}
 }
 async function flush(token:number){
  pointTimer=null;if(!active||token!==generation||sending||!pending)return;
  if(!available()){await stop('Device location stopped while this page is unavailable or offline.');return;}
  const position=pending;pending=null;const captured=lease;if(!captured)return;
  const {latitude,longitude,accuracy}=position.coords,capturedAt=position.timestamp;
  if(![latitude,longitude,accuracy,capturedAt].every(Number.isFinite)||Math.abs(latitude)>90||Math.abs(longitude)>180||accuracy<0||accuracy>1000||clock()-capturedAt>30000||capturedAt-clock()>15000){onChange('Waiting for a fresh device position with usable accuracy.');return;}
  sending=true;lastSent=clock();
  try{
   const result=await api.point({expectedOwnerId:ownerId,sessionId:captured.sessionId,sequence:captured.sequence+1,latitude,longitude,accuracy,capturedAt:Math.trunc(capturedAt)});
   if(token!==generation||!active)return;
   if(result.state!=='live'){await stop('Location sharing is no longer active.');return;}
   captured.sequence++;onChange('Location shared with your customer.');
  }catch{if(token===generation)await stop('Location update was not confirmed. Device location stopped.');}
  finally{sending=false;if(active&&pending)schedule(generation);}
 }
 function schedule(token:number){if(sending||pointTimer)return;const wait=Math.max(0,interval-(clock()-lastSent));if(wait)pointTimer=setTimeout(()=>void flush(token),wait);else void flush(token);}
 async function start(shareConsent:boolean,canPublish:boolean){
  if(active)return;
  if(!shareConsent||!canPublish){onChange('Choose location sharing for your currently assigned collection first.');return;}
  if(!geo||!available()){onChange('Location needs a secure, visible page with an internet connection.');return;}
  const token=++generation;active=true;onChange('Checking location permission…');
  let status:PermissionStatus|null=null;
  try{status=await permission();}catch{/* Unsupported permission queries never imply a grant. */}
  if(token!==generation||!active)return;
  if(status?.state==='granted')denied=false;
  if(status?.state==='denied'||denied){clearLocal();onChange('Location is blocked. Change this site’s location permission in browser settings when you choose.');return;}
  permissionStatus=status;
  if(status)status.onchange=()=>{if(status.state!=='granted'){if(status.state==='denied')denied=true;void stop('Location permission changed. Device location stopped.');}};
  const requestId=crypto.randomUUID();
  try{
   const result=await api.start({expectedOwnerId:ownerId,requestId,requestedAt:clock(),shareWithCustomer:true});
   if(token!==generation||!active){await api.stop({expectedOwnerId:ownerId,sessionId:result.sessionId});return;}
   lease=result;
   if(!available()){await stop();return;}
   const remaining=result.expiresAt?Date.parse(result.expiresAt)-clock():1800000;
   if(!Number.isFinite(remaining)||remaining<=0){await stop('Location sharing expired.');return;}
   expiryTimer=setTimeout(()=>void stop('Location sharing expired. Start again only when needed.'),Math.min(remaining,1800000));
   onChange('Allow location in the browser prompt. Sharing starts only after device permission.');
   watch=geo.watchPosition(position=>{if(active&&token===generation){pending=position;schedule(token);}},error=>{
    if(token!==generation)return;if(error.code===1)denied=true;
    void stop(error.code===1?'Location permission was denied. Device location stopped.':'Device location is unavailable. Sharing stopped; you can try again when ready.');
   },{enableHighAccuracy:mode==='standard',maximumAge:0,timeout:15000});
  }catch{
   if(token===generation){lease=lease||{sessionId:requestId,sequence:0};await stop('Location sharing was not confirmed. No device location is being collected.');}
  }
 }
 return{start,stop,isActive:()=>active,sessionId:()=>lease?.sessionId};
}
