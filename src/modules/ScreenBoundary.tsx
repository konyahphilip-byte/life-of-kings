import {Component,useEffect,useState,type ReactNode} from 'react';
import type {RootOptions} from 'react-dom/client';

export const screenErrorOptions:RootOptions={
 onCaughtError:()=>undefined, // The boundary emits its content-free reference.
 onUncaughtError:()=>console.error(JSON.stringify({event:'app_render_failed'})),
 onRecoverableError:()=>console.error(JSON.stringify({event:'app_render_recovered'})),
};

type RecoveryProps={screen:string;online?:boolean;onHome:()=>void;onReload?:()=>void};
function useConnection(override?:boolean){
 const [connected,setConnected]=useState(navigator.onLine!==false);
 useEffect(()=>{const changed=()=>setConnected(navigator.onLine!==false);window.addEventListener('online',changed);window.addEventListener('offline',changed);return()=>{window.removeEventListener('online',changed);window.removeEventListener('offline',changed);};},[]);
 return override??connected;
}
function RecoveryActions({online,onHome,onReload}:RecoveryProps){const connected=useConnection(online);return <><div className="screen-recovery-actions"><button type="button" className="button button-primary" onClick={onHome}>Back to Home</button><button type="button" className="button" disabled={!connected} onClick={onReload||(()=>window.location.reload())}>Reload app</button></div><p className="screen-recovery-note">Reloading may discard unsaved changes on this screen. Saved account records are not deleted.</p></>;}
export class ScreenBoundary extends Component<RecoveryProps&{children:ReactNode},{failed:boolean;reference:string}>{
 state={failed:false,reference:`SCREEN-${globalThis.crypto?.randomUUID?.().slice(0,8)||Math.random().toString(36).slice(2,10)}`};
 static getDerivedStateFromError(){return{failed:true};}
 componentDidCatch(){
  // No exception messages, stack traces, URLs, account records or form contents.
  console.error(JSON.stringify({event:'screen_render_failed',reference:this.state.reference}));
 }
 render(){return this.state.failed?<section className="screen-recovery" role="alert"><h1>This screen could not be opened</h1><p>Try another screen, or reload when your connection is available.</p><p className="screen-recovery-note">Problem reference: {this.state.reference}</p><RecoveryActions {...this.props} onHome={()=>{this.setState({failed:false});this.props.onHome();}}/></section>:this.props.children;}
}
export function ScreenPending(props:RecoveryProps){
 const [slow,setSlow]=useState(false),connected=useConnection(props.online);
 useEffect(()=>{setSlow(false);const timer=setTimeout(()=>setSlow(true),15000);return()=>clearTimeout(timer);},[props.screen]);
 return <section className="screen-recovery screen-pending"><p role="status">{!connected?'You’re offline. This screen needs a connection to open.':slow?'This screen is taking longer than expected.':`Opening ${props.screen}…`}</p>{(!connected||slow)&&<RecoveryActions {...props} online={connected}/>}</section>;
}
export function DestinationUnavailable({onHome}:{onHome:()=>void}){return <section className="screen-recovery" role="alert"><h1>This destination is not available</h1><p>The link does not match an implemented EcoVibes screen. Your account permissions have not changed.</p><button type="button" className="button button-primary" onClick={onHome}>Back to Home</button></section>;}
