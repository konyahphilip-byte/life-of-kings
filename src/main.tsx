import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './modules/App';
import {ScreenBoundary,screenErrorOptions} from './modules/ScreenBoundary';
import './styles.css';
import {retireUnsafeShell} from './offline-shell';

const root=createRoot(document.getElementById('root')!,screenErrorOptions);
async function start(){
 if(import.meta.env.VITE_M01_STUDIO==='true'&&/^\/(?:m01(?:\/|$)|shops\/|products\/)/.test(location.pathname)){
  const {default:NativeStudio}=await import('./modules/marketplace/M01Studio');
  root.render(<React.StrictMode><ScreenBoundary screen="Seller Studio" onHome={()=>location.assign('/')}><NativeStudio/></ScreenBoundary></React.StrictMode>);
  return;
 }

 if(import.meta.env.PROD){
  try{await retireUnsafeShell(window.caches);}
  catch{
   root.render(<main className="screen-recovery" role="alert"><h1>EcoVibes needs to finish an update</h1><p>The older offline copy could not be retired. Your saved baskets and account records have not been deleted.</p><p>Reconnect and try again. If this continues, check whether your browser allows site storage.</p><button type="button" className="button button-primary" onClick={()=>void start()}>Try update again</button></main>);
   return;
  }
  if('serviceWorker' in navigator){
   const register=()=>{void navigator.serviceWorker.register('/sw.js').catch(()=>undefined);};
   if(document.readyState==='complete')register();else window.addEventListener('load',register,{once:true});
  }
 }
 root.render(<React.StrictMode><ScreenBoundary screen="EcoVibes" onHome={()=>window.location.assign('/')}><App /></ScreenBoundary></React.StrictMode>);
}
void start();
