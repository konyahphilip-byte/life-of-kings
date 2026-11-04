export type HappeningItem={title:string;subtitle:string;url:string;date:string};
export type HappeningSection={id:string;source:string;label:string;sourceUrl:string;status:'available'|'empty'|'unavailable'|'disabled';checkedAt:string;updatedAt:string|null;expiresAt:string;copyright:string;items:HappeningItem[]};
export type HappeningData={asOf:string;sections:HappeningSection[]};
export function readHappening(value:unknown,now?:number):HappeningData|null;
