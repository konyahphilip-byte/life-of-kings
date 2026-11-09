import type {VaultProject} from './game-vault.mjs';
export const PROJECT_ZIP_BYTES:number;
export type ProjectArchive={filename:string;rootDirectory:string;bytes:Uint8Array<ArrayBuffer>;sourceFiles:number;engineEntryPoint:string|null};
export function projectSourceArchive(project:VaultProject):ProjectArchive;
