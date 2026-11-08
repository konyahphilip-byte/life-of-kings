import {useContext,useEffect,useRef,useState} from 'react';
import {GameVaultDraftContext,type VaultSaveOperation as Operation} from './GameVaultDraft';
import {apiRequest} from '../../lib/api';
import {normalizeVault,vaultDigest,type GameVault} from '../../../shared/game-vault.mjs';
export type VaultSnapshot={ownerId:string;revision:number;vault:GameVault;sha256:string;updatedAt:string|null;savedRevision?:number};
async function verified(value:unknown,owner:string){
 const data=value as VaultSnapshot;
 if(!data||data.ownerId!==owner||!Number.isInteger(data.revision)||data.revision<0||data.revision>1000000)throw Error('The project response did not match your account.');
 const vault=normalizeVault(data.vault);if(await vaultDigest(vault)!==data.sha256)throw Error('Saved project integrity could not be verified.');
 return {...data,vault};
}
export function useGameVault(owner:string|null){
 const [snapshot,setSnapshot]=useState<VaultSnapshot|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[accountInvalid,setAccountInvalid]=useState(false);
 const cache=useContext(GameVaultDraftContext),localPending=useRef<Operation|null>(null);const pending=cache?.ownerId===owner?cache.pending:localPending;
 const live=useRef(true),active=useRef<AbortController|null>(null),saving=useRef(false);
 useEffect(()=>{live.current=true;if(owner)void load();return()=>{live.current=false;active.current?.abort();if(!cache)pending.current=null;};},[owner]);
 async function load(){
  if(!owner||saving.current)return null;active.current?.abort();const abort=new AbortController();active.current=abort;setLoading(true);setError('');
  const timer=setTimeout(()=>abort.abort(),10000);
  try{
   const result=await apiRequest<unknown>('/games/vault',{signal:abort.signal}),data=await verified(result,owner);
   if(!live.current||active.current!==abort||abort.signal.aborted)return null;setSnapshot(data);setAccountInvalid(false);return data;
  }catch(e){if(live.current&&active.current===abort){setError(abort.signal.aborted?'The Vault took too long to load. Please retry.':e instanceof Error?e.message:'The Vault could not be loaded.');setSnapshot(null);}return null;}
  finally{clearTimeout(timer);if(live.current&&active.current===abort)setLoading(false);}
 }
 async function save(vault:GameVault,baseRevision:number){
  if(!owner||!snapshot||saving.current||loading||accountInvalid)return null;
  let normalized:GameVault;try{normalized=normalizeVault(vault);}catch(e){setError(e instanceof Error?e.message:'Check the project before saving.');return null;}
  saving.current=true;setBusy(true);setError('');active.current?.abort();const abort=new AbortController();active.current=abort;
  const prior=pending.current;
  const operation:Operation=prior&&prior.revision===baseRevision&&JSON.stringify(prior.vault)===JSON.stringify(normalized)?prior:{expectedOwnerId:owner,revision:baseRevision,operationId:crypto.randomUUID(),consent:'private-storage-v1',vault:normalized};
  pending.current=operation;const timer=setTimeout(()=>abort.abort(),10000);
  try{
   const me=await apiRequest<{user:{id:string}|null;csrfToken:string|null}>('/auth/me',{signal:abort.signal});
   if(me.user?.id!==owner||!me.csrfToken){if(live.current){setAccountInvalid(true);setSnapshot(null);}throw Error('Your account changed or session expired. Reopen your own Vault.');}
   if(!live.current||abort.signal.aborted)return null;
   const result=await apiRequest<unknown>('/games/vault',{method:'PUT',headers:{'X-CSRF-Token':me.csrfToken},body:JSON.stringify(operation),signal:abort.signal}),data=await verified(result,owner);
   if(!live.current||active.current!==abort||abort.signal.aborted)return null;
   if(data.savedRevision!==baseRevision+1)throw Error('The server did not confirm this project revision.');
   pending.current=null;
   if(data.revision!==data.savedRevision){setError('This save was acknowledged, but newer changes exist. Export your draft before reloading.');return null;}
   setSnapshot(data);return data;
  }catch(e){if(live.current&&active.current===abort)setError((abort.signal.aborted?'The save outcome is unknown. Retry the same draft.':e instanceof Error?e.message:'Project save failed.')+' Your draft remains; no new success is shown.');return null;}
  finally{clearTimeout(timer);saving.current=false;if(live.current&&active.current===abort)setBusy(false);}
 }
 return {snapshot,error,setError,busy,loading,load,save,accountInvalid};
}
