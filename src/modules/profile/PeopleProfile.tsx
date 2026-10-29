import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {Camera,X} from 'lucide-react';
import {apiUrl} from '../../lib/api';
import './profile-media.css';
import {FileAccessNotice,UploadConsent} from '../privacy/consent';
type Identity={id:string;eco_id:string;display_name:string};
type Profile={viewerId:string;ownerId:string;mediaEnabled:boolean;avatarAssetId:string|null;bannerAssetId:string|null;revision:number;updatedAt:string|null;counts:{friends:number;followers:number;following:number}};
function checked(value:Profile,owner:string):Profile{
 if(!value||value.ownerId!==owner||value.viewerId!==owner||typeof value.mediaEnabled!=='boolean'||!Number.isSafeInteger(value.revision)||value.revision<0||!value.counts||Object.values(value.counts).length!==3||['friends','followers','following'].some(k=>!Number.isSafeInteger(value.counts[k as keyof Profile['counts']])||value.counts[k as keyof Profile['counts']]<0)||[value.avatarAssetId,value.bannerAssetId].some(v=>v!==null&&(typeof v!=='string'||!/^[0-9a-f-]{36}$/i.test(v))))throw Error('Your profile could not be verified. Please refresh.');
 return value;
}
async function call(path:string,signal:AbortSignal,csrf='',body?:unknown){
 const response=await fetch(apiUrl(path),{method:body?'POST':'GET',credentials:'include',cache:'no-store',signal,headers:body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{},body:body?JSON.stringify(body):undefined});
 const value=await response.json();if(!response.ok)throw Object.assign(Error(value.error?.message||'Your profile could not be saved.'),{status:response.status});return value;
}
function ProfileImage({owner,kind,revision,alt}:{owner:string;kind:'avatar'|'banner';revision:number;alt:string}){
 const [src,setSrc]=useState('');
 useEffect(()=>{
  let active=true,url='';const controller=new AbortController();setSrc('');
  void fetch(apiUrl(`/people/profiles/${owner}/media/${kind}`),{credentials:'include',cache:'no-store',signal:controller.signal}).then(async response=>{if(!response.ok)throw Error('Image unavailable');const blob=await response.blob();if(!active)return;url=URL.createObjectURL(blob);setSrc(url);}).catch(()=>{if(active)setSrc('');});
  return()=>{active=false;controller.abort();if(url)URL.revokeObjectURL(url);};
 },[owner,kind,revision]);
 return src?<img src={src} alt={alt}/>:<span className="profile-image-unavailable">Photo unavailable</span>;
}
async function fileData(file:File,signal:AbortSignal){
 return new Promise<string>((resolve,reject)=>{
  const reader=new FileReader();const abort=()=>{reader.abort();reject(Error('Upload cancelled.'));};
  if(signal.aborted)return abort();signal.addEventListener('abort',abort,{once:true});
  reader.onload=()=>{signal.removeEventListener('abort',abort);resolve(String(reader.result).split(',')[1]||'');};reader.onerror=()=>{signal.removeEventListener('abort',abort);reject(Error('Could not read that image.'));};reader.readAsDataURL(file);
 });
}
export default function PeopleProfile({identity,csrfToken,dataMode,onAccount,onFriends}:{identity:Identity;csrfToken:string;dataMode:string;onAccount:()=>void;onFriends:()=>void}){
 const [draftBase,setDraftBase]=useState<Profile|null>(null);
 const [conflict,setConflict]=useState(false);
 const [uploadConsent,setUploadConsent]=useState(false);
 const [profile,setProfile]=useState<Profile|null>(null),[error,setError]=useState(''),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[showPhotos,setShowPhotos]=useState(dataMode!=='extreme');
 const [avatar,setAvatar]=useState<File|null>(null),[banner,setBanner]=useState<File|null>(null),[removeAvatar,setRemoveAvatar]=useState(false),[removeBanner,setRemoveBanner]=useState(false);
 const generation=useRef(0),pending=useRef<AbortController|null>(null),write=useRef<AbortController|null>(null),uploaded=useRef(new WeakMap<File,string>());
 const refresh=useCallback(async()=>{
  const revision=++generation.current;pending.current?.abort();if(document.visibilityState==='hidden'||!navigator.onLine)return;
  const controller=new AbortController();pending.current=controller;const deadline=setTimeout(()=>controller.abort(),10000);
  try{const value=checked(await call('/people/profiles/me',controller.signal),identity.id);if(revision!==generation.current||controller.signal.aborted)return;setProfile(value);setError('');}
  catch(e){if(revision===generation.current){setProfile(null);setError(e instanceof Error&&e.name!=='AbortError'?e.message:'The profile connection timed out. Please refresh.');}}
  finally{clearTimeout(deadline);}
 },[identity.id]);
 useEffect(()=>{
  void refresh();const visible=()=>{if(document.visibilityState==='hidden'||!navigator.onLine){generation.current++;pending.current?.abort();}else void refresh();};
  const timer=setInterval(()=>void refresh(),30000);document.addEventListener('visibilitychange',visible);window.addEventListener('online',visible);window.addEventListener('offline',visible);window.addEventListener('ecovibes:friends_changed',visible);
  return()=>{generation.current++;pending.current?.abort();write.current?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',visible);window.removeEventListener('offline',visible);window.removeEventListener('ecovibes:friends_changed',visible);};
 },[refresh]);
 useEffect(()=>setShowPhotos(dataMode!=='extreme'),[dataMode]);
 function discardDraft(){
  setUploadConsent(false);setAvatar(null);setBanner(null);setRemoveAvatar(false);setRemoveBanner(false);setDraftBase(null);setEditing(false);setConflict(false);
 }
 function toggleEditor(){
  if(editing){discardDraft();return;}
  discardDraft();setDraftBase(profile);setEditing(true);setSaved(false);setError('');
 }
 function reloadSaved(){
  discardDraft();setProfile(null);setSaved(false);void refresh();
 }
 async function upload(file:File,controller:AbortController){
  const known=uploaded.current.get(file);if(known)return known;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024||file.size===0)throw Error('Choose a JPG, PNG or WebP image smaller than 5 MB.');
  const data=await fileData(file,controller.signal);if(controller.signal.aborted)throw Error('Upload cancelled.');
  const result=await call('/social/assets',controller.signal,csrfToken,{mimeType:file.type,data,expectedOwnerId:identity.id});
  if(typeof result.id!=='string'||!/^[0-9a-f-]{36}$/i.test(result.id))throw Error('The image upload was not confirmed.');uploaded.current.set(file,result.id);return result.id;
 }
 async function save(event:FormEvent){
  event.preventDefault();if(!profile||busy||!profile.mediaEnabled||!navigator.onLine||((avatar||banner)&&!uploadConsent))return;
  const captured=draftBase||profile,photo=avatar,cover=banner,clearPhoto=removeAvatar,clearCover=removeBanner;
  const controller=new AbortController();write.current=controller;setBusy(true);setSaved(false);setConflict(false);setError('');const deadline=setTimeout(()=>controller.abort(),60000);
  try{
   const avatarAssetId=clearPhoto?null:photo?await upload(photo,controller):captured.avatarAssetId;
   const bannerAssetId=clearCover?null:cover?await upload(cover,controller):captured.bannerAssetId;
   if(controller.signal.aborted)return;
   const result=checked(await call('/people/profiles/me',controller.signal,csrfToken,{expectedOwnerId:identity.id,avatarAssetId,bannerAssetId,revision:captured.revision}),identity.id);
   if(controller.signal.aborted)return;generation.current++;pending.current?.abort();setProfile(result);setAvatar(null);setBanner(null);setRemoveAvatar(false);setRemoveBanner(false);setEditing(false);setSaved(true);
  }catch(e){if(!controller.signal.aborted){setConflict(e instanceof Error&&'status' in e&&e.status===409);setError(e instanceof Error?e.message:'Saving was not confirmed. Refresh before trying again.');}else if(write.current===controller)setError('Saving was not confirmed. Refresh your profile before trying again.');}
  finally{clearTimeout(deadline);if(write.current===controller){write.current=null;setBusy(false);}}
 }
 const initials=identity.display_name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
 return <section className="owned-profile" aria-label="Your EcoVibes profile">
  <div className="profile-cover">{showPhotos&&profile?.bannerAssetId?<ProfileImage owner={identity.id} kind="banner" revision={profile.revision} alt="Your profile cover"/>:<><span className="cover-shape cover-shape-one"/><span className="cover-shape cover-shape-two"/></>}<button className="edit-profile button button-secondary" type="button" onClick={onAccount}>Manage EcoVibes ID</button></div>
  <div className="profile-head"><div className="profile-avatar avatar avatar-lg">{showPhotos&&profile?.avatarAssetId?<ProfileImage owner={identity.id} kind="avatar" revision={profile.revision} alt="Your profile photo"/>:initials}</div><div className="profile-identity"><h1>{identity.display_name}</h1><p>@{identity.eco_id} · EcoVibes ID connected</p><p className="profile-bio">Your EcoVibes ID connects this account across the ecosystem.</p>
   {profile?<div className="profile-counts"><button type="button" onClick={onFriends}><strong>{profile.counts.friends.toLocaleString()}</strong> friends</button><span><strong>{profile.counts.followers.toLocaleString()}</strong> followers</span><span><strong>{profile.counts.following.toLocaleString()}</strong> following</span></div>:<p>Relationship counts are unavailable until your account can be checked.</p>}
   <div className="profile-media-actions"><button type="button" onClick={toggleEditor} disabled={!profile?.mediaEnabled||busy}><Camera size={18}/>Edit profile photos</button><button type="button" onClick={()=>void refresh()} disabled={busy}>Refresh profile</button>{dataMode==='extreme'&&!showPhotos&&<button type="button" onClick={()=>setShowPhotos(true)}>Load profile photos</button>}</div>
  </div></div>
  {saved&&<p role="status">Profile saved to your EcoVibes account.</p>}{error&&<p role="alert">{error}</p>}
  {conflict&&<div><p>Your draft is still here. Reload saved profile discards these choices so you can edit the latest version.</p><button type="button" disabled={busy} onClick={reloadSaved}>Reload saved profile</button></div>}
  {profile&&!profile.mediaEnabled&&<p>Profile photo editing is not available yet. Relationship counts still use your saved EcoVibes records.</p>}
  {editing&&(profile||draftBase)&&<form className="profile-media-editor" onSubmit={save}><header><h2>Edit profile photos</h2><button type="button" aria-label="Close profile editor" disabled={busy} onClick={discardDraft}><X size={20}/></button></header><p>Your saved photo and cover are visible to signed-in EcoVibes members. Blocking limits new access. Choose images you have permission to share.</p>
   <FileAccessNotice/><label>Profile photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{setUploadConsent(false);setAvatar(e.target.files?.[0]||null);setRemoveAvatar(false);}}/></label><label><input type="checkbox" checked={removeAvatar} disabled={busy} onChange={e=>setRemoveAvatar(e.target.checked)}/>Remove profile photo</label>
   <label>Cover banner<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{setUploadConsent(false);setBanner(e.target.files?.[0]||null);setRemoveBanner(false);}}/></label><label><input type="checkbox" checked={removeBanner} disabled={busy} onChange={e=>setRemoveBanner(e.target.checked)}/>Remove cover banner</label>{(avatar||banner)&&<UploadConsent checked={uploadConsent} onChange={setUploadConsent} disabled={busy} purpose="these profile images, visible to signed-in EcoVibes members"/>}<small>JPG, PNG or WebP · up to 5 MB each. Uploads need a connection.</small><button type="submit" disabled={busy||!profile?.mediaEnabled||((avatar||banner)&&!uploadConsent)||(!avatar&&!banner&&!removeAvatar&&!removeBanner)}>{busy?'Saving profile…':'Save profile photos'}</button>
  </form>}
 </section>;
}
