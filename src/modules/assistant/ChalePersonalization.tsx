import {useState} from 'react';
import {saveChaleUI,useChaleUI,type ChaleUI} from './chale-ui';
import './sidekick.css';

export default function ChalePersonalization(){
 const prefs=useChaleUI();
 const [notice,setNotice]=useState('');
 const update=(patch:Partial<ChaleUI>)=>setNotice(saveChaleUI({...prefs,...patch})?'Saved on this device.':'Applied in this tab. This browser could not save the preference.');
 return <section className="settings-section chale-personalization" aria-labelledby="chale-personalization-title">
  <h2 id="chale-personalization-title">Personalization</h2>
  <p>Keep Chale within reach without covering what you are doing.</p>
  <label>Chale launcher<select value={prefs.launcher} onChange={e=>update({launcher:e.target.value as ChaleUI['launcher']})}>
   <option value="compact">Compact button</option><option value="labelled">Button with label</option><option value="hidden">Hide floating button</option>
  </select></label>
  <label>Launcher position<select value={prefs.edge} onChange={e=>update({edge:e.target.value as ChaleUI['edge']})}>
   <option value="right">Right side</option><option value="left">Left side</option>
  </select></label>
  <p>You can always open Chale here: Profile → Settings → Personalization.</p>
  <button id="chale-open-from-settings" type="button" onClick={()=>window.dispatchEvent(new Event('ecovibes:assistant_open'))}>Open Chale AI</button>
  <label className="chale-character-choice"><input type="checkbox" checked={prefs.showCharacter} onChange={e=>update({showCharacter:e.target.checked})} aria-describedby="chale-character-note"/>Show Chale 3D Character</label>
  <p id="chale-character-note">The 3D character is not available in this build. This visibility preference applies when it is available. Chale AI chat, recommendations, tracking, calls and money features keep their own availability and permissions.</p>
  {notice&&<p role="status">{notice}</p>}
 </section>;
}
