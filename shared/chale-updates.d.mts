export type PublicUpdate = {kind:'app'|'ghana'|'world';title:string;url:string;date:string;source:string};
export const publicNewsSources: Readonly<Record<string,{kind:'ghana'|'world';source:string}>>;
export const appReleaseUpdates: ReadonlyArray<PublicUpdate>;
export function chaleUpdateIntent(value:unknown): 'app'|'ghana'|'world'|'both'|null;
export function readPublicUpdates(payload:unknown,now?:number): PublicUpdate[];
