import './privacy.css';
import {useId} from 'react';
export function FileAccessNotice(){return <p className="privacy-help">Your device’s file picker gives EcoVibes access only to the photo, video or file you select. Cancel to keep it private. Selecting does not upload it or allow AI processing.</p>;}
export function UploadConsent({checked,onChange,purpose,disabled=false}:{checked:boolean;onChange:(value:boolean)=>void;purpose:string;disabled?:boolean}){
 const id=useId();return <label className="privacy-consent" htmlFor={id}><input id={id} type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} disabled={disabled}/><span>I agree to upload and store {purpose}. This does not allow AI processing.</span></label>;
}
