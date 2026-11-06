import {useState} from 'react';
import {ArrowRight} from 'lucide-react';
import type {Page} from '../navigation';
import './personal-account.css';

// Optional usage interests/entry points. These are never authorization roles.
export const accountPurposes:[string,string,Page][]=[
 ['personal','Personal — friends & messages','Messages'],
 ['creator','Creator','Create'],
 ['learner','Student / learner','Opportunities'],
 ['community','Community member','Communities'],
 ['shopper','Shopper / customer','Marketplace'],
 ['seller','Seller / merchant','Marketplace'],
 ['provider','Service provider / Handi','Quick&Handi'],
 ['collector','Collector / recycler','Waste'],
 ['none','None of the above — personal use','Home'],
];
export function accountPurpose(value:unknown){return typeof value==='string'&&accountPurposes.some(([code])=>code===value)?value:'personal';}
export function PurposeOptions(){return accountPurposes.map(([code,label])=><option key={code} value={code}>{label}</option>);}
export default function PersonalUseOptions(){
 const [choice,setChoice]=useState('personal');
 function continueToArea(){const destination=accountPurposes.find(([code])=>code===choice)?.[2]||'Home';window.dispatchEvent(new CustomEvent('ecovibes:navigate',{detail:destination}));}
 return <section className="personal-use-options" aria-label="Personal use and optional activities"><h3>Use EcoVibes your way</h3><p>You can stay here just to message friends and explore. Seller and provider tools are optional.</p><label>Choose a starting point (optional)<select value={choice} onChange={event=>setChoice(event.target.value)}><PurposeOptions/></select></label><button type="button" onClick={continueToArea}>Continue <ArrowRight size={16} aria-hidden="true"/></button><small>This opens an area of EcoVibes. Business tools have their own activation and verification steps.</small></section>;
}
