import type {VaultFile,VaultProject} from './game-vault.mjs';
export type FolderSourceFile={name:string;size:number;webkitRelativePath:string;arrayBuffer:()=>Promise<ArrayBuffer>};
export type FolderPlan={readonly root:string;readonly entries:readonly {readonly path:string;readonly name:string;readonly size:number;readonly relative:string;readonly file:FolderSourceFile}[];readonly skipped:number};
export function planSourceFolder(selection:ArrayLike<FolderSourceFile>):FolderPlan;
export function readSourceFolder(plan:FolderPlan,selected:string[],project:VaultProject,signal?:AbortSignal):Promise<VaultFile[]>;
