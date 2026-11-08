import {createContext,useEffect,useRef,useState,type ReactNode,type MutableRefObject,type Dispatch,type SetStateAction} from 'react';
import {emptyVault,type GameVault,type VaultProject} from '../../../shared/game-vault.mjs';
export type VaultSaveOperation={expectedOwnerId:string;revision:number;operationId:string;consent:'private-storage-v1';vault:GameVault};
type DraftMemory={project:VaultProject|null;dirty:boolean;baseRevision:number;baseVault:GameVault};
const fresh=():DraftMemory=>({project:null,dirty:false,baseRevision:0,baseVault:emptyVault()});
export const GameVaultDraftContext=createContext<{ownerId:string|null;memory:DraftMemory;setMemory:Dispatch<SetStateAction<DraftMemory>>;pending:MutableRefObject<VaultSaveOperation|null>}|null>(null);
// This lifetime is one signed-in account and one open app. No source enters browser storage.
export function GameVaultDraftProvider({ownerId,children}:{ownerId:string|null;children:ReactNode}){
 return <AccountDraft key={ownerId??'guest'} ownerId={ownerId}>{children}</AccountDraft>;
}
function AccountDraft({ownerId,children}:{ownerId:string|null;children:ReactNode}){
 const [memory,setMemory]=useState(fresh),pending=useRef<VaultSaveOperation|null>(null);
 useEffect(()=>{if(!memory.dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[memory.dirty]);
 return <GameVaultDraftContext.Provider value={{ownerId,memory,setMemory,pending}}>{children}</GameVaultDraftContext.Provider>;
}
